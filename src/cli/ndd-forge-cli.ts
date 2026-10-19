/**
 * NDD Forge — CLI (linha de comando) para uso headless pelo fly_automation.
 *
 * Roda EXATAMENTE o mesmo código do app web (extrairDoPdf → normalizarDados →
 * gerarNddPreenchido), sem navegador. É empacotado num único arquivo .mjs por
 * `npm run build:cli` (scripts/build-cli.mjs) e só precisa do Node.js para rodar.
 *
 * Uso:
 *   node ndd-forge-cli.mjs --pdf <PPI.pdf> --saida <pasta> [--tipo bts|collo]
 *        [--modelo gemini-3.5-flash-lite] [--data-rfi dd/mm/aaaa]
 *        [--template <arquivo.xlsx>] [--json <dados.json>] [--modo livre|schema] [--prompt-arquivo <prompt.txt>]
 *
 * --modo: igual ao seletor LIVRE/SCHEMA do app. "schema" envia o responseSchema do Gemini
 *         (montarSchemaResposta: campos fixos e citação literal antes de cada valor). Padrão: livre (= padrão de fábrica do app).
 *
 * Chaves (por variável de ambiente, nunca por argumento — argumentos aparecem
 * na lista de processos do Windows):
 *   GEMINI_API_KEY  (obrigatória)    GEMINI_MODEL (opcional, padrão do --modelo)
 *   QWEN_API_KEY    (opcional — fallback automático se o Gemini der 429/503)
 *
 * Contrato de saída:
 *   - stderr: log legível do pipeline (o mesmo log do console de debug do app)
 *   - stdout: UMA linha JSON no final, ex.:
 *       {"ok":true,"arquivo":"C:\\...\\[NDD] WINITY_....xlsx","avisos":[],"modelo":"...","dados":{...}}
 *       {"ok":false,"etapa":"extracao","erro":"..."}
 *   - exit code: 0 ok | 1 argumentos | 2 extração (IA) | 3 geração do Excel
 */

// mapping.ts lê o localStorage do navegador; no Node não existe → configuração de fábrica (CONFIG_PADRAO).
(globalThis as any).localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join, resolve, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { extrairDoPdf, validarDados } from "../lib/gemini";
import { carregarConfig, montarPromptFinal, montarSchemaResposta } from "../lib/mapping";
import { gerarNddPreenchido } from "../lib/excel";
import type { ConfigAutomacao, TipoProjeto } from "../types";

declare const __NDD_FORGE_VERSAO__: string; // injetado pelo build (commit git + data)

const VERSAO = typeof __NDD_FORGE_VERSAO__ !== "undefined" ? __NDD_FORGE_VERSAO__ : "dev";
const MODELO_PADRAO = "gemini-3.5-flash-lite";

function lerArgs(argv: string[]): Record<string, string> {
  const r: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) continue;
    const prox = argv[i + 1];
    if (prox === undefined || prox.startsWith("--")) r[a.slice(2)] = "true";
    else { r[a.slice(2)] = prox; i++; }
  }
  return r;
}

function responder(obj: Record<string, unknown>, codigo: number): never {
  process.stdout.write(JSON.stringify(obj) + "\n");
  process.exit(codigo);
}

async function main() {
  const args = lerArgs(process.argv.slice(2));
  if (args.versao) responder({ ok: true, versao: VERSAO }, 0);

  const pdf = args.pdf ? resolve(args.pdf) : "";
  const saida = args.saida ? resolve(args.saida) : "";
  const tipo: TipoProjeto = args.tipo === "collo" ? "collo" : "bts";
  const modelo = args.modelo || process.env.GEMINI_MODEL || MODELO_PADRAO;
  const modo = args.modo === "schema" ? "schema" : "livre";
  if (args.modo && args.modo !== "schema" && args.modo !== "livre") responder({ ok: false, etapa: "argumentos", erro: `--modo inválido: "${args.modo}" (use livre ou schema)` }, 1);
  const apiKey = (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || "").trim();

  if (!pdf || !existsSync(pdf)) responder({ ok: false, etapa: "argumentos", erro: `PDF não encontrado: "${args.pdf ?? ""}" (use --pdf)` }, 1);
  if (!saida) responder({ ok: false, etapa: "argumentos", erro: "Pasta de saída não informada (use --saida)" }, 1);
  if (!apiKey && !process.env.QWEN_API_KEY) responder({ ok: false, etapa: "argumentos", erro: "GEMINI_API_KEY não definida no ambiente" }, 1);

  // Template: --template explícito, senão templates/NDD-{tipo}.xlsx ao lado deste .mjs
  const dirCli = dirname(fileURLToPath(import.meta.url));
  const template = args.template ? resolve(args.template) : join(dirCli, "templates", `NDD-${tipo}.xlsx`);
  if (!existsSync(template)) responder({ ok: false, etapa: "argumentos", erro: `Template não encontrado: ${template}` }, 1);

  const log = (nivel: string, msg: string, detalhe?: string) => {
    process.stderr.write(`[NDD Forge][${nivel}] ${msg}\n`);
    if (detalhe && nivel === "error") process.stderr.write(`${detalhe}\n`);
  };
  log("info", `CLI versão ${VERSAO} | tipo=${tipo.toUpperCase()} | modo=${modo.toUpperCase()} | modelo=${modelo} | PDF=${basename(pdf)}`);

  // Mesma configuração que o app usa sem personalização (mapa de células, aliases, instruções BTS/COLLO)
  const cfg: ConfigAutomacao = { ...carregarConfig(), tipoProjeto: tipo, usarSchema: modo === "schema" };
  // --prompt-arquivo: só para testar um prompt candidato sem mexer no mapping.ts (o robô não usa)
  let prompt = montarPromptFinal(cfg, tipo);
  if (args["prompt-arquivo"]) {
    const arqPrompt = resolve(args["prompt-arquivo"]);
    if (!existsSync(arqPrompt)) responder({ ok: false, etapa: "argumentos", erro: `Arquivo de prompt não encontrado: ${arqPrompt}` }, 1);
    prompt = readFileSync(arqPrompt, "utf-8");
    log("warn", `Prompt substituído pelo arquivo ${basename(arqPrompt)} (${prompt.length} chars) — modo de teste.`);
  }

  // ---- 1. Extração (IA) ----
  let resultado;
  try {
    const buf = readFileSync(pdf);
    resultado = await extrairDoPdf(
      apiKey, modelo,
      { nome: basename(pdf), tamanho: buf.length, mime: "application/pdf", base64: buf.toString("base64") },
      prompt, cfg.aliasesColunas ?? [], log,
      {
        provedor: "gemini",
        qwenApiKey: process.env.QWEN_API_KEY,
        qwenModelo: process.env.QWEN_MODEL,
        fallbackAtivo: true,
        responseSchema: cfg.usarSchema ? montarSchemaResposta(cfg) : undefined, // mesma regra do App.tsx
      }
    );
  } catch (e: any) {
    responder({ ok: false, etapa: "extracao", erro: String(e?.message ?? e) }, 2);
  }

  const dados = { ...resultado.dados };
  if (args["data-rfi"]) dados.data_rfi = args["data-rfi"]; // no app vem do campo "Data do RFI" da tela
  const avisos = validarDados(dados);
  avisos.forEach((a) => log("warn", `Validação: ${a}`));
  if (args.json) writeFileSync(resolve(args.json), JSON.stringify(dados, null, 1), "utf-8");

  // ---- 2. Geração do Excel ----
  try {
    const tpl = readFileSync(template);
    const ab = tpl.buffer.slice(tpl.byteOffset, tpl.byteOffset + tpl.byteLength);
    const res = await gerarNddPreenchido(dados, cfg, ab as ArrayBuffer, log);
    mkdirSync(saida, { recursive: true });
    const caminho = join(saida, res.nomeArquivo);
    writeFileSync(caminho, Buffer.from(await res.blob.arrayBuffer()));
    log("ok", `Planilha gravada: ${caminho} (${res.celulasEscritas} células)`);
    responder({
      ok: true,
      arquivo: caminho,
      avisos,
      modelo: resultado.modeloUsado ?? modelo,
      modo,
      duracao_ms: resultado.duracaoMs,
      versao: VERSAO,
      dados,
    }, 0);
  } catch (e: any) {
    responder({ ok: false, etapa: "excel", erro: String(e?.message ?? e), avisos, dados }, 3);
  }
}

main().catch((e) => responder({ ok: false, etapa: "inesperado", erro: String(e?.stack ?? e) }, 2));
