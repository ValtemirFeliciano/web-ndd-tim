import { useEffect, useRef, useState } from "react";
import { Check, CheckCircle2, Circle, Copy, Download, Loader2, Terminal, XCircle } from "lucide-react";
import type { LogEntry, LogLevel, StepId, StepStatus } from "../types";
import { logger } from "../lib/logger";

const STEPS: { id: StepId; rotulo: string; detalhe: string }[] = [
  { id: "arquivo", rotulo: "Leitura do arquivo", detalhe: "PDF → base64" },
  { id: "gemini", rotulo: "API Gemini", detalhe: "prompt + visão" },
  { id: "parse", rotulo: "Parse do JSON", detalhe: "limpeza + parse" },
  { id: "validacao", rotulo: "Validação", detalhe: "consistência" },
];

const CORES_LEVEL: Record<LogLevel, string> = {
  info: "text-mist-300",
  ok: "text-ok-400",
  warn: "text-warn-400",
  error: "text-err-400",
};
const MARCA_LEVEL: Record<LogLevel, string> = {
  info: "▸",
  ok: "✓",
  warn: "▲",
  error: "✕",
};

type Aba = "timeline" | "prompt" | "request" | "response" | "json";

interface Props {
  steps: Record<StepId, StepStatus>;
  logs: LogEntry[];
  rawRequest: string;
  rawResponse: string;
  jsonExtraido: string;
  promptUsado: string;
  onCopiarDiagnostico?: () => Promise<boolean>;
}

function IconeStep({ status }: { status: StepStatus }) {
  if (status === "running") return <Loader2 size={15} className="animate-spin text-amber-400" />;
  if (status === "done") return <CheckCircle2 size={15} className="text-ok-400" />;
  if (status === "error") return <XCircle size={15} className="text-err-400" />;
  return <Circle size={15} className="text-ink-500" />;
}

function BotaoCopiar({ texto }: { texto: string }) {
  const [copiado, setCopiado] = useState(false);
  return (
    <button
      onClick={async () => {
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
        setCopiado(true);
        setTimeout(() => setCopiado(false), 1600);
      }}
      disabled={!texto}
      className="flex items-center gap-1 rounded border border-ink-500 px-2 py-1 font-mono text-[9px] uppercase tracking-wider text-mist-300 transition-colors hover:border-cyan-400 hover:text-cyan-300 disabled:opacity-30"
    >
      {copiado ? <Check size={10} className="text-ok-400" /> : <Copy size={10} />}
      {copiado ? "copiado" : "copiar"}
    </button>
  );
}

export default function DebugConsole({ steps, logs, rawRequest, rawResponse, jsonExtraido, promptUsado, onCopiarDiagnostico }: Props) {
  const [aba, setAba] = useState<Aba>("timeline");
  const [diagCopiado, setDiagCopiado] = useState(false);
  const listaRef = useRef<HTMLDivElement>(null);

  /* Seguimento de logs estilo terminal: o auto-scroll acontece APENAS dentro
     do container de logs — nunca move a janela/página. Se o usuário rolar para
     cima, o seguimento pausa e aparece o aviso "novos logs ↓" para retomar. */
  const [seguindo, setSeguindo] = useState(true);
  const [novosLogs, setNovosLogs] = useState(0);
  const lenAnterior = useRef(logs.length);

  useEffect(() => {
    const el = listaRef.current;
    if (!el) return;
    const delta = logs.length - lenAnterior.current;
    lenAnterior.current = logs.length;
    if (delta > 0 && !seguindo) setNovosLogs((n) => n + delta);
    if (delta > 0 && seguindo) {
      el.scrollTop = el.scrollHeight;
      setNovosLogs(0);
    }
  }, [logs.length, seguindo]);

  const aoRolar = () => {
    const el = listaRef.current;
    if (!el) return;
    const pertoDoFim = el.scrollHeight - el.scrollTop - el.clientHeight < 32;
    setSeguindo((v) => (v === pertoDoFim ? v : pertoDoFim));
    if (pertoDoFim) setNovosLogs(0);
  };

  const irAoFim = () => {
    const el = listaRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    setSeguindo(true);
    setNovosLogs(0);
  };

  useEffect(() => {
    const el = listaRef.current;
    if (el && aba !== "timeline") el.scrollTop = 0;
  }, [aba]);

  const erros = logs.filter((l) => l.level === "error").length;
  const avisos = logs.filter((l) => l.level === "warn").length;

  const abas: { id: Aba; rotulo: string; badge?: number; badgeVermelho?: boolean; badgeAmbar?: boolean; conteudo: string }[] = [
    {
      id: "timeline",
      rotulo: "Linha do tempo",
      badge: erros > 0 ? erros : avisos > 0 ? avisos : logs.length,
      badgeVermelho: erros > 0,
      badgeAmbar: erros === 0 && avisos > 0,
      conteudo: "",
    },
    { id: "prompt", rotulo: "Prompt (configurado)", conteudo: promptUsado },
    { id: "request", rotulo: "Requisição", conteudo: rawRequest },
    { id: "response", rotulo: "Resposta bruta", conteudo: rawResponse },
    { id: "json", rotulo: "JSON extraído", conteudo: jsonExtraido },
  ];

  return (
    <div className="tick-panel rounded-md">
      {/* pipeline */}
      <div className="border-b border-ink-600/70 px-4 py-3">
        <div className="mb-2.5 flex items-center gap-2">
          <Terminal size={13} className="text-cyan-400" />
          <h3 className="font-display text-xs font-semibold uppercase tracking-[0.16em] text-mist-100">
            Pipeline de extração
          </h3>
          {erros > 0 && (
            <span className="rounded border border-err-500/40 bg-err-500/10 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-err-400">
              {erros} erro{erros > 1 ? "s" : ""}
            </span>
          )}
          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={() => logger.exportToFile()}
              className="flex items-center gap-1 rounded border border-amber-500/50 bg-amber-500/10 px-2 py-1 font-mono text-[9px] uppercase tracking-wider text-amber-300 transition-colors hover:bg-amber-500/20"
              title="Baixa todos os logs como arquivo .txt"
            >
              <Download size={10} />
              log completo
            </button>
            {onCopiarDiagnostico && (
              <button
                onClick={async () => {
                  try {
                    await onCopiarDiagnostico();
                    setDiagCopiado(true);
                    setTimeout(() => setDiagCopiado(false), 1800);
                  } catch {
                    /* clipboard indisponível */
                  }
                }}
                className="flex items-center gap-1 rounded border border-ink-500 px-2 py-1 font-mono text-[9px] uppercase tracking-wider text-mist-300 transition-colors hover:border-amber-500 hover:text-amber-400"
                title="Copia logs, erros, stack e ambiente para a área de transferência (sem a chave da API)"
              >
                {diagCopiado ? <Check size={10} className="text-ok-400" /> : <Copy size={10} />}
                {diagCopiado ? "copiado" : "diagnóstico"}
              </button>
            )}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {STEPS.map((s, i) => {
            const st = steps[s.id];
            return (
              <div key={s.id} className="flex items-center gap-2">
                <div
                  className={`flex flex-1 items-center gap-2 rounded border px-2.5 py-2 transition-all duration-300 ${
                    st === "running"
                      ? "border-amber-500/60 bg-amber-500/10"
                      : st === "done"
                      ? "border-ok-500/40 bg-ok-500/8"
                      : st === "error"
                      ? "border-err-500/50 bg-err-500/10"
                      : "border-ink-600 bg-ink-950/40"
                  }`}
                >
                  <IconeStep status={st} />
                  <div className="min-w-0">
                    <p className={`truncate font-display text-[10px] font-semibold leading-tight ${st === "idle" ? "text-mist-500" : "text-mist-100"}`}>
                      {i + 1}. {s.rotulo}
                    </p>
                    <p className="truncate font-mono text-[8px] uppercase tracking-wider text-mist-600">{s.detalhe}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* abas */}
      <div className="flex flex-wrap items-center gap-1 border-b border-ink-600/70 px-3 pt-2">
        {abas.map((a) => (
          <button
            key={a.id}
            onClick={() => setAba(a.id)}
            className={`rounded-t border border-b-0 px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider transition-colors ${
              aba === a.id
                ? "border-ink-500 bg-ink-950 text-amber-400"
                : "border-transparent text-mist-500 hover:text-mist-300"
            }`}
          >
            {a.rotulo}
            {a.badge !== undefined && a.badge > 0 && (
              <span
                className={`ml-1.5 rounded px-1 text-[9px] ${
                  a.badgeVermelho
                    ? "bg-err-500/25 text-err-400"
                    : a.badgeAmbar
                    ? "bg-warn-400/20 text-warn-400"
                    : "bg-ink-700 text-cyan-300"
                }`}
              >
                {a.badge}
              </span>
            )}
          </button>
        ))}
        <div className="ml-auto pb-1.5">
          {aba !== "timeline" && <BotaoCopiar texto={abas.find((a) => a.id === aba)?.conteudo ?? ""} />}
        </div>
      </div>

      {/* conteúdo */}
      <div className="relative">
        {aba === "timeline" && !seguindo && novosLogs > 0 && (
          <button
            onClick={irAoFim}
            className="fade-in absolute bottom-2.5 right-3.5 z-10 flex items-center gap-1.5 rounded-full border border-cyan-400/50 bg-ink-900/95 px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider text-cyan-300 shadow-[0_4px_16px_-4px_rgba(56,189,248,0.45)] transition-all hover:border-cyan-300 hover:text-cyan-200 hover:shadow-[0_6px_20px_-4px_rgba(56,189,248,0.6)]"
          >
            <span className="pulse-dot inline-block h-1.5 w-1.5 rounded-full bg-cyan-300" />
            {novosLogs} novo{novosLogs > 1 ? "s" : ""} ↓
          </button>
        )}
      <div
        ref={listaRef}
        onScroll={aoRolar}
        className="max-h-72 overflow-auto bg-ink-950/70 p-3.5 font-mono text-[11px] leading-relaxed"
      >
        {aba === "timeline" ? (
          logs.length === 0 ? (
            <p className="text-mist-600">
              <span className="text-cyan-400">$</span> aguardando execução… os logs de cada etapa aparecem aqui em tempo real.
              <span className="blink-caret text-amber-400">▊</span>
            </p>
          ) : (
            <div className="grid gap-0.5">
              {logs.map((l) => (
                <div key={l.id} className="fade-in">
                  <p className={CORES_LEVEL[l.level]}>
                    <span className="mr-2 text-mist-600">{l.hora}</span>
                    <span className="mr-1.5 inline-block w-3 text-center">{MARCA_LEVEL[l.level]}</span>
                    {l.msg}
                  </p>
                  {l.detalhe && (
                    <pre className="mb-1 mt-0.5 ml-9 max-h-28 overflow-auto whitespace-pre-wrap rounded bg-ink-900/80 p-2 text-[10px] text-mist-500">
                      {l.detalhe}
                    </pre>
                  )}
                </div>
              ))}
            </div>
          )
        ) : (
          <pre className="whitespace-pre-wrap break-words text-mist-300">
            {abas.find((a) => a.id === aba)?.conteudo || "— nada por aqui ainda —"}
          </pre>
        )}
        </div>
      </div>
    </div>
  );
}
