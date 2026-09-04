import { useEffect, useState } from "react";
import { ChevronDown, ExternalLink, KeyRound, Radar, RefreshCw, Zap } from "lucide-react";
import { MODELOS_PADRAO } from "../lib/gemini";

export interface TesteState {
  status: "idle" | "busy" | "ok" | "erro";
  msg: string;
}

interface Props {
  apiKey: string;
  modelo: string;
  modelos: string[];
  onApiKeyChange: (v: string) => void;
  onModeloChange: (v: string) => void;
  onListarModelos: () => void;
  onTestar: () => void;
  teste: TesteState;
  listando: boolean;
}

function LogoTorre({ varredura }: { varredura: boolean }) {
  return (
    <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-md border border-ink-600 bg-ink-850">
      {varredura && (
        <div className="radar-sweep absolute inset-0 rounded-md" />
      )}
      <svg viewBox="0 0 32 32" className="relative z-10 h-full w-full p-1.5">
        <path
          d="M16 6 L16 28 M10 28 L16 13 L22 28 M12 23 H20 M13.3 19 H18.7"
          stroke="#FFB224" strokeWidth="2" fill="none" strokeLinecap="round"
        />
        <circle cx="16" cy="7.5" r="2.2" fill="#38BDF8" className={varredura ? "pulse-dot" : ""} />
        <path d="M9.5 9.5 a7.5 7.5 0 0 1 4-4 M22.5 9.5 a7.5 7.5 0 0 0 -4-4" stroke="#38BDF8" strokeWidth="1.4" fill="none" strokeLinecap="round" opacity="0.8" />
      </svg>
    </div>
  );
}

export default function Header({
  apiKey, modelo, modelos, onApiKeyChange, onModeloChange, onListarModelos, onTestar, teste, listando,
}: Props) {
  const [aberto, setAberto] = useState(false);
  const [mostrarChave, setMostrarChave] = useState(false);
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

  const chaveOk = apiKey.trim().length > 10;
  const todosModelos = Array.from(new Set([...modelos, ...MODELOS_PADRAO, modelo].filter(Boolean)));

  return (
    <header className="sticky top-0 z-40 border-b border-ink-600/70 bg-ink-900/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3 sm:px-6">
        <LogoTorre varredura={teste.status === "busy"} />
        <div className="min-w-0">
          <h1 className="font-display text-lg font-bold leading-none tracking-tight text-mist-100">
            NDD<span className="text-amber-500">FORGE</span>
          </h1>
          <p className="mt-1 truncate font-mono text-[10px] uppercase tracking-[0.22em] text-mist-500">
            PPI → Excel · extração com Gemini
          </p>
        </div>

        <div className="ml-auto flex items-center gap-2 sm:gap-3">
          <div className="hidden items-center gap-2 rounded border border-ink-600 bg-ink-850 px-2.5 py-1.5 font-mono text-[11px] text-mist-300 md:flex">
            <span className="text-cyan-400">UTC</span> {relogio}
          </div>

          <div
            className={`flex items-center gap-1.5 rounded border px-2.5 py-1.5 font-mono text-[11px] ${
              chaveOk
                ? "border-ok-500/40 bg-ok-500/10 text-ok-400"
                : "border-warn-400/40 bg-warn-400/10 text-warn-400"
            }`}
            title={chaveOk ? "Chave Gemini configurada neste navegador" : "Nenhuma chave configurada"}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${chaveOk ? "bg-ok-400" : "bg-warn-400 pulse-dot"}`} />
            {chaveOk ? "GEMINI ON" : "SEM CHAVE"}
          </div>

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
        <div className="fade-in border-t border-ink-600/70 bg-ink-850/95">
          <div className="mx-auto grid max-w-7xl gap-4 px-4 py-4 sm:px-6 lg:grid-cols-[1fr_280px]">
            <div className="grid gap-3 sm:grid-cols-[1fr_220px]">
              <div>
                <label className="mb-1 block font-mono text-[10px] uppercase tracking-[0.18em] text-mist-500">
                  Chave da API Gemini (fica somente no seu navegador)
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
                  Modelo
                </label>
                <select value={modelo} onChange={(e) => onModeloChange(e.target.value)} className="field-input font-mono text-xs">
                  {todosModelos.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex gap-2">
                <button
                  onClick={onTestar}
                  disabled={!chaveOk || teste.status === "busy"}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded border border-cyan-500/60 bg-cyan-500/10 px-3 py-2 font-display text-xs font-semibold text-cyan-300 transition-all hover:bg-cyan-500/20 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {teste.status === "busy" ? <Radar size={13} className="animate-spin" /> : <Zap size={13} />}
                  {teste.status === "busy" ? "Testando…" : "Testar conexão"}
                </button>
                <button
                  onClick={onListarModelos}
                  disabled={!chaveOk || listando}
                  className="flex items-center justify-center gap-1.5 rounded border border-ink-500 px-3 py-2 font-display text-xs font-semibold text-mist-300 transition-all hover:border-cyan-400 hover:text-cyan-300 disabled:cursor-not-allowed disabled:opacity-40"
                  title="Busca os modelos ativos da sua conta"
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
        </div>
      )}
    </header>
  );
}
