import type { AliasColuna, ArquivoInfo, DadosPPI, LogLevel } from "../types";
import { limparJson, normalizarDados, type Logger, type ResultadoGemini } from "./gemini";

export const QWEN_BASE_DEFAULT = "https://maas.qwencloudapi.com/compatible-mode/v1";

export const MODELOS_QWEN = [
  "qwen3.8-flash",
  "qwen3.8-max",
  "qwen3.8-max-0902",
  "qwen-plus",
  "qwen-flash",
];

export const MODELO_QWEN_PADRAO = "qwen3.8-flash";

/** Resolve a URL base para chamadas ao QwenCloud (usando proxy local do Vite em dev se aplicável para evitar CORS) */
export function resolverUrlQwen(baseUrlCustom?: string): string {
  const custom = (baseUrlCustom || "").trim();
  if (custom) return custom.replace(/\/+$/, "");

  // Se estiver rodando no navegador local via Vite dev server, usa a rota de proxy
  if (
    typeof window !== "undefined" &&
    (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1")
  ) {
    return `${window.location.origin}/api/qwen`;
  }
  return QWEN_BASE_DEFAULT;
}

function descreverErroQwen(status: number, corpo: string): string {
  let detalhe = "";
  try {
    const j = JSON.parse(corpo);
    detalhe = j?.error?.message ? ` — ${j.error.message}` : "";
  } catch {
    /* corpo não-JSON */
  }

  switch (status) {
    case 400:
      return `Requisição inválida ao QwenCloud (400)${detalhe}. Verifique o modelo ou formato do PDF.`;
    case 401:
      return `Chave de API do QwenCloud inválida ou não autorizada (401)${detalhe}. Confira sua chave em home.qwencloud.com/api-keys.`;
    case 402:
      return `Saldo insuficiente ou cota esgotada no QwenCloud (402)${detalhe}. Acesse home.qwencloud.com para verificar sua cota/faturamento.`;
    case 403:
      return `Acesso negado no QwenCloud (403)${detalhe}.`;
    case 404:
      return `Modelo não encontrado no QwenCloud (404)${detalhe}. Verifique o nome do modelo.`;
    case 429:
      return `Limite de taxa/cota atingido no QwenCloud (429)${detalhe}. Aguarde alguns instantes.`;
    case 500:
    case 502:
      return `Erro interno nos servidores da Alibaba / QwenCloud (${status})${detalhe}. Tente novamente.`;
    case 503:
      return `QwenCloud temporariamente sobrecarregado (503)${detalhe}.`;
    default:
      return `QwenCloud HTTP ${status}${detalhe}`;
  }
}

/**
 * Realiza a extração do PPI enviando o PDF diretamente para o QwenCloud via API compatível com OpenAI.
 */
export async function extrairDoPdfQwen(
  apiKey: string,
  modelo: string,
  arquivo: ArquivoInfo,
  prompt: string,
  aliases: AliasColuna[],
  log: Logger,
  baseUrlCustom?: string
): Promise<ResultadoGemini> {
  const chaveLimpa = (apiKey || "").trim();
  if (!chaveLimpa) {
    throw new Error(
      "Chave da API QwenCloud não informada. Cole sua chave em 'Configurar API' (aba QwenCloud)."
    );
  }

  const inicio = performance.now();
  const urlBase = resolverUrlQwen(baseUrlCustom);
  const endpoint = `${urlBase}/chat/completions`;

  log(
    "info",
    `[QwenCloud] Preparando payload multimodal (PDF direto) para ${modelo} via ${urlBase}…`
  );

  // Formato compatível com OpenAI do QwenCloud com suporte nativo a PDF em Base64
  const payload = {
    model: modelo || MODELO_QWEN_PADRAO,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "file",
            file: {
              file_data: `data:application/pdf;base64,${arquivo.base64}`,
              filename: arquivo.nome || "documento.pdf",
            },
          },
          {
            type: "text",
            text: prompt,
          },
        ],
      },
    ],
    response_format: { type: "json_object" },
    temperature: 0.1,
  };

  const rawRequest = JSON.stringify(
    {
      ...payload,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "file",
              file: {
                file_data: `«base64 omitido — ${(arquivo.base64.length / 1024).toFixed(0)}KB»`,
                filename: arquivo.nome,
              },
            },
            {
              type: "text",
              text: prompt,
            },
          ],
        },
      ],
    },
    null,
    2
  );

  const ctrl = new AbortController();
  const timeoutId = setTimeout(() => ctrl.abort(), 180_000); // 3 minutos para PDFs complexos

  let corpo = "";
  let statusHttp = 0;

  try {
    log("info", `[QwenCloud] Enviando requisição POST para ${endpoint}…`);
    const resp = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${chaveLimpa}`,
      },
      body: JSON.stringify(payload),
      signal: ctrl.signal,
    });

    statusHttp = resp.status;
    corpo = await resp.text();
  } catch (err: any) {
    if (err?.name === "AbortError") {
      throw new Error("Tempo esgotado (180s) aguardando o QwenCloud. O arquivo pode ser muito grande ou a API está lenta.");
    }
    throw new Error(`Falha de conexão com QwenCloud: ${err?.message || err}.`);
  } finally {
    clearTimeout(timeoutId);
  }

  if (statusHttp !== 200) {
    log("error", `[QwenCloud] Erro HTTP ${statusHttp}`, corpo.slice(0, 1200));
    const erro: any = new Error(descreverErroQwen(statusHttp, corpo));
    erro.raw = corpo;
    throw erro;
  }

  log("ok", `[QwenCloud] HTTP 200 recebido (${(corpo.length / 1024).toFixed(1)}KB).`);

  let textoIA = "";
  try {
    const jsonResp = JSON.parse(corpo);
    textoIA = jsonResp?.choices?.[0]?.message?.content ?? "";
    if (!textoIA.trim()) {
      throw new Error("O QwenCloud retornou uma resposta sem texto.");
    }
  } catch (e: any) {
    const erro: any = new Error("Não foi possível ler a estrutura da resposta do QwenCloud.");
    erro.raw = corpo;
    throw erro;
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
    log("ok", "[QwenCloud] JSON parseado com sucesso.");
  } catch (e: any) {
    log("error", "[QwenCloud] JSON malformado", jsonLimpo.slice(0, 1500));
    const err: any = new Error(`A IA Qwen devolveu um JSON malformado: ${e.message}`);
    err.raw = corpo;
    throw err;
  }

  const dados: DadosPPI = normalizarDados(bruto, log, aliases);
  const duracaoMs = Math.round(performance.now() - inicio);

  return {
    dados,
    rawRequest,
    rawResponse: corpo,
    duracaoMs,
    tentativas: 1,
    modeloUsado: `Qwen (${modelo})`,
  };
}

/** Teste rápido de conectividade com a API do QwenCloud */
export async function testarConexaoQwen(
  apiKey: string,
  modelo: string,
  baseUrlCustom?: string
): Promise<string> {
  const chaveLimpa = (apiKey || "").trim();
  if (!chaveLimpa) {
    throw new Error("Chave de API do QwenCloud não informada.");
  }

  const urlBase = resolverUrlQwen(baseUrlCustom);
  const endpoint = `${urlBase}/chat/completions`;

  const payload = {
    model: modelo || MODELO_QWEN_PADRAO,
    messages: [{ role: "user", content: "Responda apenas: OK" }],
    max_tokens: 10,
    temperature: 0,
  };

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 20_000);

  try {
    const resp = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${chaveLimpa}`,
      },
      body: JSON.stringify(payload),
      signal: ctrl.signal,
    });

    const corpo = await resp.text();
    if (resp.status !== 200) {
      throw new Error(descreverErroQwen(resp.status, corpo));
    }

    const j = JSON.parse(corpo);
    const resposta = j?.choices?.[0]?.message?.content?.trim();
    return resposta || "OK";
  } catch (e: any) {
    if (e?.name === "AbortError") throw new Error("Tempo esgotado (20s) ao testar QwenCloud.");
    throw e;
  } finally {
    clearTimeout(timer);
  }
}
