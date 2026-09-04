import { PROMPT_EXTRACAO } from "./prompt";
import type { ArquivoInfo, DadosPPI, Equipamento, LogLevel } from "../types";

const BASE = "https://generativelanguage.googleapis.com/v1beta";
export const MODELOS_PADRAO = ["gemini-3.8-flash", "gemini-3.6-flash", "gemini-3.1-pro"];
const MAX_TENTATIVAS_503 = 3;
const LIMITE_INLINE_MB = 18; // margem de segurança abaixo dos 20MB da API

export type Logger = (level: LogLevel, msg: string, detalhe?: string) => void;

export interface ResultadoGemini {
  dados: DadosPPI;
  rawRequest: string;
  rawResponse: string;
  duracaoMs: number;
  tentativas: number;
}

/* ------------------------------------------------------------------ */
/*  Helpers de diagnóstico                                             */
/* ------------------------------------------------------------------ */

function descreverErroHttp(status: number, corpo: string): string {
  let dicaApi = "";
  try {
    const j = JSON.parse(corpo);
    dicaApi = j?.error?.message ? ` — ${j.error.message}` : "";
  } catch {
    /* corpo não é JSON */
  }
  switch (status) {
    case 400:
      return `Requisição inválida (400)${dicaApi}. Geralmente: chave mal colada, modelo inexistente ou PDF corrompido.`;
    case 401:
    case 403:
      return `Chave de API rejeitada (${status})${dicaApi}. Confira em aistudio.google.com → Get API key.`;
    case 404:
      return `Modelo não encontrado (404)${dicaApi}. O nome do modelo mudou? Use "Listar modelos" para ver os ativos.`;
    case 429:
      return `Cota/limite de requisições atingido (429)${dicaApi}. Aguarde ~1 minuto e tente de novo.`;
    case 500:
      return `Erro interno do Google (500)${dicaApi}. Tente novamente.`;
    case 503:
      return `Modelo sobrecarregado (503)${dicaApi}. O sistema já tenta 3x sozinho — se persistir, troque para outro modelo Flash.`;
    default:
      return `HTTP ${status}${dicaApi}.`;
  }
}

function dormir(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/** Limpa cercas de markdown e encontra o objeto JSON dentro do texto. */
export function limparJson(texto: string, log: Logger): string {
  let t = texto.trim();
  if (t.startsWith("```")) {
    t = t.replace(/^```[a-zA-Z]*\n?/, "").replace(/```\s*$/, "").trim();
    log("info", "Markdown detectado na resposta — cercas ``` removidas.");
  }
  const ini = t.indexOf("{");
  const fim = t.lastIndexOf("}");
  if (ini === -1 || fim === -1 || fim <= ini) {
    throw new Error("A resposta da IA não contém um objeto JSON. Abra a aba 'Resposta bruta' para inspecionar.");
  }
  if (ini > 0 || fim < t.length - 1) {
    log("info", `Texto extra encontrado ao redor do JSON (${ini} chars antes, ${t.length - 1 - fim} depois) — isolado com sucesso.`);
  }
  return t.slice(ini, fim + 1);
}

/** Preenche campos ausentes para o objeto ficar 100% compatível com o contrato. */
export function normalizarDados(bruto: any, log: Logger): DadosPPI {
  const s = (v: any) => (v === null || v === undefined ? "" : String(v).trim());
  const eqBrutos: any[] = Array.isArray(bruto.equipamentos) ? bruto.equipamentos : [];
  if (!Array.isArray(bruto.equipamentos)) {
    log("warn", "O campo 'equipamentos' não veio como array — tratando como lista vazia.");
  }
  const equipamentos: Equipamento[] = eqBrutos.map((e, i) => {
    const eq: Equipamento = {
      tipo_equipamento: s(e?.tipo_equipamento ?? e?.tipo),
      fabricante: s(e?.fabricante) || "-",
      modelo: s(e?.modelo),
      qtde: e?.qtde ?? e?.quantidade ?? 1,
      azimute: s(e?.azimute) || "-",
      altura: s(e?.altura) || "-",
      largura: s(e?.largura) || "-",
      profundidade: s(e?.profundidade) || "-",
      rad_center: s(e?.rad_center ?? e?.radcenter),
      aev_sem_ca: s(e?.aev_sem_ca ?? e?.aevSemCa),
      ca: s(e?.ca) || "1.2",
      aev_com_ca: s(e?.aev_com_ca ?? e?.aevComCa),
    };
    if (!eq.tipo_equipamento && !eq.modelo) {
      log("warn", `Equipamento #${i + 1} veio sem tipo e sem modelo — pode ser linha de resumo da tabela.`);
    }
    return eq;
  });

  const dados: DadosPPI = {
    site_id_cliente: s(bruto.site_id_cliente),
    site_id_detentor: s(bruto.site_id_detentor),
    endereco: s(bruto.endereco),
    bairro: s(bruto.bairro),
    cidade: s(bruto.cidade),
    cep: s(bruto.cep),
    uf: s(bruto.uf).toUpperCase().slice(0, 2),
    latitude: s(bruto.latitude),
    longitude: s(bruto.longitude),
    altura_ev: s(bruto.altura_ev) || "60",
    data_rfi: s(bruto.data_rfi),
    rastreabilidade: {
      ...(typeof bruto?.rastreabilidade === "object" && bruto.rastreabilidade !== null ? bruto.rastreabilidade : {}),
      origem_site_id: s(bruto?.rastreabilidade?.origem_site_id),
      origem_altura_torre: s(bruto?.rastreabilidade?.origem_altura_torre),
      origem_equipamentos: s(bruto?.rastreabilidade?.origem_equipamentos),
    },
    equipamentos,
  };
  return dados;
}

/** Checa consistência dos dados e devolve avisos (não bloqueia nada). */
export function validarDados(d: DadosPPI): string[] {
  const avisos: string[] = [];
  if (!d.site_id_cliente && !d.site_id_detentor) avisos.push("Nenhum Site ID encontrado — confira o carimbo 'SITE:' no PDF.");
  if (d.latitude && !/^-?\d+([.,]\d+)?$/.test(d.latitude)) avisos.push(`Latitude "${d.latitude}" não parece grau decimal.`);
  if (d.longitude && !/^-?\d+([.,]\d+)?$/.test(d.longitude)) avisos.push(`Longitude "${d.longitude}" não parece grau decimal.`);
  if (d.cep && !/^\d{5}-?\d{3}$/.test(d.cep)) avisos.push(`CEP "${d.cep}" fora do formato 00000-000.`);
  if (d.uf && !/^[A-Z]{2}$/.test(d.uf)) avisos.push(`UF "${d.uf}" não é uma sigla de 2 letras.`);
  d.equipamentos.forEach((eq, i) => {
    const aev = String(eq.aev_sem_ca);
    if (aev && !/^\d+([.,]\d+)?$/.test(aev)) avisos.push(`Equip #${i + 1}: AEV s/CA "${aev}" não é numérico.`);
  });
  if (d.equipamentos.length === 0) avisos.push("Nenhum equipamento extraído — a tabela da página 3 pode estar em outro formato.");
  return avisos;
}

/* ------------------------------------------------------------------ */
/*  Chamadas à API                                                     */
/* ------------------------------------------------------------------ */

async function postGemini(url: string, payload: object, log: Logger): Promise<{ status: number; corpo: string }> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 150_000); // 2min e meio p/ PDFs grandes
  try {
    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: ctrl.signal,
    });
    return { status: resp.status, corpo: await resp.text() };
  } catch (e: any) {
    if (e?.name === "AbortError") throw new Error("Tempo esgotado (150s) aguardando o Gemini. PDF muito grande ou API lenta — tente um modelo Flash.");
    throw new Error(`Falha de rede ao contatar o Gemini: ${e?.message ?? e}. Verifique sua conexão/CORS.`);
  } finally {
    clearTimeout(timer);
  }
}

export async function extrairDoPdf(
  apiKey: string,
  modelo: string,
  arquivo: ArquivoInfo,
  log: Logger
): Promise<ResultadoGemini> {
  const inicio = performance.now();

  if (arquivo.tamanho > LIMITE_INLINE_MB * 1024 * 1024) {
    throw new Error(`PDF tem ${(arquivo.tamanho / 1024 / 1024).toFixed(1)}MB — o limite para envio direto é ${LIMITE_INLINE_MB}MB. Reduza o arquivo (ex: comprima as imagens) e tente de novo.`);
  }

  const payload = {
    contents: [
      {
        parts: [{ text: PROMPT_EXTRACAO }, { inline_data: { mime_type: arquivo.mime, data: arquivo.base64 } }],
      },
    ],
    generationConfig: { temperature: 0.1, maxOutputTokens: 8192 },
  };

  const rawRequest = JSON.stringify(
    { ...payload, contents: [{ parts: [{ text: PROMPT_EXTRACAO.slice(0, 220) + " …" }, { inline_data: { mime_type: arquivo.mime, data: `«base64 omitido — ${(arquivo.base64.length / 1024).toFixed(0)}KB»` } }] }] },
    null,
    2
  );
  log("info", `Payload montado: prompt (${PROMPT_EXTRACAO.length} chars) + PDF em base64 (${(arquivo.base64.length / 1024).toFixed(0)}KB, mime ${arquivo.mime}).`);

  const url = `${BASE}/models/${modelo}:generateContent?key=${encodeURIComponent(apiKey)}`;

  let corpo = "";
  let tentativas = 0;
  for (let tentativa = 1; tentativa <= MAX_TENTATIVAS_503; tentativa++) {
    tentativas = tentativa;
    log("info", tentativa === 1 ? `POST → ${modelo} …` : `Tentativa ${tentativa}/${MAX_TENTATIVAS_503} após 503 …`);
    const r = await postGemini(url, payload, log);
    if (r.status === 503 && tentativa < MAX_TENTATIVAS_503) {
      const espera = 4000 * tentativa;
      log("warn", `503 (sobrecarga). Aguardando ${espera / 1000}s antes de repetir…`);
      await dormir(espera);
      continue;
    }
    if (r.status !== 200) {
      log("error", `HTTP ${r.status}`, r.corpo.slice(0, 1200));
      const err: any = new Error(descreverErroHttp(r.status, r.corpo));
      err.raw = r.corpo;
      throw err;
    }
    corpo = r.corpo;
    log("ok", `HTTP 200 — resposta recebida (${(corpo.length / 1024).toFixed(1)}KB)${tentativa > 1 ? ` na ${tentativa}ª tentativa` : ""}.`);
    break;
  }

  let textoIA = "";
  try {
    const respJson = JSON.parse(corpo);
    const promptFeedback = respJson?.promptFeedback?.blockReason;
    if (promptFeedback) throw new Error(`Conteúdo bloqueado pelo filtro de segurança do Gemini: ${promptFeedback}.`);
    const cand = respJson?.candidates?.[0];
    if (!cand) throw new Error("Resposta sem 'candidates' — abra a aba 'Resposta bruta' para ver o que voltou.");
    if (cand.finishReason && cand.finishReason !== "STOP" && cand.finishReason !== "MAX_TOKENS") {
      log("warn", `finishReason: ${cand.finishReason}`);
    }
    textoIA = cand?.content?.parts?.map((p: any) => p?.text ?? "").join("") ?? "";
    if (!textoIA.trim()) throw new Error("A IA retornou texto vazio.");
  } catch (e: any) {
    if (e?.message?.startsWith("Conteúdo") || e?.message?.startsWith("Resposta") || e?.message?.startsWith("A IA")) throw e;
    throw new Error("Não foi possível ler o envelope da resposta do Gemini. Veja a aba 'Resposta bruta'.");
  }

  let jsonLimpo = "";
  try {
    jsonLimpo = limparJson(textoIA, log);
  } catch (e: any) {
    e.raw = corpo;
    throw e;
  }
  let bruto: any;
  try {
    bruto = JSON.parse(jsonLimpo);
    log("ok", "JSON parseado com sucesso.");
  } catch (e: any) {
    log("error", "JSON inválido mesmo após a limpeza", jsonLimpo.slice(0, 1500));
    const err: any = new Error(`A IA devolveu um JSON malformado (${e.message}). Tente novamente — ou copie o prompt e teste no AI Studio.`);
    err.raw = corpo;
    throw err;
  }

  const dados = normalizarDados(bruto, log);
  const duracaoMs = Math.round(performance.now() - inicio);
  return { dados, rawRequest, rawResponse: corpo, duracaoMs, tentativas };
}

/** Lista os modelos generateContent disponíveis para a chave. */
export async function listarModelos(apiKey: string): Promise<string[]> {
  const resp = await fetch(`${BASE}/models?key=${encodeURIComponent(apiKey)}`);
  const corpo = await resp.text();
  if (resp.status !== 200) throw new Error(descreverErroHttp(resp.status, corpo));
  const j = JSON.parse(corpo);
  const nomes: string[] = (j?.models ?? [])
    .filter((m: any) => Array.isArray(m?.supportedGenerationMethods) && m.supportedGenerationMethods.includes("generateContent"))
    .map((m: any) => String(m.name).replace(/^models\//, ""))
    .filter((n: string) => /gemini/.test(n));
  if (nomes.length === 0) throw new Error("Nenhum modelo Gemini encontrado para esta chave.");
  return nomes.sort().reverse();
}

/** Teste rápido: gera 8 tokens com o modelo escolhido. */
export async function testarConexao(apiKey: string, modelo: string): Promise<string> {
  const url = `${BASE}/models/${modelo}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const r = await postGemini(url, {
    contents: [{ parts: [{ text: 'Responda exatamente: OK' }] }],
    generationConfig: { maxOutputTokens: 8, temperature: 0 },
  }, () => {});
  if (r.status !== 200) throw new Error(descreverErroHttp(r.status, r.corpo));
  const j = JSON.parse(r.corpo);
  const texto = j?.candidates?.[0]?.content?.parts?.map((p: any) => p?.text ?? "").join("").trim();
  return texto || "OK";
}
