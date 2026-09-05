import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Braces, Copy, Download, FileDown, FileJson2, Radar, Sparkles } from "lucide-react";
import Header, { type TesteState } from "./components/Header";
import UploadZones, { formatarBytes } from "./components/UploadZones";
import ExtractionPanel from "./components/ExtractionPanel";
import DebugConsole from "./components/DebugConsole";
import ConfigPage from "./components/ConfigPage";
import { extrairDoPdf, listarModelos, testarConexao, validarDados, MODELOS_PADRAO } from "./lib/gemini";
import { gerarNddPreenchido, baixarBlob } from "./lib/excel";
import { carregarConfig, salvarConfig, montarPromptFinal } from "./lib/mapping";
import {
  EQUIPAMENTO_VAZIO,
  type ArquivoInfo, type ConfigAutomacao, type DadosPPI, type Equipamento, type LogEntry, type LogLevel,
  type ResultadoExtracao, type StepId, type StepStatus, type TemplateInfo,
} from "./types";

const LS_CONFIG = "nddforge.config.v1";
const LS_ULTIMA = "nddforge.ultima.v1";

const STEPS_INICIAIS: Record<StepId, StepStatus> = {
  arquivo: "idle", gemini: "idle", parse: "idle", validacao: "idle",
};

const JSON_EXEMPLO = `{
  "site_id_cliente": "SN-RRRSI4",
  "site_id_detentor": "MSRBS006_A",
  "endereco": "Rodovia BR-116, km 42",
  "latitude": "-22.906847",
  "altura_ev": "60",
  "equipamentos": [
    { "tipo_equipamento": "ANTENA", "modelo": "TQB-656516DE",
      "aev_sem_ca": "0.888", "ca": "1.2", "aev_com_ca": "1.065" }
  ]
}`;

function lerConfig(): { apiKey: string; modelo: string } {
  try {
    const raw = localStorage.getItem(LS_CONFIG);
    if (raw) {
      const j = JSON.parse(raw);
      return { apiKey: j.apiKey ?? "", modelo: j.modelo ?? MODELOS_PADRAO[0] };
    }
  } catch { /* ignora config corrompida */ }
  return { apiKey: "", modelo: MODELOS_PADRAO[0] };
}

function lerUltima(): { dados: DadosPPI; meta: string } | null {
  try {
    const raw = localStorage.getItem(LS_ULTIMA);
    if (raw) return JSON.parse(raw);
  } catch { /* ignora */ }
  return null;
}

export default function App() {
  const cfgInicial = useRef(lerConfig()).current;
  const [apiKey, setApiKey] = useState(cfgInicial.apiKey);
  const [modelo, setModelo] = useState(cfgInicial.modelo);
  const [modelos, setModelos] = useState<string[]>([]);
  const [teste, setTeste] = useState<TesteState>({ status: "idle", msg: "" });
  const [listando, setListando] = useState(false);

  const [ppi, setPpi] = useState<ArquivoInfo | null>(null);
  const [template, setTemplate] = useState<TemplateInfo | null>(null);

  const ultima = useRef(lerUltima()).current;
  const [dados, setDados] = useState<DadosPPI | null>(ultima?.dados ?? null);
  const [meta, setMeta] = useState<ResultadoExtracao | null>(ultima ? ({ em: ultima.meta } as ResultadoExtracao) : null);
  const [avisos, setAvisos] = useState<string[]>(ultima ? validarDados(ultima.dados) : []);

  const [logs, setLogs] = useState<LogEntry[]>([]);
  const logId = useRef(0);
  const [steps, setSteps] = useState<Record<StepId, StepStatus>>(STEPS_INICIAIS);
  const [rawRequest, setRawRequest] = useState("");
  const [rawResponse, setRawResponse] = useState("");
  const [processando, setProcessando] = useState(false);
  const [gerando, setGerando] = useState(false);
  const [fase, setFase] = useState("");
  const [erroExcel, setErroExcel] = useState("");
  const [saidaExcel, setSaidaExcel] = useState<{ url: string; nome: string; aba: string; celulas: number; kb: string } | null>(null);
  const saidaUrlRef = useRef<string | null>(null);
  const consoleRef = useRef<HTMLDivElement>(null);

  /* navegação + automação configurável (mapa de células & prompt) */
  const [pagina, setPagina] = useState<"extracao" | "config">("extracao");
  const [cfg, setCfg] = useState<ConfigAutomacao>(() => carregarConfig());
  const primeiroRenderCfg = useRef(true);
  const promptFinal = useMemo(() => montarPromptFinal(cfg), [cfg]);

  useEffect(() => {
    if (primeiroRenderCfg.current) {
      primeiroRenderCfg.current = false;
      return;
    }
    const t = setTimeout(() => salvarConfig(cfg), 350);
    return () => clearTimeout(t);
  }, [cfg]);

  const log = useCallback((level: LogLevel, msg: string, detalhe?: string) => {
    const d = new Date();
    const p = (n: number) => String(n).padStart(2, "0");
    setLogs((prev) => [
      ...prev.slice(-250),
      { id: ++logId.current, hora: `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`, level, msg, detalhe },
    ]);
  }, []);

  /* persistência */
  useEffect(() => {
    localStorage.setItem(LS_CONFIG, JSON.stringify({ apiKey, modelo }));
  }, [apiKey, modelo]);

  useEffect(() => {
    if (dados && meta) {
      try {
        localStorage.setItem(LS_ULTIMA, JSON.stringify({ dados, meta: meta.em }));
      } catch { /* quota */ }
    }
  }, [dados, meta]);

  useEffect(() => {
    if (ultima) {
      log("info", `Última extração recuperada do navegador (${new Date(ultima.meta).toLocaleString("pt-BR")}). Os dados estão editáveis abaixo.`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const marcarStep = (id: StepId, st: StepStatus) => setSteps((prev) => ({ ...prev, [id]: st }));
  const pausar = (ms: number) => new Promise((r) => setTimeout(r, ms));

  /* ------------------------- upload ------------------------- */

  const aoEscolherPpi = (f: File): string | null => {
    const pdf = f.type === "application/pdf" || /\.pdf$/i.test(f.name);
    const img = /^image\/(png|jpe?g)$/.test(f.type);
    if (!pdf && !img) return `Formato inválido ("${f.type || "desconhecido"}"). Envie o PPI em PDF, PNG ou JPG.`;
    if (f.size > 18 * 1024 * 1024) return `Arquivo com ${formatarBytes(f.size)} — o limite é 18 MB para envio direto à API.`;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result ?? "");
      const base64 = dataUrl.includes(",") ? dataUrl.split(",")[1] : dataUrl;
      const mime = pdf ? "application/pdf" : f.type;
      setPpi({ nome: f.name, tamanho: f.size, mime, base64 });
      log("ok", `PPI carregado: ${f.name} (${formatarBytes(f.size)}, ${mime}, base64 ≈ ${formatarBytes(base64.length)}).`);
    };
    reader.onerror = () => log("error", "Falha ao ler o arquivo localmente. Tente outro navegador.");
    reader.readAsDataURL(f);
    return null;
  };

  const aoEscolherTemplate = (f: File): string | null => {
    const okTipo = /\.xlsx?m?$/i.test(f.name) || f.type.includes("spreadsheet");
    if (!okTipo) return "O template precisa ser um arquivo .xlsx (Excel).";
    const reader = new FileReader();
    reader.onload = () => {
      setTemplate({ nome: f.name, tamanho: f.size, buffer: reader.result as ArrayBuffer });
      log("ok", `Template carregado: ${f.name} (${formatarBytes(f.size)}). A aba "NDD" será localizada automaticamente.`);
    };
    reader.onerror = () => log("error", "Falha ao ler o template.");
    reader.readAsArrayBuffer(f);
    return null;
  };

  /* ------------------------- extração ------------------------- */

  const extrair = async () => {
    if (!apiKey.trim()) {
      setTeste({ status: "erro", msg: "Configure sua chave da API Gemini no botão 'Configurar API' (topo da página)." });
      log("error", "Execução bloqueada: nenhuma chave de API configurada.");
      return;
    }
    if (!ppi) {
      log("error", "Execução bloqueada: selecione o PDF do PPI primeiro (passo 01).");
      return;
    }

    if (saidaUrlRef.current) {
      URL.revokeObjectURL(saidaUrlRef.current);
      saidaUrlRef.current = null;
    }
    setSaidaExcel(null);
    setErroExcel("");
    setProcessando(true);
    setLogs([]);
    setSteps(STEPS_INICIAIS);
    setRawRequest("");
    setRawResponse("");
    setFase("Preparando arquivo…");
    log("info", `═══ Nova extração iniciada · arquivo: ${ppi.nome} · modelo: ${modelo} ═══`);

    // leva a tela até o console de debug para acompanhar o pipeline ao vivo
    setTimeout(() => {
      consoleRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 150);

    try {
      marcarStep("arquivo", "running");
      log("info", `Base64 pronto (${formatarBytes(ppi.base64.length)}) — mime ${ppi.mime}.`);
      await pausar(350);
      marcarStep("arquivo", "done");

      marcarStep("gemini", "running");
      setFase("A IA está lendo o PPI (pode levar ~30s)…");
      log("info", `Prompt da configuração aplicado: ${promptFinal.length} chars · ${cfg.mapeamento.length} regra(s) no mapa · tabela de equipamentos a partir da linha ${cfg.linhaInicialEq}.`);
      const r = await extrairDoPdf(apiKey.trim(), modelo, ppi, promptFinal, log);
      marcarStep("gemini", "done");
      setRawRequest(r.rawRequest);
      setRawResponse(r.rawResponse);

      marcarStep("parse", "done"); // parse acontece dentro de extrairDoPdf
      log("ok", `Objeto normalizado: ${r.dados.equipamentos.length} equipamento(s), rastreabilidade presente: ${Object.values(r.dados.rastreabilidade).some(Boolean) ? "sim" : "não"}.`);

      marcarStep("validacao", "running");
      setFase("Validando campos…");
      await pausar(300);
      const av = validarDados(r.dados);
      marcarStep("validacao", "done");
      if (av.length > 0) {
        log("warn", `${av.length} aviso(s) de validação — revise os campos destacados antes de gerar o Excel.`);
      } else {
        log("ok", "Validação limpa: todos os campos em formato consistente.");
      }
      av.forEach((a) => log("warn", a));

      setDados(r.dados);
      setAvisos(av);
      setMeta({ dados: r.dados, em: new Date().toISOString(), arquivo: ppi.nome, modelo, duracaoMs: r.duracaoMs, avisos: av });
      setFase("");
      log("ok", `═══ Extração concluída em ${(r.duracaoMs / 1000).toFixed(1)}s (${r.tentativas} tentativa${r.tentativas > 1 ? "s" : ""}). Revise os dados e gere o Excel. ═══`);
    } catch (e: any) {
      const msg = e?.message ?? String(e);
      const falhaParse = /JSON|markdown|envelope/i.test(msg);
      marcarStep("gemini", falhaParse ? "done" : "error");
      if (falhaParse) marcarStep("parse", "error");
      else marcarStep("parse", "idle");
      setFase("");
      if (typeof e?.raw === "string" && e.raw) {
        setRawResponse(e.raw);
        log("info", "Resposta bruta capturada na aba 'Resposta bruta' do console para inspeção.");
      }
      log("error", msg, typeof e?.detalhe === "string" ? e.detalhe : undefined);
    } finally {
      setProcessando(false);
    }
  };

  /* ------------------------- edição ------------------------- */

  const onCampo = (chave: keyof DadosPPI, valor: string) => {
    setDados((prev) => (prev ? { ...prev, [chave]: valor } : prev));
  };
  const onExtra = (chave: string, valor: string) => {
    setDados((prev) => (prev ? { ...prev, extras: { ...(prev.extras ?? {}), [chave]: valor } } : prev));
  };
  const onEquip = (idx: number, chave: keyof Equipamento, valor: string) => {
    setDados((prev) => {
      if (!prev) return prev;
      const eqs = [...prev.equipamentos];
      eqs[idx] = { ...eqs[idx], [chave]: chave === "qtde" && /^\d+$/.test(valor) ? Number(valor) : valor } as Equipamento;
      return { ...prev, equipamentos: eqs };
    });
  };
  const addEquip = () => {
    setDados((prev) => (prev ? { ...prev, equipamentos: [...prev.equipamentos, { ...EQUIPAMENTO_VAZIO }] } : prev));
    log("info", "Linha de equipamento adicionada manualmente.");
  };
  const removeEquip = (idx: number) => {
    setDados((prev) => (prev ? { ...prev, equipamentos: prev.equipamentos.filter((_, i) => i !== idx) } : prev));
    log("info", `Equipamento #${idx + 1} removido.`);
  };

  /* ------------------------- saídas ------------------------- */

  const gerarExcel = async () => {
    if (!dados) return;
    setGerando(true);
    setErroExcel("");
    log("info", template ? `Gerando Excel sobre o template "${template.nome}"…` : "Gerando Excel com o template padrão embutido…");
    try {
      const r = await gerarNddPreenchido(dados, cfg, template?.buffer ?? null, log);
      if (!r.blob || r.blob.size === 0) {
        throw new Error("O arquivo gerado saiu vazio — copie o log da aba 'Linha do tempo' e tente sem o template.");
      }
      if (saidaUrlRef.current) URL.revokeObjectURL(saidaUrlRef.current);
      const url = URL.createObjectURL(r.blob);
      saidaUrlRef.current = url;
      setSaidaExcel({ url, nome: r.nomeArquivo, aba: r.abaUsada, celulas: r.celulasEscritas, kb: formatarBytes(r.blob.size) });
      baixarBlob(r.blob, r.nomeArquivo);
      log("ok", `Download iniciado: ${r.nomeArquivo} · aba "${r.abaUsada}" · ${r.celulasEscritas} células · ${formatarBytes(r.blob.size)}. Resumo/Gabinete preservados.`);
    } catch (e: any) {
      const msg = e?.message ?? String(e);
      console.error("[NDDForge] Falha ao gerar o Excel:", e);
      const amigavel =
        template && /load|parse|central directory|invalid|unsupported/i.test(msg)
          ? `Não foi possível abrir o template ("${template.nome}"): arquivo corrompido, protegido por senha ou com recursos que a biblioteca não lê (gráficos, tabela dinâmica, macros). Remova o template no passo 02 e gere com o modelo embutido.`
          : msg;
      setErroExcel(amigavel);
      log("error", `Falha ao gerar o .xlsx: ${amigavel}`, typeof e?.stack === "string" ? e.stack : undefined);
    } finally {
      setGerando(false);
    }
  };

  const copiarDiagnostico = useCallback(async (): Promise<boolean> => {
    const linhas: string[] = [
      "═══ DIAGNÓSTICO NDDFORGE ═══",
      `Quando: ${new Date().toLocaleString("pt-BR")}`,
      `Navegador: ${navigator.userAgent}`,
      `Modelo Gemini: ${modelo}`,
      `PPI: ${ppi ? `${ppi.nome} (${formatarBytes(ppi.tamanho)}, ${ppi.mime})` : "nenhum"}`,
      `Template: ${template ? `${template.nome} (${formatarBytes(template.tamanho)})` : "modelo embutido"}`,
      `Extração: ${meta ? `ok em ${((meta as any).duracaoMs ?? 0) / 1000}s` : "não realizada"}`,
      `Resultado Excel: ${saidaExcel ? `gerado (${saidaExcel.nome}, ${saidaExcel.kb})` : erroExcel ? `FALHOU — ${erroExcel}` : "não gerado"}`,
      "",
      "── Linha do tempo ──",
      ...(logs.length ? logs.map((l) => `[${l.hora}] ${l.level.toUpperCase().padEnd(5)} ${l.msg}${l.detalhe ? "\n" + l.detalhe : ""}`) : ["(sem eventos)"]),
      "",
      "── JSON extraído ──",
      dados ? JSON.stringify(dados, null, 2) : "(vazio)",
    ];
    const texto = linhas.join("\n");
    try {
      await navigator.clipboard.writeText(texto);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = texto;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }
    log("ok", "Relatório de diagnóstico copiado para a área de transferência (sem a chave da API).");
    return true;
  }, [modelo, ppi, template, meta, saidaExcel, erroExcel, logs, dados, log]);

  const baixarJson = () => {
    if (!dados) return;
    const blob = new Blob([JSON.stringify(dados, null, 2)], { type: "application/json" });
    const nome = `extracao_${(dados.site_id_cliente || "ppi").replace(/[^\w-]+/g, "_")}.json`;
    baixarBlob(blob, nome);
    log("ok", `JSON da extração salvo: ${nome}`);
  };

  /* ------------------------- API settings ------------------------- */

  const aoTestar = async () => {
    setTeste({ status: "busy", msg: "" });
    try {
      const resp = await testarConexao(apiKey.trim(), modelo);
      setTeste({ status: "ok", msg: `Conexão OK com ${modelo} — resposta: "${resp}".` });
      log("ok", `Teste de conexão: ${modelo} respondeu "${resp}".`);
    } catch (e: any) {
      setTeste({ status: "erro", msg: e?.message ?? String(e) });
      log("error", `Teste de conexão falhou: ${e?.message}`);
    }
  };

  const aoListarModelos = async () => {
    setListando(true);
    try {
      const lista = await listarModelos(apiKey.trim());
      setModelos(lista);
      setTeste({ status: "ok", msg: `${lista.length} modelo(s) ativos carregados no seletor: ${lista.slice(0, 3).join(", ")}${lista.length > 3 ? "…" : ""}` });
      log("ok", `Modelos disponíveis: ${lista.join(", ")}`);
    } catch (e: any) {
      setTeste({ status: "erro", msg: e?.message ?? String(e) });
      log("error", `Falha ao listar modelos: ${e?.message}`);
    } finally {
      setListando(false);
    }
  };

  const pronto = !!dados;

  /* ------------------------- UI ------------------------- */

  return (
    <div className="min-h-screen font-body text-mist-100">
      <div className="blueprint-bg" />
      <div className="blueprint-vignette" />

      <Header
        apiKey={apiKey}
        modelo={modelo}
        modelos={modelos}
        onApiKeyChange={setApiKey}
        onModeloChange={setModelo}
        onListarModelos={aoListarModelos}
        onTestar={aoTestar}
        teste={teste}
        listando={listando}
        pagina={pagina}
        onPagina={setPagina}
      />

      {pagina === "config" ? (
        <ConfigPage cfg={cfg} onChange={setCfg} onVoltar={() => setPagina("extracao")} />
      ) : (
      <main className="mx-auto grid max-w-7xl gap-6 px-4 py-8 sm:px-6 lg:grid-cols-[400px_1fr]">
        {/* ============ coluna esquerda: entrada ============ */}
        <div className="grid content-start gap-5">
          <div className="rise-in">
            <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.28em] text-cyan-400">
              automação de engenharia · telecom
            </p>
            <h2 className="font-display text-[2rem] font-bold leading-[1.05] tracking-tight sm:text-[2.4rem]">
              Manda o <span className="text-amber-400">PPI</span>,<br />
              recebe o <span className="text-cyan-300">NDD</span> preenchido.
            </h2>
            <p className="mt-3 max-w-sm text-sm leading-relaxed text-mist-500">
              A IA lê carimbo, coordenadas e a tabela de equipamentos do projeto executivo
              e grava nas <span className="font-mono text-xs text-mist-300">mesmas células</span> do seu Apps Script — D7, C9, P9, linha 23…
            </p>
          </div>

          <div className="rise-in" style={{ animationDelay: "0.08s" }}>
            <UploadZones
              ppi={ppi}
              template={template}
              aoEscolherPpi={aoEscolherPpi}
              aoRemoverPpi={() => { setPpi(null); log("info", "PPI removido."); }}
              aoEscolherTemplate={aoEscolherTemplate}
              aoRemoverTemplate={() => { setTemplate(null); log("info", "Template removido — será usado o modelo embutido."); }}
              processando={processando}
            />
          </div>

          <div className="rise-in grid gap-2.5" style={{ animationDelay: "0.16s" }}>
            <button
              onClick={extrair}
              disabled={processando || !ppi}
              className="group relative flex items-center justify-center gap-2.5 overflow-hidden rounded-md bg-amber-500 px-5 py-3.5 font-display text-sm font-bold uppercase tracking-wide text-ink-950 shadow-[0_8px_24px_-8px_rgba(255,178,36,0.5)] transition-all hover:bg-amber-400 hover:shadow-[0_10px_30px_-6px_rgba(255,178,36,0.65)] active:translate-y-px disabled:cursor-not-allowed disabled:opacity-45 disabled:shadow-none"
            >
              {processando ? (
                <>
                  <Radar size={17} className="animate-spin" />
                  {fase || "Processando…"}
                </>
              ) : (
                <>
                  <Sparkles size={17} className="transition-transform group-hover:scale-110" />
                  Extrair dados com IA
                </>
              )}
            </button>
            {!apiKey.trim() && (
              <p className="fade-in rounded border border-warn-400/40 bg-warn-400/8 px-3 py-2 font-mono text-[10px] leading-snug text-warn-400">
                ▲ Primeiro passo: clique em "Configurar API" no topo e cole sua chave do Google AI Studio.
              </p>
            )}

            {pronto && (
              <div className="fade-in grid gap-2.5">
                <button
                  onClick={gerarExcel}
                  disabled={gerando}
                  className="flex items-center justify-center gap-2 rounded-md bg-ok-500 px-5 py-3 font-display text-sm font-bold uppercase tracking-wide text-ink-950 shadow-[0_8px_24px_-10px_rgba(16,185,129,0.6)] transition-all hover:bg-ok-400 active:translate-y-px disabled:opacity-50"
                >
                  {gerando ? <Radar size={16} className="animate-spin" /> : <Download size={16} />}
                  {gerando ? "Montando planilha…" : "Gerar NDD preenchido (.xlsx)"}
                </button>
                <button
                  onClick={baixarJson}
                  className="flex items-center justify-center gap-2 rounded-md border border-cyan-500/50 px-5 py-2.5 font-display text-xs font-semibold uppercase tracking-wide text-cyan-300 transition-colors hover:bg-cyan-500/10"
                >
                  <FileJson2 size={14} /> Baixar JSON da extração
                </button>

                {erroExcel && (
                  <div className="fade-in rounded border border-err-500/60 bg-err-500/10 p-3.5" role="alert">
                    <p className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-err-400">
                      <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-err-400" />
                      falha ao gerar o .xlsx
                    </p>
                    <p className="mt-1.5 font-mono text-[11px] leading-snug text-err-400/90">{erroExcel}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-3">
                      <button
                        onClick={() => void copiarDiagnostico()}
                        className="inline-flex items-center gap-1.5 rounded border border-err-400/50 px-2.5 py-1 font-mono text-[9px] uppercase tracking-wider text-err-400 transition-colors hover:bg-err-500/15"
                      >
                        <Copy size={10} /> copiar diagnóstico completo
                      </button>
                      <p className="font-mono text-[10px] text-mist-500">
                        a stack completa está na "Linha do tempo" do painel de debug
                      </p>
                    </div>
                  </div>
                )}

                {saidaExcel && (
                  <div className="fade-in rounded border border-ok-500/60 bg-ok-500/10 p-3.5">
                    <div className="flex items-start gap-3">
                      <Download size={18} className="mt-0.5 shrink-0 text-ok-400" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-mono text-xs font-semibold text-ok-400" title={saidaExcel.nome}>
                          {saidaExcel.nome}
                        </p>
                        <p className="mt-0.5 font-mono text-[10px] text-mist-500">
                          {saidaExcel.celulas} células escritas · aba "{saidaExcel.aba}" · {saidaExcel.kb}
                        </p>
                      </div>
                    </div>
                    <a
                      href={saidaExcel.url}
                      download={saidaExcel.nome}
                      className="mt-2.5 flex items-center justify-center gap-2 rounded border border-ok-500/60 bg-ok-500/15 px-3 py-2 font-display text-xs font-bold uppercase tracking-wide text-ok-400 transition-colors hover:bg-ok-500/25"
                    >
                      <Download size={13} /> Baixar novamente
                    </a>
                    <p className="mt-1.5 text-center font-mono text-[9px] uppercase tracking-wider text-mist-600">
                      o download automático já começou — se o navegador bloqueou, clique acima
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* mapa de células */}
          <div className="rise-in tick-panel rounded-md p-4" style={{ animationDelay: "0.24s" }}>
            <p className="mb-2.5 flex items-center gap-2 font-mono text-[9px] uppercase tracking-[0.2em] text-mist-500">
              <Braces size={11} className="text-amber-500" /> mapa de células → igual ao seu Apps Script
            </p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 font-mono text-[10px]">
              {[
                ["D7", "data_rfi"], ["C9", "site_id_cliente"], ["P9", "site_id_detentor"],
                ["C11 / J11", "lat / long"], ["C12", "endereço"], ["B13 · I13", "bairro · cidade"],
                ["O13 · S13", "cep · uf"], ["C14", "altura_ev"], ["D15", "( X )"], ["A23:Q…", "equipamentos"],
              ].map(([cel, campo]) => (
                <p key={cel} className="flex justify-between gap-2 border-b border-ink-700/60 py-1">
                  <span className="text-cyan-400">{cel}</span>
                  <span className="truncate text-mist-500">{campo}</span>
                </p>
              ))}
            </div>
          </div>
        </div>

        {/* ============ coluna direita: resultado + debug ============ */}
        <div className="grid content-start gap-5">
          {!pronto ? (
            <div className="rise-in tick-panel rounded-md p-6" style={{ animationDelay: "0.1s" }}>
              <div className="flex flex-wrap items-center gap-3">
                <FileDown size={30} className="text-ink-500" strokeWidth={1.4} />
                <div>
                  <h3 className="font-display text-lg font-semibold text-mist-300">Raio-X da extração aparece aqui</h3>
                  <p className="text-sm text-mist-500">
                    Depois de extrair, você confere e edita cada campo antes de gerar o Excel.
                  </p>
                </div>
              </div>
              <div className="mt-5 grid gap-3 md:grid-cols-[auto_1fr]">
                <div className="flex flex-col items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-mist-500">
                  {["PPI.pdf", "Gemini", "JSON", "NDD.xlsx"].map((etapa, i) => (
                    <div key={etapa} className="flex flex-col items-center md:flex-row md:gap-0">
                      <span className={`rounded border px-2.5 py-1 ${i === 1 ? "border-amber-500/50 text-amber-400" : i === 3 ? "border-ok-500/50 text-ok-400" : "border-ink-500"}`}>
                        {etapa}
                      </span>
                      {i < 3 && <span className="h-4 w-px bg-ink-500 md:h-px md:w-6" />}
                    </div>
                  ))}
                </div>
                <div>
                  <p className="mb-1.5 font-mono text-[9px] uppercase tracking-[0.2em] text-mist-600">formato devolvido pela IA</p>
                  <pre className="overflow-x-auto rounded border border-ink-600 bg-ink-950/70 p-3.5 font-mono text-[10.5px] leading-relaxed text-cyan-300/90">
                    {JSON_EXEMPLO}
                  </pre>
                </div>
              </div>
            </div>
          ) : (
            meta && (
              <ExtractionPanel
                dados={dados!}
                avisos={avisos}
                meta={{ arquivo: (meta as any).arquivo ?? "—", modelo: (meta as any).modelo ?? modelo, duracaoMs: (meta as any).duracaoMs ?? 0, em: meta.em }}
                onCampo={onCampo}
                onEquip={onEquip}
                onAddEquip={addEquip}
                onRemoveEquip={removeEquip}
                onExtra={onExtra}
              />
            )
          )}

          <div ref={consoleRef} className={pronto ? "rise-in" : "rise-in"} style={{ animationDelay: "0.2s" }}>
            <DebugConsole
              steps={steps}
              logs={logs}
              rawRequest={rawRequest}
              rawResponse={rawResponse}
              jsonExtraido={dados ? JSON.stringify(dados, null, 2) : ""}
              promptUsado={promptFinal}
              onCopiarDiagnostico={copiarDiagnostico}
            />
          </div>
        </div>
      </main>
      )}

      <footer className="border-t border-ink-600/60 py-5">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 px-4 font-mono text-[10px] uppercase tracking-wider text-mist-600 sm:px-6">
          <p>
            <span className="text-amber-500">NDDFORGE</span> · PPI → NDD · o PDF vai direto do seu navegador para a API do Google
          </p>
          <p>chave salva apenas no localStorage · template nunca sai da sua máquina</p>
        </div>
      </footer>
    </div>
  );
}
