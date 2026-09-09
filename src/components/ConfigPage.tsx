import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle, ArrowLeft, Check, Copy, FileCog, ListChecks, Plus,
  RotateCcw, Save, Sparkles, Table2, Trash2, Wand2,
} from "lucide-react";
import type { AliasColuna, CampoMapeamento, ConfigAutomacao } from "../types";
import {
  CAMPOS_CONHECIDOS, DESCRICOES_CAMPOS, INSTRUCOES_PADRAO,
  montarPromptFinal, validarConfig,
} from "../lib/mapping";

interface Props {
  cfg: ConfigAutomacao;
  onChange: (c: ConfigAutomacao) => void;
  onVoltar: () => void;
}

let seqLocal = 0;
const novoId = () => `m_ui_${Date.now().toString(36)}_${(seqLocal++).toString(36)}`;

function Secao({
  titulo, icone, children, extra,
}: {
  titulo: string;
  icone: React.ReactNode;
  children: React.ReactNode;
  extra?: React.ReactNode;
}) {
  return (
    <section className="tick-panel rise-in rounded-md">
      <header className="flex flex-wrap items-center gap-2 border-b border-ink-600/70 px-4 py-3">
        <span className="text-amber-400">{icone}</span>
        <h3 className="font-display text-sm font-semibold uppercase tracking-[0.14em] text-mist-100">{titulo}</h3>
        <div className="ml-auto flex items-center gap-2">{extra}</div>
      </header>
      <div className="p-4">{children}</div>
    </section>
  );
}

export default function ConfigPage({ cfg, onChange, onVoltar }: Props) {
  const [copiado, setCopiado] = useState(false);
  const [salvoFlash, setSalvoFlash] = useState(false);
  const [mostrarPrompt, setMostrarPrompt] = useState(true);

  const promptFinal = useMemo(() => montarPromptFinal(cfg), [cfg]);
  const avisos = useMemo(() => validarConfig(cfg), [cfg]);

  /* feedback visual de auto-save (o App persiste com debounce) */
  const primeiroRender = useRef(true);
  useEffect(() => {
    if (primeiroRender.current) {
      primeiroRender.current = false;
      return;
    }
    setSalvoFlash(true);
    const t = setTimeout(() => setSalvoFlash(false), 1400);
    return () => clearTimeout(t);
  }, [cfg]);

  const setCampo = (id: string, patch: Partial<CampoMapeamento>) => {
    onChange({
      ...cfg,
      mapeamento: cfg.mapeamento.map((m) => (m.id === id ? { ...m, ...patch } : m)),
    });
  };
  const remover = (id: string) => onChange({ ...cfg, mapeamento: cfg.mapeamento.filter((m) => m.id !== id) });
  const adicionar = () =>
    onChange({ ...cfg, mapeamento: [...cfg.mapeamento, { id: novoId(), campo: "", celula: "" }] });

  const setAlias = (id: string, patch: Partial<AliasColuna>) => {
    onChange({
      ...cfg,
      aliasesColunas: cfg.aliasesColunas.map((a) => (a.id === id ? { ...a, ...patch } : a)),
    });
  };
  const removerAlias = (id: string) => onChange({ ...cfg, aliasesColunas: cfg.aliasesColunas.filter((a) => a.id !== id) });
  const adicionarAlias = () =>
    onChange({ ...cfg, aliasesColunas: [...cfg.aliasesColunas, { id: novoId(), campoSistema: "", aliasPdf: "" }] });

  const restaurarInstrucoes = () => onChange({ ...cfg, instrucoes: INSTRUCOES_PADRAO });

  const copiarPrompt = async () => {
    try {
      await navigator.clipboard.writeText(promptFinal);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = promptFinal;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }
    setCopiado(true);
    setTimeout(() => setCopiado(false), 1600);
  };

  const camposUsados = Array.from(new Set(cfg.mapeamento.map((m) => m.campo.trim()).filter(Boolean)));

  return (
    <main className="mx-auto grid max-w-5xl content-start gap-5 px-4 py-8 sm:px-6">
      {/* cabeçalho da página */}
      <div className="rise-in flex flex-wrap items-end justify-between gap-3">
        <div>
          <button
            onClick={onVoltar}
            className="mb-2 inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-mist-500 transition-colors hover:text-amber-400"
          >
            <ArrowLeft size={11} /> voltar para a extração
          </button>
          <h2 className="flex items-center gap-3 font-display text-[1.9rem] font-bold leading-tight tracking-tight text-mist-100">
            <FileCog size={26} className="text-cyan-300" />
            Mapeamento <span className="text-amber-400">&</span> Prompt
          </h2>
          <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-mist-500">
            Decida <span className="text-mist-300">em qual célula</span> cada campo vai cair e{" "}
            <span className="text-mist-300">o que a IA deve procurar</span>. O prompt final é montado
            automaticamente a partir daqui — mapa e prompt nunca ficam dessincronizados.
          </p>
        </div>
        <div
          className={`flex items-center gap-1.5 rounded border px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider transition-all ${
            salvoFlash ? "border-ok-500/50 bg-ok-500/10 text-ok-400" : "border-ink-600 text-mist-500"
          }`}
        >
          {salvoFlash ? <Check size={11} /> : <Save size={11} />}
          {salvoFlash ? "alterações salvas" : "auto-save ativo"}
        </div>
      </div>

      {/* avisos de configuração */}
      {avisos.length > 0 && (
        <div className="rise-in rounded-md border border-warn-400/40 bg-warn-400/8 p-3.5">
          <p className="mb-1.5 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-warn-400">
            <AlertTriangle size={12} /> {avisos.length} ajuste(s) recomendado(s)
          </p>
          <ul className="grid gap-1">
            {avisos.map((a, i) => (
              <li key={i} className="font-mono text-[11px] leading-snug text-warn-400/90">▸ {a}</li>
            ))}
          </ul>
        </div>
      )}

      {/* ============ 1. MAPA DE CÉLULAS ============ */}
      <Secao
        titulo="Mapa de células — campo → célula"
        icone={<Table2 size={15} />}
        extra={
          <>
            <span className="rounded border border-ink-600 px-2 py-0.5 font-mono text-[9px] uppercase text-mist-500">
              {cfg.mapeamento.length} regra(s)
            </span>
            <button
              onClick={adicionar}
              className="flex items-center gap-1 rounded border border-cyan-500/60 bg-cyan-500/10 px-2.5 py-1 font-display text-[10px] font-semibold uppercase tracking-wider text-cyan-300 transition-all hover:bg-cyan-500/20"
            >
              <Plus size={11} /> adicionar campo
            </button>
          </>
        }
      >
        <p className="mb-3 font-mono text-[10px] leading-relaxed text-mist-500">
          Cada linha é uma regra: o valor de um <span className="text-cyan-300">campo</span> (extraído pela IA ou um{" "}
          <span className="text-amber-400">valor fixo</span>) é gravado na <span className="text-cyan-300">célula</span>.
          Um mesmo campo pode ir para várias células (ex: <span className="font-mono">endereco → C12 e D12</span>).
        </p>

        <div className="overflow-x-auto rounded border border-ink-600">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-ink-800">
                <th className="w-8 px-2 py-2 text-left font-mono text-[9px] uppercase tracking-wider text-mist-500">#</th>
                <th className="px-2 py-2 text-left font-mono text-[9px] uppercase tracking-wider text-mist-500">Campo (JSON)</th>
                <th className="w-24 px-2 py-2 text-left font-mono text-[9px] uppercase tracking-wider text-mist-500">Célula</th>
                <th className="px-2 py-2 text-left font-mono text-[9px] uppercase tracking-wider text-mist-500">Valor fixo (opcional)</th>
                <th className="w-28 px-2 py-2 text-left font-mono text-[9px] uppercase tracking-wider text-mist-500">Transformação</th>
                <th className="w-16 px-2 py-2 text-center font-mono text-[9px] uppercase tracking-wider text-mist-500">BR ,</th>
                <th className="w-10 px-2 py-2" />
              </tr>
            </thead>
            <tbody>
              {cfg.mapeamento.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-3 py-5 text-center font-mono text-[11px] text-mist-600">
                    mapa vazio — clique em “adicionar campo” para criar a primeira regra
                  </td>
                </tr>
              )}
              {cfg.mapeamento.map((m, i) => {
                const celInvalida = m.celula.trim() !== "" && !/^[A-Za-z]{1,3}\d+$/.test(m.celula.trim());
                const temFixo = m.valorFixo !== undefined && m.valorFixo !== "";
                return (
                  <tr key={m.id} className="group border-t border-ink-700 transition-colors hover:bg-cyan-400/5">
                    <td className="px-2 py-1.5 font-mono text-[10px] text-amber-500">{String(i + 1).padStart(2, "0")}</td>
                    <td className="px-2 py-1.5">
                      <input
                        list="campos-conhecidos"
                        value={m.campo}
                        onChange={(e) => setCampo(m.id, { campo: e.target.value })}
                        placeholder={temFixo || m.transformacao ? "—" : "ex: site_id_cliente"}
                        className={`field-input w-full px-2 py-1 font-mono text-[11px] ${celInvalida ? "" : ""}`}
                        disabled={temFixo || !!m.transformacao}
                      />
                      {m.campo && DESCRICOES_CAMPOS[m.campo.trim()] && !temFixo && !m.transformacao && (
                        <p className="mt-0.5 truncate font-mono text-[8.5px] text-mist-600">{DESCRICOES_CAMPOS[m.campo.trim()]}</p>
                      )}
                    </td>
                    <td className="px-2 py-1.5">
                      <input
                        value={m.celula}
                        onChange={(e) => setCampo(m.id, { celula: e.target.value.toUpperCase() })}
                        placeholder="B2"
                        className={`field-input w-full px-2 py-1 text-center font-mono text-[11px] font-semibold uppercase ${
                          celInvalida ? "!border-err-500/70 !text-err-400" : "text-cyan-300"
                        }`}
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <input
                        value={m.valorFixo ?? ""}
                        onChange={(e) => setCampo(m.id, { valorFixo: e.target.value, campo: e.target.value ? "" : m.campo })}
                        placeholder={m.campo ? "" : 'ex: "( X )"'}
                        className="field-input w-full px-2 py-1 font-mono text-[11px] text-amber-300/90"
                        disabled={!!m.transformacao}
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <select
                        value={m.transformacao ?? ""}
                        onChange={(e) => setCampo(m.id, { 
                          transformacao: e.target.value || undefined,
                          campo: e.target.value ? "" : m.campo,
                          valorFixo: e.target.value ? undefined : m.valorFixo
                        })}
                        className="field-input w-full px-2 py-1 font-mono text-[10px]"
                      >
                        <option value="">(nenhuma)</option>
                        <option value="area_base">área_base (nx × dim)</option>
                      </select>
                    </td>
                    <td className="px-2 py-1.5 text-center">
                      <button
                        onClick={() => setCampo(m.id, { br: !m.br })}
                        title="Converter ponto → vírgula (números BR)"
                        className={`mx-auto grid h-6 w-9 place-items-center rounded-full border font-mono text-[9px] font-bold transition-all ${
                          m.br
                            ? "border-ok-500 bg-ok-500/20 text-ok-400"
                            : "border-ink-500 text-mist-600 hover:border-mist-500"
                        }`}
                      >
                        {m.br ? "0,5" : "0.5"}
                      </button>
                    </td>
                    <td className="px-2 py-1.5">
                      <button
                        onClick={() => remover(m.id)}
                        className="grid h-6 w-6 place-items-center rounded border border-ink-600 text-mist-600 opacity-40 transition-all hover:border-err-400 hover:text-err-400 group-hover:opacity-100"
                        title="Remover regra"
                      >
                        <Trash2 size={11} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <datalist id="campos-conhecidos">
            {Array.from(new Set([...CAMPOS_CONHECIDOS, ...camposUsados])).map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-mist-500">
            <ListChecks size={12} className="text-cyan-400" />
            Tabela de equipamentos começa na linha
            <input
              type="number"
              min={1}
              value={cfg.linhaInicialEq}
              onChange={(e) => onChange({ ...cfg, linhaInicialEq: Math.max(1, Number(e.target.value) || 23) })}
              className="field-input w-16 px-2 py-1 text-center font-mono text-[11px] font-semibold text-cyan-300"
            />
          </label>
          <span className="font-mono text-[9px] text-mist-600">(colunas A→Q · OPERADORA, SITUAÇÃO, TIPO, … AEV C/ CA)</span>
        </div>
      </Secao>

      {/* ============ 1.5 ALIASES DE COLUNAS ============ */}
      <Secao
        titulo="Aliases de colunas (PDF → Sistema)"
        icone={<FileCog size={15} />}
        extra={
          <>
            <span className="rounded border border-ink-600 px-2 py-0.5 font-mono text-[9px] uppercase text-mist-500">
              {cfg.aliasesColunas.length} alias(es)
            </span>
            <button
              onClick={adicionarAlias}
              className="flex items-center gap-1 rounded border border-cyan-500/60 bg-cyan-500/10 px-2.5 py-1 font-display text-[10px] font-semibold uppercase tracking-wider text-cyan-300 transition-all hover:bg-cyan-500/20"
            >
              <Plus size={11} /> adicionar alias
            </button>
          </>
        }
      >
        <p className="mb-3 font-mono text-[10px] leading-relaxed text-mist-500">
          Mapeie nomes alternativos que podem aparecer no PDF para os campos do sistema.
          Exemplo: se o PDF usa <span className="font-mono text-cyan-300">"L"</span> em vez de{" "}
          <span className="font-mono text-cyan-300">"altura"</span>, adicione um alias.
        </p>

        <div className="overflow-x-auto rounded border border-ink-600">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-ink-800">
                <th className="w-8 px-2 py-2 text-left font-mono text-[9px] uppercase tracking-wider text-mist-500">#</th>
                <th className="px-2 py-2 text-left font-mono text-[9px] uppercase tracking-wider text-mist-500">Campo no Sistema</th>
                <th className="px-2 py-2 text-left font-mono text-[9px] uppercase tracking-wider text-mist-500">Alias no PDF</th>
                <th className="w-10 px-2 py-2" />
              </tr>
            </thead>
            <tbody>
              {cfg.aliasesColunas.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-3 py-5 text-center font-mono text-[11px] text-mist-600">
                    nenhum alias configurado — clique em "adicionar alias" para criar
                  </td>
                </tr>
              )}
              {cfg.aliasesColunas.map((a, i) => (
                <tr key={a.id} className="group border-t border-ink-700 transition-colors hover:bg-cyan-400/5">
                  <td className="px-2 py-1.5 font-mono text-[10px] text-amber-500">{String(i + 1).padStart(2, "0")}</td>
                  <td className="px-2 py-1.5">
                    <input
                      list="campos-sistema"
                      value={a.campoSistema}
                      onChange={(e) => setAlias(a.id, { campoSistema: e.target.value })}
                      placeholder="ex: altura"
                      className="field-input w-full px-2 py-1 font-mono text-[11px]"
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <input
                      value={a.aliasPdf}
                      onChange={(e) => setAlias(a.id, { aliasPdf: e.target.value })}
                      placeholder="ex: L, Length, H"
                      className="field-input w-full px-2 py-1 font-mono text-[11px] text-cyan-300"
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <button
                      onClick={() => removerAlias(a.id)}
                      className="grid h-6 w-6 place-items-center rounded border border-ink-600 text-mist-600 opacity-40 transition-all hover:border-err-400 hover:text-err-400 group-hover:opacity-100"
                      title="Remover alias"
                    >
                      <Trash2 size={11} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <datalist id="campos-sistema">
            <option value="altura" />
            <option value="largura" />
            <option value="profundidade" />
            <option value="azimute" />
            <option value="qtde" />
            <option value="tipo_equipamento" />
            <option value="fabricante" />
            <option value="modelo" />
          </datalist>
        </div>

        <p className="mt-2 font-mono text-[9px] leading-relaxed text-mist-600">
          💡 <span className="text-amber-400">Dica:</span> Os aliases são aplicados durante a normalização dos dados.
          Se o PDF usar "L" para altura, o sistema vai automaticamente mapear para o campo "altura".
          Verifique o log completo para ver quais aliases foram aplicados.
        </p>
      </Secao>

      {/* ============ 2. INSTRUÇÕES DO PROMPT ============ */}
      <Secao
        titulo="Instruções de extração (o que a IA procura)"
        icone={<Wand2 size={15} />}
        extra={
          <button
            onClick={restaurarInstrucoes}
            className="flex items-center gap-1 rounded border border-ink-500 px-2.5 py-1 font-mono text-[9px] uppercase tracking-wider text-mist-400 transition-colors hover:border-amber-500 hover:text-amber-400"
          >
            <RotateCcw size={10} /> instruções padrão
          </button>
        }
      >
        <p className="mb-2 font-mono text-[10px] leading-relaxed text-mist-500">
          Regras livres que vão no topo do prompt. O <span className="text-cyan-300">mapa de células acima</span> e o{" "}
          <span className="text-cyan-300">schema JSON</span> são injetados automaticamente — não precisa repeti-los aqui.
        </p>
        <textarea
          value={cfg.instrucoes}
          onChange={(e) => onChange({ ...cfg, instrucoes: e.target.value })}
          rows={11}
          spellCheck={false}
          className="field-input w-full resize-y px-3 py-2.5 font-mono text-[11px] leading-relaxed text-mist-200"
        />
        <p className="mt-1 text-right font-mono text-[9px] text-mist-600">{cfg.instrucoes.length} caracteres</p>
      </Secao>

      {/* ============ 3. PROMPT FINAL ============ */}
      <Secao
        titulo="Prompt final enviado ao Gemini"
        icone={<Sparkles size={15} />}
        extra={
          <>
            <span className="rounded border border-ink-600 px-2 py-0.5 font-mono text-[9px] uppercase text-mist-500">
              gerado automaticamente · {promptFinal.length} chars
            </span>
            <button
              onClick={copiarPrompt}
              className="flex items-center gap-1 rounded border border-ink-500 px-2.5 py-1 font-mono text-[9px] uppercase tracking-wider text-mist-300 transition-colors hover:border-cyan-400 hover:text-cyan-300"
            >
              {copiado ? <Check size={10} className="text-ok-400" /> : <Copy size={10} />}
              {copiado ? "copiado" : "copiar"}
            </button>
            <button
              onClick={() => setMostrarPrompt((v) => !v)}
              className="rounded border border-ink-500 px-2.5 py-1 font-mono text-[9px] uppercase tracking-wider text-mist-300 transition-colors hover:border-cyan-400 hover:text-cyan-300"
            >
              {mostrarPrompt ? "ocultar" : "ver"}
            </button>
          </>
        }
      >
        {mostrarPrompt ? (
          <pre className="max-h-80 overflow-auto whitespace-pre-wrap break-words rounded border border-ink-600 bg-ink-950/70 p-3.5 font-mono text-[10.5px] leading-relaxed text-cyan-300/80">
            {promptFinal}
          </pre>
        ) : (
          <p className="font-mono text-[10px] text-mist-600">prompt oculto — clique em “ver” para inspecionar.</p>
        )}
        <p className="mt-2 font-mono text-[9px] leading-relaxed text-mist-600">
          Este bloco é <span className="text-amber-400">montado em tempo real</span>: instruções + mapa de células +
          schema dos campos usados. Edite as seções acima — nunca este texto diretamente.
        </p>
      </Secao>
    </main>
  );
}


