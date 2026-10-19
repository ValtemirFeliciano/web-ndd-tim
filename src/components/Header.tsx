import { useEffect, useState } from "react";
import {
  Bot,
  Braces,
  ChevronDown,
  Cpu,
  ExternalLink,
  FileCog,
  KeyRound,
  Layers,
  ListChecks,
  Radar,
  Radio,
  RefreshCw,
  ScanLine,
  Share2,
  ShieldCheck,
  Sparkles,
  Zap,
} from "lucide-react";
import { MODELOS_PADRAO, normalizarNomeModelo } from "../lib/gemini";
import { MODELOS_QWEN, MODELO_QWEN_PADRAO } from "../lib/qwen";
import type { ProvedorIA, TipoProjeto } from "../types";

export interface TesteState {
  status: "idle" | "busy" | "ok" | "erro";
  msg: string;
}

interface Props {
  // Gemini
  apiKey: string;
  modelo: string;
  modelos: string[];
  onApiKeyChange: (v: string) => void;
  onModeloChange: (v: string) => void;
  onListarModelos: () => void;
  onTestar: () => void;
  teste: TesteState;
  listando: boolean;

  // QwenCloud
  provedor: ProvedorIA;
  onProvedorChange: (p: ProvedorIA) => void;
  qwenApiKey: string;
  onQwenApiKeyChange: (v: string) => void;
  qwenModelo: string;
  onQwenModeloChange: (v: string) => void;
  onTestarQwen: () => void;
  testeQwen: TesteState;

  // Fallback
  fallbackAtivo: boolean;
  onFallbackAtivoChange: (v: boolean) => void;

  // Navegação e Projeto
  pagina: "extracao" | "config" | "massa";
  onPagina: (p: "extracao" | "config" | "massa") => void;
  tipoProjeto: TipoProjeto;
  onTipoProjetoChange: (t: TipoProjeto) => void;
  usarSchema: boolean;
  onUsarSchemaChange: (usar: boolean) => void;
}

function LogoTorre({ varredura }: { varredura: boolean }) {
  return (
    <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-md border border-ink-600 bg-ink-850">
      {varredura && <div className="radar-sweep absolute inset-0 rounded-md" />}
      <svg viewBox="0 0 32 32" className="relative z-10 h-full w-full p-1.5">
        <path
          d="M16 6 L16 28 M10 28 L16 13 L22 28 M12 23 H20 M13.3 19 H18.7"
          stroke="#FFB224"
          strokeWidth="2"
          fill="none"
          strokeLinecap="round"
        />
        <circle cx="16" cy="7.5" r="2.2" fill="#38BDF8" className={varredura ? "pulse-dot" : ""} />
        <path
          d="M9.5 9.5 a7.5 7.5 0 0 1 4-4 M22.5 9.5 a7.5 7.5 0 0 0 -4-4"
          stroke="#38BDF8"
          strokeWidth="1.4"
          fill="none"
          strokeLinecap="round"
          opacity="0.8"
        />
      </svg>
    </div>
  );
}

export default function Header({
  apiKey,
  modelo,
  modelos,
  onApiKeyChange,
  onModeloChange,
  onListarModelos,
  onTestar,
  teste,
  listando,
  provedor,
  onProvedorChange,
  qwenApiKey,
  onQwenApiKeyChange,
  qwenModelo,
  onQwenModeloChange,
  onTestarQwen,
  testeQwen,
  fallbackAtivo,
  onFallbackAtivoChange,
  pagina,
  onPagina,
  tipoProjeto,
  onTipoProjetoChange,
  usarSchema,
  onUsarSchemaChange,
}: Props) {
  const [aberto, setAberto] = useState(false);
  const [mostrarChave, setMostrarChave] = useState(false);
  const [mostrarChaveQwen, setMostrarChaveQwen] = useState(false);
  const [abaConfig, setAbaConfig] = useState<"gemini" | "qwen">(provedor);
  const [relogio, setRelogio] = useState("--:--:--");

  useEffect(() => {
    const tick = () => {
      const d = new Date();
      const p = (n: number) => String(n).padStart(2, "0");
      setRelogio(`${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const chaveGeminiOk = apiKey.trim().length > 10;
  const chaveQwenOk = (qwenApiKey || "").trim().length > 10;
  const multiIaAtiva = chaveGeminiOk && chaveQwenOk && fallbackAtivo;
  const todosModelosGemini = Array.from(
    new Set([...modelos, ...MODELOS_PADRAO, modelo].map(normalizarNomeModelo).filter(Boolean))
  );

  return (
    <header className="sticky top-0 z-40 border-b border-ink-600/70 bg-ink-900/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-[1840px] w-full items-center gap-4 px-4 py-3 sm:px-6 lg:px-8 xl:px-10">
        <LogoTorre varredura={teste.status === "busy" || testeQwen.status === "busy"} />
        <div className="min-w-0">
          <h1 className="font-display text-lg font-bold leading-none tracking-tight text-mist-100">
            NDD<span className="text-amber-500">FORGE</span>
          </h1>
          <p className="mt-1 truncate font-mono text-[10px] uppercase tracking-[0.22em] text-mist-500">
            PPI → Excel · extração com IA {multiIaAtiva ? "(Multi-IA Fallback)" : provedor === "qwen" ? "(QwenCloud)" : "(Gemini)"}
          </p>
        </div>

        {/* Seletor de Tipo de Projeto: BTS vs COLLO */}
        <div className="ml-2 flex items-center rounded-md border border-ink-600 bg-ink-850 p-1">
          <button
            type="button"
            onClick={() => onTipoProjetoChange("bts")}
            className={`flex items-center gap-1.5 rounded px-2.5 py-1.5 font-display text-xs font-semibold transition-all ${
              tipoProjeto === "bts"
                ? "bg-amber-500 text-ink-950 shadow-[0_2px_10px_-2px_rgba(255,178,36,0.5)]"
                : "text-mist-400 hover:text-amber-400"
            }`}
            title="BTS: Site Novo / Greenfield (regra padrão)"
          >
            <Radio size={13} />
            BTS
          </button>
          <button
            type="button"
            onClick={() => onTipoProjetoChange("collo")}
            className={`flex items-center gap-1.5 rounded px-2.5 py-1.5 font-display text-xs font-semibold transition-all ${
              tipoProjeto === "collo"
                ? "bg-cyan-400 text-ink-950 shadow-[0_2px_10px_-2px_rgba(34,211,238,0.5)]"
                : "text-mist-400 hover:text-cyan-300"
            }`}
            title="COLLO: Colocation / Compartilhamento de Infraestrutura (antenas novas da TIM)"
          >
            <Share2 size={13} />
            COLLO
          </button>
        </div>

        {/* Seletor do Modo de Resposta da IA: Livre (JSON sem schema) vs Schema (campos fixos) */}
        <div className="ml-2 flex items-center rounded-md border border-ink-600 bg-ink-850 p-1">
          <button
            type="button"
            onClick={() => onUsarSchemaChange(false)}
            className={`flex items-center gap-1.5 rounded px-2.5 py-1.5 font-display text-xs font-semibold transition-all ${
              !usarSchema
                ? "bg-amber-500 text-ink-950 shadow-[0_2px_10px_-2px_rgba(255,178,36,0.5)]"
                : "text-mist-400 hover:text-amber-400"
            }`}
            title="LIVRE: a IA devolve JSON sem schema (comportamento anterior)"
          >
            <Braces size={13} />
            LIVRE
          </button>
          <button
            type="button"
            onClick={() => onUsarSchemaChange(true)}
            className={`flex items-center gap-1.5 rounded px-2.5 py-1.5 font-display text-xs font-semibold transition-all ${
              usarSchema
                ? "bg-cyan-400 text-ink-950 shadow-[0_2px_10px_-2px_rgba(34,211,238,0.5)]"
                : "text-mist-400 hover:text-cyan-300"
            }`}
            title="SCHEMA: campos fixos e citação do PDF antes de cada valor (só Gemini). No teste de 07/10: cabeçalho 88,5% → 95,3%, equipamentos 92,4% → 94,6%"
          >
            <ListChecks size={13} />
            SCHEMA
          </button>
        </div>

        <nav className="ml-2 hidden items-center gap-1 rounded-md border border-ink-600 bg-ink-850 p-1 sm:flex">
          <button
            onClick={() => onPagina("extracao")}
            className={`flex items-center gap-1.5 rounded px-3 py-1.5 font-display text-xs font-semibold transition-all ${
              pagina === "extracao"
                ? "bg-ink-700 text-mist-100 shadow-[0_2px_8px_-2px_rgba(0,0,0,0.5)]"
                : "text-mist-400 hover:text-mist-200"
            }`}
          >
            <ScanLine size={13} />
            Extração
          </button>
          <button
            onClick={() => onPagina("massa")}
            className={`flex items-center gap-1.5 rounded px-3 py-1.5 font-display text-xs font-semibold transition-all ${
              pagina === "massa"
                ? "bg-ink-700 text-amber-400 shadow-[0_2px_8px_-2px_rgba(0,0,0,0.5)] border border-amber-500/30"
                : "text-mist-400 hover:text-mist-200"
            }`}
          >
            <Layers size={13} />
            Lote em Massa
          </button>
          <button
            onClick={() => onPagina("config")}
            className={`flex items-center gap-1.5 rounded px-3 py-1.5 font-display text-xs font-semibold transition-all ${
              pagina === "config"
                ? "bg-ink-700 text-mist-100 shadow-[0_2px_8px_-2px_rgba(0,0,0,0.5)]"
                : "text-mist-400 hover:text-mist-200"
            }`}
          >
            <FileCog size={13} />
            Mapeamento & Prompt
          </button>
        </nav>

        <div className="ml-auto flex items-center gap-2 sm:gap-3">
          <div className="hidden items-center gap-2 rounded border border-ink-600 bg-ink-850 px-2.5 py-1.5 font-mono text-[11px] text-mist-300 md:flex">
            <span className="text-cyan-400">UTC</span> {relogio}
          </div>

          {/* Badge de status da(s) IA(s) */}
          {multiIaAtiva ? (
            <div
              className="flex items-center gap-1.5 rounded border border-amber-500/50 bg-amber-500/10 px-2.5 py-1.5 font-mono text-[11px] text-amber-400 font-semibold"
              title="Multi-IA ativa: Gemini + QwenCloud com fallback automático inteligente"
            >
              <ShieldCheck size={12} className="text-amber-400" />
              <span>MULTI-IA (FALLBACK ON)</span>
            </div>
          ) : provedor === "qwen" ? (
            <div
              className={`flex items-center gap-1.5 rounded border px-2.5 py-1.5 font-mono text-[11px] ${
                chaveQwenOk
                  ? "border-cyan-400/40 bg-cyan-400/10 text-cyan-300"
                  : "border-warn-400/40 bg-warn-400/10 text-warn-400"
              }`}
              title={chaveQwenOk ? "QwenCloud ativo como IA principal" : "Chave QwenCloud não configurada"}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${chaveQwenOk ? "bg-cyan-400" : "bg-warn-400 pulse-dot"}`} />
              {chaveQwenOk ? "QWEN ON" : "SEM CHAVE QWEN"}
            </div>
          ) : (
            <div
              className={`flex items-center gap-1.5 rounded border px-2.5 py-1.5 font-mono text-[11px] ${
                chaveGeminiOk
                  ? "border-ok-500/40 bg-ok-500/10 text-ok-400"
                  : "border-warn-400/40 bg-warn-400/10 text-warn-400"
              }`}
              title={chaveGeminiOk ? "Google Gemini ativo como IA principal" : "Nenhuma chave configurada"}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${chaveGeminiOk ? "bg-ok-400" : "bg-warn-400 pulse-dot"}`} />
              {chaveGeminiOk ? "GEMINI ON" : "SEM CHAVE"}
            </div>
          )}

          <button
            onClick={() => setAberto((v) => !v)}
            className={`flex items-center gap-1.5 rounded border px-3 py-1.5 font-display text-xs font-semibold transition-all ${
              aberto
                ? "border-amber-500 bg-amber-500 text-ink-950"
                : "border-ink-500 bg-ink-800 text-mist-100 hover:border-amber-500/60 hover:text-amber-400"
            }`}
          >
            <KeyRound size={14} />
            Configurar API
            <ChevronDown size={13} className={`transition-transform ${aberto ? "rotate-180" : ""}`} />
          </button>
        </div>
      </div>

      {aberto && (
        <div className="fade-in border-t border-ink-600/70 bg-ink-850/95 shadow-xl">
          <div className="mx-auto max-w-[1840px] w-full px-4 py-4 sm:px-6 lg:px-8 xl:px-10">
            {/* Barra superior de controle do Provedor e Fallback */}
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-ink-600 bg-ink-900/90 p-3">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs uppercase tracking-wider text-mist-400">
                  Provedor Principal:
                </span>
                <div className="flex items-center rounded-md border border-ink-600 bg-ink-800 p-1">
                  <button
                    type="button"
                    onClick={() => {
                      onProvedorChange("gemini");
                      setAbaConfig("gemini");
                    }}
                    className={`flex items-center gap-1.5 rounded px-3 py-1 font-display text-xs font-semibold transition-all ${
                      provedor === "gemini"
                        ? "bg-amber-500 text-ink-950 shadow-sm"
                        : "text-mist-400 hover:text-mist-100"
                    }`}
                  >
                    <Bot size={13} />
                    Google Gemini
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onProvedorChange("qwen");
                      setAbaConfig("qwen");
                    }}
                    className={`flex items-center gap-1.5 rounded px-3 py-1 font-display text-xs font-semibold transition-all ${
                      provedor === "qwen"
                        ? "bg-cyan-400 text-ink-950 shadow-sm"
                        : "text-mist-400 hover:text-mist-100"
                    }`}
                  >
                    <Sparkles size={13} />
                    QwenCloud (Alibaba)
                  </button>
                </div>
              </div>

              {/* Toggle de Fallback Inteligente */}
              <label
                className="flex cursor-pointer items-center gap-2 rounded border border-ink-600 bg-ink-850 px-3 py-1.5 transition-colors hover:border-amber-500/40"
                title="Se o modelo principal der erro 503 (sobrecarga) ou limite de cota 429, o sistema alterna automaticamente para a outra IA configurada"
              >
                <input
                  type="checkbox"
                  checked={fallbackAtivo}
                  onChange={(e) => onFallbackAtivoChange(e.target.checked)}
                  className="h-3.5 w-3.5 rounded border-ink-500 text-amber-500 focus:ring-0 cursor-pointer"
                />
                <span className="font-display text-xs font-semibold text-mist-200">
                  Fallback Automático entre IAs
                </span>
                <span className="rounded bg-amber-500/20 px-1.5 py-0.5 font-mono text-[9px] uppercase text-amber-300">
                  anti-503
                </span>
              </label>
            </div>

            {/* Abas para configurar Gemini e QwenCloud */}
            <div className="flex border-b border-ink-600 mb-4 gap-2">
              <button
                type="button"
                onClick={() => setAbaConfig("gemini")}
                className={`flex items-center gap-2 pb-2 px-3 font-display text-xs font-semibold border-b-2 transition-all ${
                  abaConfig === "gemini"
                    ? "border-amber-500 text-amber-400"
                    : "border-transparent text-mist-400 hover:text-mist-200"
                }`}
              >
                <Bot size={14} />
                Google Gemini
                {chaveGeminiOk && (
                  <span className="h-2 w-2 rounded-full bg-ok-400" title="Chave configurada" />
                )}
              </button>
              <button
                type="button"
                onClick={() => setAbaConfig("qwen")}
                className={`flex items-center gap-2 pb-2 px-3 font-display text-xs font-semibold border-b-2 transition-all ${
                  abaConfig === "qwen"
                    ? "border-cyan-400 text-cyan-300"
                    : "border-transparent text-mist-400 hover:text-mist-200"
                }`}
              >
                <Cpu size={14} />
                QwenCloud (Alibaba DashScope)
                {chaveQwenOk && (
                  <span className="h-2 w-2 rounded-full bg-cyan-400" title="Chave configurada" />
                )}
              </button>
            </div>

            {/* Painel do Google Gemini */}
            {abaConfig === "gemini" && (
              <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
                <div className="grid gap-3 sm:grid-cols-[1fr_240px]">
                  <div>
                    <label className="mb-1 block font-mono text-[10px] uppercase tracking-[0.18em] text-mist-500">
                      Chave da API Gemini (Google AI Studio)
                    </label>
                    <div className="flex gap-2">
                      <input
                        type={mostrarChave ? "text" : "password"}
                        value={apiKey}
                        onChange={(e) => onApiKeyChange(e.target.value)}
                        placeholder="Cole aqui a chave AIza… ou AQ…"
                        className="field-input font-mono text-xs"
                        spellCheck={false}
                      />
                      <button
                        onClick={() => setMostrarChave((v) => !v)}
                        className="shrink-0 rounded border border-ink-500 px-2.5 font-mono text-[10px] uppercase text-mist-300 transition-colors hover:border-cyan-400 hover:text-cyan-300"
                        title={mostrarChave ? "Ocultar chave" : "Mostrar chave"}
                      >
                        {mostrarChave ? "ocultar" : "mostrar"}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="mb-1 block font-mono text-[10px] uppercase tracking-[0.18em] text-mist-500">
                      Modelo Gemini
                    </label>
                    <select
                      value={modelo}
                      onChange={(e) => onModeloChange(e.target.value)}
                      className="field-input font-mono text-xs"
                    >
                      {todosModelosGemini.map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <div className="flex gap-2">
                    <button
                      onClick={onTestar}
                      disabled={!chaveGeminiOk || teste.status === "busy"}
                      className="flex flex-1 items-center justify-center gap-1.5 rounded border border-cyan-500/60 bg-cyan-500/10 px-3 py-2 font-display text-xs font-semibold text-cyan-300 transition-all hover:bg-cyan-500/20 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {teste.status === "busy" ? <Radar size={13} className="animate-spin" /> : <Zap size={13} />}
                      {teste.status === "busy" ? "Testando…" : "Testar Gemini"}
                    </button>
                    <button
                      onClick={onListarModelos}
                      disabled={!chaveGeminiOk || listando}
                      className="flex items-center justify-center gap-1.5 rounded border border-ink-500 px-3 py-2 font-display text-xs font-semibold text-mist-300 transition-all hover:border-cyan-400 hover:text-cyan-300 disabled:cursor-not-allowed disabled:opacity-40"
                      title="Busca os modelos ativos da sua conta Gemini"
                    >
                      <RefreshCw size={13} className={listando ? "animate-spin" : ""} />
                      {listando ? "…" : "Listar modelos"}
                    </button>
                  </div>
                  {teste.msg && (
                    <p
                      className={`rounded border px-2.5 py-1.5 font-mono text-[11px] leading-snug ${
                        teste.status === "ok"
                          ? "border-ok-500/40 bg-ok-500/10 text-ok-400"
                          : teste.status === "erro"
                          ? "border-err-500/40 bg-err-500/10 text-err-400"
                          : "border-ink-500 text-mist-300"
                      }`}
                    >
                      {teste.msg}
                    </p>
                  )}
                  <a
                    href="https://aistudio.google.com/app/apikey"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-wider text-mist-500 transition-colors hover:text-amber-400"
                  >
                    <ExternalLink size={10} /> obter chave no Google AI Studio
                  </a>
                </div>
              </div>
            )}

            {/* Painel do QwenCloud */}
            {abaConfig === "qwen" && (
              <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
                <div className="grid gap-3 sm:grid-cols-[1fr_240px]">
                  <div>
                    <label className="mb-1 block font-mono text-[10px] uppercase tracking-[0.18em] text-mist-500">
                      Chave da API QwenCloud (sk-…)
                    </label>
                    <div className="flex gap-2">
                      <input
                        type={mostrarChaveQwen ? "text" : "password"}
                        value={qwenApiKey}
                        onChange={(e) => onQwenApiKeyChange(e.target.value)}
                        placeholder="sk-xxxxxxxxxxxxxxxxxxxxxxxx"
                        className="field-input font-mono text-xs"
                        spellCheck={false}
                      />
                      <button
                        onClick={() => setMostrarChaveQwen((v) => !v)}
                        className="shrink-0 rounded border border-ink-500 px-2.5 font-mono text-[10px] uppercase text-mist-300 transition-colors hover:border-cyan-400 hover:text-cyan-300"
                        title={mostrarChaveQwen ? "Ocultar chave" : "Mostrar chave"}
                      >
                        {mostrarChaveQwen ? "ocultar" : "mostrar"}
                      </button>
                    </div>
                    <p className="mt-1 font-mono text-[10px] text-mist-500">
                      Suporte nativo a envio de PDF via Base64 com endpoint OpenAI-compatible da Alibaba.
                    </p>
                  </div>
                  <div>
                    <label className="mb-1 block font-mono text-[10px] uppercase tracking-[0.18em] text-mist-500">
                      Modelo Qwen
                    </label>
                    <select
                      value={qwenModelo}
                      onChange={(e) => onQwenModeloChange(e.target.value)}
                      className="field-input font-mono text-xs"
                    >
                      {MODELOS_QWEN.map((m) => (
                        <option key={m} value={m}>
                          {m === MODELO_QWEN_PADRAO ? `${m} (Recomendado)` : m}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <div className="flex gap-2">
                    <button
                      onClick={onTestarQwen}
                      disabled={!chaveQwenOk || testeQwen.status === "busy"}
                      className="flex flex-1 items-center justify-center gap-1.5 rounded border border-cyan-500/60 bg-cyan-500/10 px-3 py-2 font-display text-xs font-semibold text-cyan-300 transition-all hover:bg-cyan-500/20 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {testeQwen.status === "busy" ? (
                        <Radar size={13} className="animate-spin" />
                      ) : (
                        <Zap size={13} />
                      )}
                      {testeQwen.status === "busy" ? "Testando…" : "Testar Qwen"}
                    </button>
                  </div>
                  {testeQwen.msg && (
                    <p
                      className={`rounded border px-2.5 py-1.5 font-mono text-[11px] leading-snug ${
                        testeQwen.status === "ok"
                          ? "border-ok-500/40 bg-ok-500/10 text-ok-400"
                          : testeQwen.status === "erro"
                          ? "border-err-500/40 bg-err-500/10 text-err-400"
                          : "border-ink-500 text-mist-300"
                      }`}
                    >
                      {testeQwen.msg}
                    </p>
                  )}
                  <a
                    href="https://home.qwencloud.com/api-keys"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-wider text-mist-500 transition-colors hover:text-cyan-300"
                  >
                    <ExternalLink size={10} /> obter chave no QwenCloud (Alibaba)
                  </a>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
