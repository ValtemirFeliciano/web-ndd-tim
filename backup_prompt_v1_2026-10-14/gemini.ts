import type { AliasColuna, ArquivoInfo, DadosPPI, Equipamento, LogLevel, ProvedorIA } from "../types";
import { extrairDoPdfQwen } from "./qwen";

const BASE = "https://generativelanguage.googleapis.com/v1beta";
export const MODELO_FALLBACK_503 = "gemini-3.1-flash-lite";
// Backups quando o modelo escolhido dá 503 persistente. Só modelos atuais: a família 2.x foi
// descontinuada para novas contas (404 "no longer available to new users", jan/2026+), embora
// ainda apareça na listagem da API. Modelo que der erro é pulado (ver laço da cascata).
export const MODELOS_FALLBACK_CASCATA = [
  "gemini-3.1-flash-lite",
  "gemini-flash-lite-latest",
  "gemini-3.5-flash",
  "gemini-flash-latest",
];
export const MODELOS_PADRAO = [
  "gemini-3.5-flash-lite",
  "gemini-3.1-flash-lite",
  "gemini-flash-lite-latest",
  "gemini-2.5-flash-lite",
  "gemini-2.5-flash",
  "gemini-2.0-flash",
];
const MAX_TENTATIVAS_503 = 3;
const LIMITE_INLINE_MB = 18; // margem de segurança abaixo dos 20MB da API

export type Logger = (level: LogLevel, msg: string, detalhe?: string) => void;

export interface ResultadoGemini {
  dados: DadosPPI;
  rawRequest: string;
  rawResponse: string;
  duracaoMs: number;
  tentativas: number;
  modeloUsado?: string;
}

/* ------------------------------------------------------------------ */
/*  Helpers de diagnóstico                                             */
/* ------------------------------------------------------------------ */

/** Normaliza o identificador do modelo: remove prefixo 'models/' e garante o prefixo 'gemini-' se omitido */
export function normalizarNomeModelo(nome: string): string {
  let m = (nome || "").trim();
  if (m.startsWith("models/")) {
    m = m.replace(/^models\//, "");
  }
  // Se passou sem 'gemini-', como '2.5-flash-lite' ou '2.5-flash'
  if (/^\d+\.\d+/.test(m)) {
    m = `gemini-${m}`;
  }
  return m;
}

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
      return `Requisição inválida (400)${dicaApi}. Geralmente: formato de chave inválido, modelo inexistente ou PDF corrompido.`;
    case 401:
    case 403: {
      const msgBaixa = dicaApi.toLowerCase();
      if (msgBaixa.includes("unregistered callers")) {
        return `Chave de API não informada ou vazia (403)${dicaApi}. Insira sua chave em "Configurar API".`;
      }
      if (msgBaixa.includes("leaked")) {
        return `Chave de API bloqueada pelo Google por vazamento público (403)${dicaApi}. Gere uma nova chave em aistudio.google.com.`;
      }
      if (msgBaixa.includes("blocked") || msgBaixa.includes("permission_denied") || msgBaixa.includes("not been used")) {
        return `Acesso negado à API (403)${dicaApi}. Verifique se a 'Generative Language API' está ativada no seu Google Cloud Project ou se há restrições de IP/Referrer na chave.`;
      }
      return `Chave de API rejeitada ou sem permissão (${status})${dicaApi}. Confira em aistudio.google.com → Get API key.`;
    }
    case 404: {
      const msgBaixa = dicaApi.toLowerCase();
      if (msgBaixa.includes("no longer available to new users")) {
        return `Modelo descontinuado para novas contas (404)${dicaApi}. Conforme recomendação do Google, selecione "gemini-3.5-flash-lite" ou "gemini-3.1-flash-lite".`;
      }
      return `Modelo não encontrado (404)${dicaApi}. O nome do modelo mudou? Use "Listar modelos" para ver os ativos.`;
    }
    case 429:
      return `Cota/limite de requisições atingido (429)${dicaApi}. Aguarde ~1 minuto e tente de novo.`;
    case 500:
      return `Erro interno do Google (500)${dicaApi}. Tente novamente.`;
    case 503:
      return `Modelo sobrecarregado (503)${dicaApi}. O sistema tenta 3x sozinho e ativa fallback automático para ${MODELO_FALLBACK_503} — se persistir, aguarde 1 minuto.`;
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

/** Simplifica uma chave removendo acentos, pontuação e parênteses (ex: "AZIMUTE (°NV)" -> "azimute") */
export function simplificarChave(k: string): string {
  return k
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/\(.*?\)/g, "")
    .replace(/[^a-z0-9]/g, "")
    .trim();
}

/** Decompõe string de dimensões como "1400 x 320 x 145", "1.40 x 0.32 x 0.15" ou "600" */
export function decomporDimensoes(str: string): { comprimento?: string; largura?: string; profundidade?: string } | null {
  if (!str || typeof str !== "string") return null;
  const limpo = str.replace(/m/gi, "").replace(/,/g, ".").trim();
  const partes = limpo.split(/\s*[xX×*]\s*/).map((p) => parseFloat(p.trim())).filter((p) => !isNaN(p));
  if (partes.length === 0) return null;

  const fmt = (n: number) => {
    // Se for em milímetros (> 20), converte para metros dividindo por 1000
    const emMetros = n > 20 ? n / 1000 : n;
    // NÃO arredonda para 2 casas: preserva o valor exato (ex: 355mm -> 0,355m; 145mm -> 0,145m)
    const exato = parseFloat(emMetros.toFixed(4));
    return exato.toString().replace(".", ",");
  };

  if (partes.length >= 3) {
    return {
      comprimento: fmt(partes[0]),
      largura: fmt(partes[1]),
      profundidade: fmt(partes[2]),
    };
  } else if (partes.length === 2) {
    return {
      comprimento: fmt(partes[0]),
      largura: fmt(partes[1]),
    };
  } else if (partes.length === 1) {
    // Diâmetro único (ex: antena MW 600mm)
    return {
      profundidade: fmt(partes[0]),
    };
  }
  return null;
}

/** Aplica aliases para mapear nomes de colunas do PDF para o sistema com normalização semântica */
function aplicarAliases(obj: any, aliases: AliasColuna[], log: Logger, equipIndex: number): any {
  if (!obj || typeof obj !== "object") return obj;

  const resultado: Record<string, any> = {};
  const chavesOriginais = Object.keys(obj);

  // Mapeamento semântico canônico (todas as chaves em formato limpo por simplificarChave)
  const mapaCanonico: Record<string, string> = {
    // Tipo
    tipoequipamento: "tipo_equipamento",
    tipo: "tipo_equipamento",
    tipodeantena: "tipo_equipamento",
    tipoantena: "tipo_equipamento",
    tipodeequipamento: "tipo_equipamento",
    tipodoequipamento: "tipo_equipamento",
    tipoequip: "tipo_equipamento",
    antena: "tipo_equipamento",
    equipment: "tipo_equipamento",
    antennatype: "tipo_equipamento",

    // Modelo
    modelo: "modelo",
    model: "modelo",
    mod: "modelo",
    antennamodel: "modelo",

    // Quantidade
    qtde: "qtde",
    qtd: "qtde",
    qty: "qtde",
    quant: "qtde",
    quantidade: "qtde",

    // Azimute
    azimute: "azimute",
    az: "azimute",
    azim: "azimute",
    azimuth: "azimute",

    // Rad Center (cota de instalação na torre)
    radcenter: "rad_center",
    cota: "rad_center",
    cotainstalacao: "rad_center",

    // Dimensões individuais
    comprimento: "comprimento",
    length: "comprimento",
    height: "comprimento",
    alt: "comprimento",
    comp: "comprimento",
    c: "comprimento",
    largura: "largura",
    larg: "largura",
    width: "largura",
    l: "largura",
    profundidade: "profundidade",
    prof: "profundidade",
    depth: "profundidade",
    p: "profundidade",
    espessura: "profundidade",
    diametro: "profundidade",
    diam: "profundidade",

    // Dimensões compostas
    dimensoes: "dimensoes_compostas",
    dimensions: "dimensoes_compostas",
    dimensoesmm: "dimensoes_compostas",
    dimensoesm: "dimensoes_compostas",
    dimensoesaxlxp: "dimensoes_compostas",
    dimensao: "dimensoes_compostas",
    dim: "dimensoes_compostas",
    medidas: "dimensoes_compostas",
    medida: "dimensoes_compostas",

    // Arrasto e AEV
    ca: "ca",
    arrasto: "ca",
    aevsemca: "aev_sem_ca",
    aev: "aev_sem_ca",
    areadeexposicao: "aev_sem_ca",
    aevcomca: "aev_com_ca",
    areadeexposicaocomarrasto: "aev_com_ca",
    areacomarrasto: "aev_com_ca",

    // Citação obrigatória e página (Anti-Alucinação)
    trechocitadodopdf: "trecho_citado_do_pdf",
    trechocitado: "trecho_citado_do_pdf",
    trechooriginal: "trecho_citado_do_pdf",
    citacao: "trecho_citado_do_pdf",
    trechopdf: "trecho_citado_do_pdf",
    origemtrecho: "trecho_citado_do_pdf",
    quote: "trecho_citado_do_pdf",
    textocitado: "trecho_citado_do_pdf",
    pagina: "pagina",
    pag: "pagina",
    page: "pagina",
    folha: "pagina",
  };

  // 1. Processar chaves normalizadas
  for (const k of chavesOriginais) {
    const sKey = simplificarChave(k);
    let val = obj[k];

    // Limpar valores típicos (símbolos de grau etc)
    if (typeof val === "string") {
      val = val.trim();
      if (sKey === "azimute" || sKey === "az") {
        val = val.replace(/[°º\s]/g, "");
      }
    }

    // Caso especial: chave "ALTURA"
    // Se o valor for > 10 (ex: 50,0000m ou 48,0000m), é cota de instalação na torre (rad_center)
    if (sKey === "altura") {
      const numAlt = parseFloat(String(val).replace(",", "."));
      if (numAlt > 10 && numAlt < 250) {
        resultado["rad_center"] = val;
        log("info", `Equipamento #${equipIndex + 1}: cota na torre em ALTURA ("${val}") → rad_center`);
      } else {
        resultado["comprimento"] = val;
      }
      continue;
    }

    const destino = mapaCanonico[sKey];
    if (destino) {
      if (destino === "dimensoes_compostas" || (destino === "comprimento" && typeof val === "string" && /[xX×*\/]/.test(val))) {
        const decomposto = decomporDimensoes(val);
        if (decomposto) {
          if (decomposto.comprimento && (!resultado["comprimento"] || resultado["comprimento"] === "-")) resultado["comprimento"] = decomposto.comprimento;
          if (decomposto.largura && (!resultado["largura"] || resultado["largura"] === "-")) resultado["largura"] = decomposto.largura;
          if (decomposto.profundidade && (!resultado["profundidade"] || resultado["profundidade"] === "-")) resultado["profundidade"] = decomposto.profundidade;
          log("info", `Equipamento #${equipIndex + 1}: dimensões compostas "${val}" decompostas em comprimento/largura/profundidade`);
          continue;
        }
      }
      if (!resultado[destino] || resultado[destino] === "-") {
        resultado[destino] = val;
      }
    } else {
      resultado[sKey] = val;
    }
  }

  // 2. Aplicar aliases personalizados do usuário
  aliases.forEach((alias) => {
    const aliasSimples = simplificarChave(alias.aliasPdf);
    const campoSistema = alias.campoSistema.toLowerCase();
    if (resultado[campoSistema] === undefined || resultado[campoSistema] === "" || resultado[campoSistema] === "-") {
      for (const k of chavesOriginais) {
        if (simplificarChave(k) === aliasSimples) {
          resultado[campoSistema] = obj[k];
          log("info", `Equipamento #${equipIndex + 1}: alias personalizado "${alias.aliasPdf}" → "${campoSistema}"`);
          break;
        }
      }
    }
  });

  return resultado;
}

/** Preenche campos ausentes para o objeto ficar 100% compatível com o contrato. */
export function normalizarDados(bruto: any, log: Logger, aliases: AliasColuna[] = []): DadosPPI {
  const s = (v: any) => (v === null || v === undefined ? "" : String(v).trim());
  const eqBrutos: any[] = Array.isArray(bruto.equipamentos) ? bruto.equipamentos : [];
  if (!Array.isArray(bruto.equipamentos)) {
    log("warn", "O campo 'equipamentos' não veio como array — tratando como lista vazia.");
  }

  if (aliases.length > 0) {
    log("info", `Aplicando ${aliases.length} alias(es) de colunas para normalização...`);
  }

  const sDim = (v: any) => {
    const str = s(v);
    if (!str || str === "-") return "-";
    if (/[xX×*\/]/.test(str)) return str;
    const num = parseFloat(str.replace(",", "."));
    if (!isNaN(num)) {
      const emM = num > 20 ? num / 1000 : num;
      const exato = parseFloat(emM.toFixed(4));
      return exato.toString().replace(".", ",");
    }
    return str.replace(".", ",");
  };

  const sVirgula = (v: any) => {
    const str = s(v);
    if (!str || str === "-") return str || "-";
    return str.replace(".", ",");
  };

  const equipamentos: Equipamento[] = [];
  const temAlgumaCitacaoNoLote = eqBrutos.some((e: any) => {
    const rawQuote = e?.trecho_citado_do_pdf || e?.trecho_original || e?.trecho_citado || e?.citacao || "";
    return typeof rawQuote === "string" && rawQuote.trim().length > 3;
  });

  for (let i = 0; i < eqBrutos.length; i++) {
    const e = eqBrutos[i];
    const eComAliases = aplicarAliases(e, aliases, log, i);

    let tipoEquip = s(eComAliases?.tipo_equipamento).trim().toUpperCase();
    const modeloUpper = s(eComAliases?.modelo).toUpperCase().trim();
    const trechoCitado = s(
      eComAliases?.trecho_citado_do_pdf ||
      e?.trecho_citado_do_pdf ||
      eComAliases?.trecho_original ||
      e?.trecho_original ||
      e?.trecho_citado ||
      e?.citacao ||
      ""
    ).trim();

    const paginaRaw = eComAliases?.pagina ?? e?.pagina ?? 3;
    let paginaNum: number | string = 3;
    if (typeof paginaRaw === "number") {
      paginaNum = paginaRaw;
    } else {
      const matchNum = String(paginaRaw).replace(/\D/g, "");
      paginaNum = matchNum ? parseInt(matchNum, 10) : 3;
    }

    // 1. Verificação Anti-Alucinação:
    // Se a linha é completamente vazia ou fantasma (sem tipo e sem modelo)
    const semTipoNemModelo = (!tipoEquip || tipoEquip === "-") && (!eComAliases?.modelo || eComAliases?.modelo === "-");
    if (semTipoNemModelo) {
      log("warn", `[Anti-Alucinação] Linha #${i + 1} descartada: sem tipo nem modelo identificados.`);
      continue;
    }

    // Se o modelo é claramente cabeçalho ou resumo da tabela
    if (/^(TIPO|MODELO|ANTENA|CARREGAMENTO|TOTAL|RESUMO)/i.test(modeloUpper)) {
      log("warn", `[Anti-Alucinação] Linha #${i + 1} ("${eComAliases?.modelo}") descartada por ser cabeçalho ou resumo da tabela.`);
      continue;
    }

    // Se o lote contém citações obrigatórias mas este item NÃO tem citação ou tem citação nula/inválida
    const citacaoInvalida = /^(não|nao|nenhum|n\/a|null|undefined|vazio|-)$/i.test(trechoCitado);
    if (temAlgumaCitacaoNoLote && (!trechoCitado || citacaoInvalida)) {
      log("warn", `[Anti-Alucinação] Equipamento #${i + 1} ("${eComAliases?.modelo || tipoEquip}") DESCARTADO: modelo não comprovou o item com trecho literal do PDF.`);
      continue;
    }

    if (trechoCitado) {
      log("ok", `[Anti-Alucinação] Equipamento #${i + 1} ("${eComAliases?.modelo || tipoEquip}") comprovado no PDF (Pág. ${paginaNum}): "${trechoCitado.slice(0, 60)}${trechoCitado.length > 60 ? "…" : ""}"`);
    }

    // Normalização apenas para variações de grafia de Micro-ondas / Parábola:
    if (["MICROONDAS", "MICRO-ONDAS", "MICRO ONDAS", "PARABOLA", "PARABÓLICA"].includes(tipoEquip)) {
      tipoEquip = "MW";
    }

    // Se o tipo_equipamento ficou vazio ou "-", verificar se veio em alguma chave com valor conhecido ou inferir por modelo
    if (!tipoEquip || tipoEquip === "-") {
      // 1. Procura se algum valor do objeto retornado é "MODULO", "RF", "MW", "GPS", "TMA", "ODU" ou "RRU"
      for (const [k, v] of Object.entries(e ?? {})) {
        if (typeof v === "string" && ["MODULO", "RF", "MW", "GPS", "TMA", "ODU", "RRU"].includes(v.trim().toUpperCase())) {
          tipoEquip = v.trim().toUpperCase();
          log("info", `Equipamento #${i + 1}: tipo recuperado da chave "${k}" ("${v}") → tipo_equipamento`);
          break;
        }
      }
      // 2. Se ainda estiver vazio, infere pelo modelo apenas quando não houver tipo explícito no PPI
      if (!tipoEquip || tipoEquip === "-") {
        if (modeloUpper.includes("RRU")) {
          tipoEquip = "RRU";
          log("info", `Equipamento #${i + 1}: modelo "${eComAliases?.modelo}" identificado como RRU → tipo_equipamento definido como "RRU"`);
        } else if (/M[OÓ]DULO/i.test(modeloUpper)) {
          tipoEquip = "MODULO";
          log("info", `Equipamento #${i + 1}: modelo "${eComAliases?.modelo}" identificado como MODULO → tipo_equipamento definido como "MODULO"`);
        } else if (modeloUpper.includes("ODU") || modeloUpper.includes("SR2D") || modeloUpper.includes("SR2-D")) {
          tipoEquip = "ODU";
          log("info", `Equipamento #${i + 1}: modelo "${eComAliases?.modelo}" identificado como ODU → tipo_equipamento definido como "ODU"`);
        }
      }
    }

    const eq: Equipamento = {
      tipo_equipamento: tipoEquip,
      modelo: s(eComAliases?.modelo),
      qtde: eComAliases?.qtde ?? 1,
      azimute: s(eComAliases?.azimute) || "-",
      comprimento: sDim(eComAliases?.comprimento),
      largura: sDim(eComAliases?.largura),
      profundidade: sDim(eComAliases?.profundidade),
      rad_center: sVirgula(eComAliases?.rad_center),
      aev_sem_ca: sVirgula(eComAliases?.aev_sem_ca),
      ca: sVirgula(eComAliases?.ca) || "-",
      aev_com_ca: sVirgula(eComAliases?.aev_com_ca),
      trecho_citado_do_pdf: trechoCitado,
      pagina: paginaNum,
    };

    // 1. Se comprimento contiver string com múltiplos valores (ex: "2500 x 355 x 192" ou "1400x320x145"):
    if (eq.comprimento && /[xX×*\/]/.test(eq.comprimento)) {
      const dec = decomporDimensoes(eq.comprimento);
      if (dec) {
        if (dec.comprimento) eq.comprimento = dec.comprimento;
        if (dec.largura) eq.largura = dec.largura;
        if (dec.profundidade) eq.profundidade = dec.profundidade;
        log("info", `Equipamento #${i + 1}: string composta em comprimento decomposta com sucesso`);
      }
    }

    // 2. Se largura ou profundidade continuarem vazias ("-"), varre todas as chaves procurando string composta:
    if (!eq.profundidade || eq.profundidade === "-" || !eq.largura || eq.largura === "-") {
      const todosCampos = { ...(e ?? {}), ...(eComAliases ?? {}) };
      for (const [k, v] of Object.entries(todosCampos)) {
        if (typeof v === "string" && /[xX×*\/]/.test(v)) {
          const dec = decomporDimensoes(v);
          if (dec && (dec.comprimento || dec.profundidade)) {
            if ((!eq.comprimento || eq.comprimento === "-") && dec.comprimento) eq.comprimento = dec.comprimento;
            if ((!eq.largura || eq.largura === "-") && dec.largura) eq.largura = dec.largura;
            if ((!eq.profundidade || eq.profundidade === "-") && dec.profundidade) eq.profundidade = dec.profundidade;
            log("info", `Equipamento #${i + 1}: dimensões recuperadas do campo "${k}" ("${v}")`);
            break;
          }
        }
      }
    }

    // 3. Regra específica para antenas MW (Micro-ondas / Parábolas):
    // A dimensão física é o diâmetro da parábola e deve SEMPRE ficar na coluna Profundidade (Prof.),
    // e as colunas Comprimento e Largura devem ficar como "-".
    const tipoUpper = (eq.tipo_equipamento || "").toUpperCase().trim();
    const isMW = tipoUpper !== "ODU" && tipoUpper !== "RRU" && (
                 tipoUpper === "MW" ||
                 tipoUpper.includes("MW") ||
                 tipoUpper.includes("MICROONDAS") ||
                 tipoUpper.includes("MICRO-ONDAS") ||
                 tipoUpper.includes("MICRO ONDAS") ||
                 tipoUpper.includes("PARABOL") ||
                 tipoUpper.includes("ENLACE") ||
                 modeloUpper.includes("MW") ||
                 modeloUpper.includes("MINI-LINK") ||
                 modeloUpper.includes("MINILINK") ||
                 modeloUpper.includes("PARABOL")
    );

    if (isMW) {
      // Captura o diâmetro de qualquer campo onde tenha sido extraído (profundidade, comprimento ou largura)
      let diametro = "-";
      if (eq.profundidade && eq.profundidade !== "-") {
        diametro = eq.profundidade;
      } else if (eq.comprimento && eq.comprimento !== "-") {
        diametro = eq.comprimento;
      } else if (eq.largura && eq.largura !== "-") {
        diametro = eq.largura;
      } else {
        const todosCampos = { ...(e ?? {}), ...(eComAliases ?? {}) };
        for (const [k, v] of Object.entries(todosCampos)) {
          const sK = simplificarChave(k);
          if (sK.includes("dimens") || sK.includes("diam") || sK.includes("medid") || sK.includes("tam")) {
            const dec = decomporDimensoes(String(v));
            if (dec?.profundidade) {
              diametro = dec.profundidade;
              break;
            }
          }
        }
      }

      eq.profundidade = diametro;
      eq.comprimento = "-";
      eq.largura = "-";

      if (diametro !== "-") {
        log("info", `Equipamento #${i + 1} (${eq.tipo_equipamento}): diâmetro "${diametro}" posicionado na coluna Profundidade (Comprimento e Largura = "-")`);
      }
    }

    // 3.1. Proteção de Azimute para equipamentos sem azimute direcionado (RRU, ODU, GPS, MODULO):
    // Se a IA leu a 3ª dimensão (profundidade em mm) como azimute (ex: 120, 84, 100):
    if (["RRU", "ODU", "GPS", "MODULO"].includes(tipoUpper) && eq.azimute && eq.azimute !== "-") {
      const azTrim = String(eq.azimute).trim();
      const profNum = parseFloat(String(eq.profundidade || "").replace(",", "."));
      const profMm = !isNaN(profNum) && profNum < 2 ? Math.round(profNum * 1000).toString() : String(eq.profundidade || "").trim();
      const rawAz = String(eComAliases?.azimute || "").trim();
      // Se azimute for igual à profundidade ou se for equipamento não-direcional sem indicação de graus ou setores
      if (azTrim === profMm || azTrim === String(eComAliases?.profundidade).trim() || !(/[°º\/]/.test(rawAz))) {
        log("info", `Equipamento #${i + 1} (${eq.tipo_equipamento}): azimute "${eq.azimute}" corrigido para "-" (equipamento sem azimute direcionado no PPI)`);
        eq.azimute = "-";
      }
    }

    // 4. Sanity Check para AEV sem CA e AEV com CA:
    // Pela física da engenharia de estruturas, AEV com CA = AEV sem CA * CA (onde CA >= 1.0).
    // Se a IA confundiu o dígito '0.' com '6.' na leitura óptica (ex: "6.17" em vez de "0.172"):
    if (eq.aev_sem_ca && eq.aev_com_ca) {
      const numSem = parseFloat(String(eq.aev_sem_ca).replace(",", "."));
      const numCom = parseFloat(String(eq.aev_com_ca).replace(",", "."));
      if (!isNaN(numSem) && !isNaN(numCom) && numCom > 0 && numSem > numCom * 1.5) {
        if (String(eq.aev_sem_ca).startsWith("6.") && numCom < 1.0) {
          const corrigido = "0." + String(eq.aev_sem_ca).slice(2);
          log("warn", `Equipamento #${i + 1}: OCR corrigido para AEV s/CA ("${eq.aev_sem_ca}" → "${corrigido}") baseado em AEV c/CA ("${eq.aev_com_ca}")`);
          eq.aev_sem_ca = corrigido;
        }
      }
    }

    equipamentos.push(eq);
  }

  // 1. Extração e validação Anti-Alucinação da Localização (Carimbo):
  const trechoLocalizacao = s(
    bruto?.trecho_citado_localizacao ||
    bruto?.trecho_citado_endereco ||
    bruto?.trecho_carimbo ||
    bruto?.rastreabilidade?.origem_localizacao ||
    bruto?.origem_localizacao ||
    ""
  ).trim();

  let pagLocalizacao: number | string = bruto?.pagina_localizacao ?? 1;
  if (typeof pagLocalizacao === "string") {
    const num = parseInt(pagLocalizacao.replace(/\D/g, ""), 10);
    pagLocalizacao = !isNaN(num) && num > 0 ? num : 1;
  }

  if (trechoLocalizacao && !/^(não|nao|nenhum|n\/a|null|undefined|-)$/i.test(trechoLocalizacao)) {
    log("ok", `[Anti-Alucinação] Localização comprovada no carimbo (Pág. ${pagLocalizacao}): "${trechoLocalizacao.slice(0, 70)}${trechoLocalizacao.length > 70 ? "…" : ""}"`);
  }

  // 2. Extração e validação Anti-Alucinação da Base de Concreto (Legenda Civil):
  const trechoBase = s(
    bruto?.trecho_citado_base ||
    bruto?.trecho_citado_base_concreto ||
    bruto?.trecho_base ||
    bruto?.rastreabilidade?.base_em_concreto ||
    bruto?.origem_base ||
    ""
  ).trim();

  let pagBase: number | string = bruto?.pagina_base ?? 2;
  if (typeof pagBase === "string") {
    const num = parseInt(pagBase.replace(/\D/g, ""), 10);
    pagBase = !isNaN(num) && num > 0 ? num : 2;
  }

  let nxBaseFinal = s(bruto.nx_base);
  let diBaseFinal = s(bruto.di_base);

  // Verificação Anti-Alucinação para Base de Concreto:
  // Se o LLM preencheu di_base ou nx_base, mas:
  // a) O trecho citado está vazio ou diz "nenhum" / "N/A"
  // b) O trecho citado menciona termos proibidos (haste de aterramento, gradil, projeção futura) e NÃO menciona base/concreto
  const baseSemCitacao = !trechoBase || /^(não|nao|nenhum|n\/a|null|undefined|inexistente|-)$/i.test(trechoBase);
  const baseAlucinadaDeOutrosElementos = (
    /haste|aterramento|gradil|cerca|expans[aã]o|recuo/i.test(trechoBase) &&
    !/base.*concreto|base.*implant|base.*equipamento/i.test(trechoBase)
  );

  if ((diBaseFinal || nxBaseFinal) && (baseSemCitacao || baseAlucinadaDeOutrosElementos)) {
    const motivo = baseAlucinadaDeOutrosElementos
      ? `o trecho citado refere-se a aterramento/gradil/expansão ("${trechoBase}") e não à base civil`
      : "nenhum trecho da legenda civil comprovou base a implantar";
    log("warn", `[Anti-Alucinação] Base de concreto descartada (${diBaseFinal || "nx=" + nxBaseFinal}): ${motivo}.`);
    diBaseFinal = "";
    nxBaseFinal = "";
  } else if (trechoBase && !baseSemCitacao) {
    log("ok", `[Anti-Alucinação] Base de concreto comprovada na legenda civil (Pág. ${pagBase}): "${trechoBase.slice(0, 70)}${trechoBase.length > 70 ? "…" : ""}"`);
  }

  const dados: DadosPPI = {
    site_id_cliente: s(bruto.site_id_cliente),
    site_id_detentor: s(bruto.site_id_detentor),
    data_rfi: s(bruto.data_rfi),
    data_emissao: s(bruto.data_emissao),
    endereco: s(bruto.endereco),
    bairro: s(bruto.bairro),
    cidade: s(bruto.cidade),
    cep: s(bruto.cep),
    uf: s(bruto.uf).toUpperCase().slice(0, 2),
    latitude: s(bruto.latitude),
    longitude: s(bruto.longitude),
    altura_ev: s(bruto.altura_ev) || "60",
    nx_base: nxBaseFinal,
    di_base: diBaseFinal,
    trecho_citado_localizacao: trechoLocalizacao,
    pagina_localizacao: pagLocalizacao,
    trecho_citado_base: trechoBase,
    pagina_base: pagBase,
    rastreabilidade: {
      ...(typeof bruto?.rastreabilidade === "object" && bruto.rastreabilidade !== null ? bruto.rastreabilidade : {}),
      origem_site_id: s(bruto?.rastreabilidade?.origem_site_id),
      origem_altura_torre: s(bruto?.rastreabilidade?.origem_altura_torre),
      origem_equipamentos: s(bruto?.rastreabilidade?.origem_equipamentos),
    },
    equipamentos,
  };

  // campos personalizados (adicionados pelo usuário na página de Configuração)
  const FIXOS = new Set([
    "site_id_cliente", "site_id_detentor", "data_rfi", "data_emissao", "endereco", "bairro", "cidade", "cep", "uf",
    "latitude", "longitude", "altura_ev", "nx_base", "di_base", "rastreabilidade", "equipamentos",
    "trecho_citado_localizacao", "pagina_localizacao", "trecho_citado_base", "pagina_base",
  ]);
  const extras: Record<string, string> = {};
  Object.keys(bruto ?? {}).forEach((k) => {
    if (FIXOS.has(k)) return;
    const v = bruto[k];
    if (v !== null && v !== undefined && typeof v !== "object") extras[k] = s(v);
  });
  if (Object.keys(extras).length > 0) {
    dados.extras = extras;
    log("info", `Campo(s) personalizado(s) capturado(s): ${Object.keys(extras).join(", ")}.`);
  }

  // Log específico para campos de base de concreto
  if (dados.nx_base || dados.di_base) {
    log("info", `Base de concreto extraída: nx_base="${dados.nx_base}", di_base="${dados.di_base}"`);
  }

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
  const semCitacao = d.equipamentos.filter((eq) => !eq.trecho_citado_do_pdf);
  if (semCitacao.length > 0 && d.equipamentos.length > semCitacao.length) {
    avisos.push(`${semCitacao.length} equipamento(s) sem citação literal do PDF — confira a página 3.`);
  }
  if (d.di_base && !d.trecho_citado_base) {
    avisos.push(`Base de concreto (${d.di_base}) sem citação comprobatória da legenda civil.`);
  }
  if ((d.endereco || d.latitude) && !d.trecho_citado_localizacao) {
    avisos.push("Localização sem citação literal do carimbo.");
  }
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

export interface OpcoesFallbackIA {
  provedor?: ProvedorIA;
  qwenApiKey?: string;
  qwenModelo?: string;
  qwenBaseUrl?: string;
  fallbackAtivo?: boolean;
  /** responseSchema do Gemini (montarSchemaResposta). Só enviado com o modo "Schema" ligado. Ignorado pelo QwenCloud. */
  responseSchema?: Record<string, unknown>;
}

export async function extrairDoPdf(
  apiKey: string,
  modelo: string,
  arquivo: ArquivoInfo,
  prompt: string,
  aliases: AliasColuna[],
  log: Logger,
  opcoesFallback?: OpcoesFallbackIA
): Promise<ResultadoGemini> {
  const chaveLimpa = (apiKey || "").trim();
  const qwenChaveLimpa = (opcoesFallback?.qwenApiKey || "").trim();
  const usarQwenDireto = opcoesFallback?.provedor === "qwen";

  // Se o provedor configurado for o QwenCloud diretamente:
  if (usarQwenDireto) {
    if (!qwenChaveLimpa) {
      throw new Error(
        "Chave da API QwenCloud não configurada. Clique em 'Configurar API' e insira sua chave sk-…"
      );
    }
    try {
      return await extrairDoPdfQwen(
        qwenChaveLimpa,
        opcoesFallback?.qwenModelo || "qwen3.8-flash",
        arquivo,
        prompt,
        aliases,
        log,
        opcoesFallback?.qwenBaseUrl
      );
    } catch (errQwen: any) {
      if (chaveLimpa && opcoesFallback?.fallbackAtivo !== false) {
        log(
          "warn",
          `[Fallback IA] Falha no QwenCloud (${errQwen.message}). Ativando fallback automático para o Google Gemini (${modelo})…`
        );
      } else {
        throw errQwen;
      }
    }
  }

  // Execução via Google Gemini (com cascata de modelos e fallback para Qwen se necessário)
  if (!chaveLimpa) {
    throw new Error("Chave de API do Gemini não configurada. Clique em 'Configurar API' e insira sua chave do Google AI Studio.");
  }

  const inicio = performance.now();

  if (arquivo.tamanho > LIMITE_INLINE_MB * 1024 * 1024) {
    throw new Error(`PDF tem ${(arquivo.tamanho / 1024 / 1024).toFixed(1)}MB — o limite para envio direto é ${LIMITE_INLINE_MB}MB. Reduza o arquivo (ex: comprima as imagens) e tente de novo.`);
  }

  const payload = {
    contents: [
      {
        parts: [{ text: prompt }, { inline_data: { mime_type: arquivo.mime, data: arquivo.base64 } }],
      },
    ],
    // responseMimeType: o Gemini devolve JSON puro e válido (sem crases ```json nem texto em volta)
    generationConfig: {
      temperature: 0.1,
      maxOutputTokens: 8192,
      responseMimeType: "application/json",
      // responseSchema: campos fixos — o Gemini só devolve as chaves e tipos declarados
      ...(opcoesFallback?.responseSchema ? { responseSchema: opcoesFallback.responseSchema } : {}),
    },
  };
  log("info", opcoesFallback?.responseSchema
    ? "Modo de resposta: SCHEMA (campos fixos, citação antes do valor)."
    : "Modo de resposta: LIVRE (JSON sem schema).");

  const rawRequest = JSON.stringify(
    { ...payload, contents: [{ parts: [{ text: prompt }, { inline_data: { mime_type: arquivo.mime, data: `«base64 omitido — ${(arquivo.base64.length / 1024).toFixed(0)}KB»` } }] }] },
    null,
    2
  );
  log("info", `Payload montado: prompt (${prompt.length} chars) + PDF em base64 (${(arquivo.base64.length / 1024).toFixed(0)}KB, mime ${arquivo.mime}).`);

  let modeloAtual = normalizarNomeModelo(modelo);
  let corpo = "";
  let tentativasTotal = 0;

  const tentarComModelo = async (mod: string, isFallback: boolean): Promise<boolean> => {
    const modNorm = normalizarNomeModelo(mod);
    const url = `${BASE}/models/${encodeURIComponent(modNorm)}:generateContent?key=${encodeURIComponent(chaveLimpa)}`;
    for (let tentativa = 1; tentativa <= MAX_TENTATIVAS_503; tentativa++) {
      tentativasTotal++;
      log(
        "info",
        tentativa === 1
          ? `POST → ${modNorm}${isFallback ? " (fallback ativo)" : ""} …`
          : `Tentativa ${tentativa}/${MAX_TENTATIVAS_503} em ${modNorm} após 503 …`
      );
      const r = await postGemini(url, payload, log);
      if (r.status === 503) {
        if (tentativa < MAX_TENTATIVAS_503) {
          const espera = 3000 * tentativa;
          log("warn", `503 (sobrecarga em ${mod}). Aguardando ${espera / 1000}s antes de repetir (${tentativa}/${MAX_TENTATIVAS_503})…`);
          await dormir(espera);
          continue;
        } else {
          log("warn", `503 (sobrecarga) persistiu por ${MAX_TENTATIVAS_503} tentativas consecutivas em ${mod}.`);
          return false;
        }
      }
      if (r.status !== 200) {
        log("error", `HTTP ${r.status}`, r.corpo.slice(0, 1200));
        const err: any = new Error(descreverErroHttp(r.status, r.corpo));
        err.raw = r.corpo;
        throw err;
      }
      corpo = r.corpo;
      log("ok", `HTTP 200 — resposta recebida de ${mod} (${(corpo.length / 1024).toFixed(1)}KB)${tentativa > 1 ? ` na ${tentativa}ª tentativa` : ""}.`);
      return true;
    }
    return false;
  };

  let sucessoPrimario = false;
  try {
    sucessoPrimario = await tentarComModelo(modeloAtual, false);
  } catch (errPrimario: any) {
    const msgBaixa = String(errPrimario?.message || "").toLowerCase();
    if (
      (msgBaixa.includes("429") || msgBaixa.includes("cota") || msgBaixa.includes("quota")) &&
      qwenChaveLimpa &&
      opcoesFallback?.fallbackAtivo !== false
    ) {
      log(
        "warn",
        `[Fallback IA] Limite de cota atingido no Gemini (429). Ativando fallback automático para QwenCloud (${opcoesFallback?.qwenModelo || "qwen3.8-flash"})…`
      );
      return await extrairDoPdfQwen(
        qwenChaveLimpa,
        opcoesFallback?.qwenModelo || "qwen3.8-flash",
        arquivo,
        prompt,
        aliases,
        log,
        opcoesFallback?.qwenBaseUrl
      );
    }
    throw errPrimario;
  }

  if (!sucessoPrimario) {
    let sucessoCascata = false;
    const modelosCascata = MODELOS_FALLBACK_CASCATA.filter(
      (m) => normalizarNomeModelo(m) !== modeloAtual
    );

    for (const modFb of modelosCascata) {
      log("warn", `Erro 503 persistiu em "${modeloAtual}". Acionando modelo da cascata do Gemini: "${modFb}"…`);
      modeloAtual = modFb;
      try {
        sucessoCascata = await tentarComModelo(modeloAtual, true);
      } catch (errFb: any) {
        // Modelo de backup indisponível (ex.: 404 de modelo descontinuado): tenta o próximo da cascata
        // em vez de abortar a extração — o modelo principal só falhou por sobrecarga (503).
        log("warn", `Modelo de backup "${modFb}" indisponível (${String(errFb?.message ?? errFb).slice(0, 120)}). Tentando o próximo…`);
        sucessoCascata = false;
      }
      if (sucessoCascata) break;
    }

    if (!sucessoCascata) {
      if (qwenChaveLimpa && opcoesFallback?.fallbackAtivo !== false) {
        log(
          "warn",
          `[Fallback IA] Todos os modelos Gemini estão sobrecarregados (503). Ativando fallback automático para QwenCloud (${opcoesFallback?.qwenModelo || "qwen3.8-flash"})…`
        );
        return await extrairDoPdfQwen(
          qwenChaveLimpa,
          opcoesFallback?.qwenModelo || "qwen3.8-flash",
          arquivo,
          prompt,
          aliases,
          log,
          opcoesFallback?.qwenBaseUrl
        );
      }

      const msg = `O modelo ${modelo} e os modelos de backup do Gemini estão sobrecarregados (503 persistente). Configure uma chave QwenCloud para fallback automático ou tente novamente mais tarde.`;
      log("error", msg);
      throw new Error(msg);
    }
  }


  let textoIA = "";
  try {
    const respJson = JSON.parse(corpo);
    const promptFeedback = respJson?.promptFeedback?.blockReason;
    if (promptFeedback) throw new Error(`Conteúdo bloqueado pelo filtro de segurança do Gemini: ${promptFeedback}.`);
    const cand = respJson?.candidates?.[0];
    if (!cand) throw new Error("Resposta sem 'candidates' — abra a aba 'Resposta bruta' para ver o que voltou.");
    // MAX_TOKENS = a resposta foi cortada no limite de tamanho: o JSON veio incompleto (equipamentos faltando)
    if (cand.finishReason === "MAX_TOKENS") {
      throw new Error("A resposta da IA foi cortada no limite de tamanho (MAX_TOKENS) — o JSON veio incompleto e equipamentos poderiam ficar de fora. Tente novamente ou use outro modelo.");
    }
    if (cand.finishReason && cand.finishReason !== "STOP") {
      log("warn", `finishReason: ${cand.finishReason}`);
    }
    textoIA = cand?.content?.parts?.map((p: any) => p?.text ?? "").join("") ?? "";
    if (!textoIA.trim()) throw new Error("A IA retornou texto vazio.");
  } catch (e: any) {
    if (e?.message?.startsWith("Conteúdo") || e?.message?.startsWith("Resposta") || e?.message?.startsWith("A IA") || e?.message?.startsWith("A resposta da IA")) throw e;
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

  const dados = normalizarDados(bruto, log, aliases);
  const duracaoMs = Math.round(performance.now() - inicio);
  return { dados, rawRequest, rawResponse: corpo, duracaoMs, tentativas: tentativasTotal, modeloUsado: modeloAtual };
}

/** Lista os modelos generateContent disponíveis para a chave. */
export async function listarModelos(apiKey: string): Promise<string[]> {
  const chaveLimpa = (apiKey || "").trim();
  if (!chaveLimpa) {
    throw new Error("Chave de API não informada. Cole sua chave do Google AI Studio em 'Configurar API'.");
  }
  const resp = await fetch(`${BASE}/models?key=${encodeURIComponent(chaveLimpa)}`);
  const corpo = await resp.text();
  if (resp.status !== 200) throw new Error(descreverErroHttp(resp.status, corpo));
  const j = JSON.parse(corpo);
  const nomes: string[] = (j?.models ?? [])
    .filter((m: any) => Array.isArray(m?.supportedGenerationMethods) && m.supportedGenerationMethods.includes("generateContent"))
    .map((m: any) => normalizarNomeModelo(String(m.name)))
    .filter((n: string) => /gemini/.test(n));
  if (nomes.length === 0) throw new Error("Nenhum modelo Gemini encontrado para esta chave.");
  return Array.from(new Set(nomes)).sort().reverse();
}

/** Teste rápido: gera 8 tokens com o modelo escolhido. */
export async function testarConexao(apiKey: string, modelo: string): Promise<string> {
  const chaveLimpa = (apiKey || "").trim();
  if (!chaveLimpa) {
    throw new Error("Chave de API não informada. Cole sua chave do Google AI Studio em 'Configurar API'.");
  }
  const modNorm = normalizarNomeModelo(modelo);
  const url = `${BASE}/models/${encodeURIComponent(modNorm)}:generateContent?key=${encodeURIComponent(chaveLimpa)}`;
  const r = await postGemini(url, {
    contents: [{ parts: [{ text: 'Responda exatamente: OK' }] }],
    generationConfig: { maxOutputTokens: 8, temperature: 0 },
  }, () => {});
  if (r.status !== 200) throw new Error(descreverErroHttp(r.status, r.corpo));
  const j = JSON.parse(r.corpo);
  const texto = j?.candidates?.[0]?.content?.parts?.map((p: any) => p?.text ?? "").join("").trim();
  return texto || "OK";
}
