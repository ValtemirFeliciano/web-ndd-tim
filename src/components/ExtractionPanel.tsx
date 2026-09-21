import { AlertTriangle, Crosshair, MapPin, Plus, Puzzle, Trash2, Wrench } from "lucide-react";
import { CAMPOS_PRINCIPAIS, EQUIPAMENTO_VAZIO, type DadosPPI, type Equipamento } from "../types";

interface Props {
  dados: DadosPPI;
  avisos: string[];
  meta: { arquivo: string; modelo: string; duracaoMs: number; em: string } | null;
  onCampo: (chave: keyof DadosPPI, valor: string) => void;
  onEquip: (idx: number, chave: keyof Equipamento, valor: string) => void;
  onAddEquip: () => void;
  onRemoveEquip: (idx: number) => void;
  onExtra?: (chave: string, valor: string) => void;
}

function Campo({
  rotulo, valor, onChange, mono = true, celula,
}: {
  rotulo: string;
  valor: string;
  onChange: (v: string) => void;
  mono?: boolean;
  celula?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 flex items-baseline justify-between">
        <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-mist-500">{rotulo}</span>
        {celula && <span className="font-mono text-[9px] text-cyan-500/80">→ {celula}</span>}
      </span>
      <input
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        className={`field-input ${mono ? "font-mono text-xs" : ""} ${valor ? "" : "input-empty"}`}
        placeholder={valor ? "" : "não encontrado"}
      />
    </label>
  );
}

function Grupo({ titulo, icone, children }: { titulo: string; icone: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded border border-ink-600 bg-ink-950/35 p-3.5">
      <h4 className="mb-3 flex items-center gap-2 font-display text-[11px] font-semibold uppercase tracking-[0.14em] text-amber-400">
        {icone}
        {titulo}
      </h4>
      {children}
    </section>
  );
}

const COLS_EQ: { chave: keyof Equipamento; rotulo: string; minW: string; align?: string }[] = [
  { chave: "tipo_equipamento", rotulo: "Tipo", minW: "min-w-[100px]" },
  { chave: "modelo", rotulo: "Modelo", minW: "min-w-[180px]" },
  { chave: "qtde", rotulo: "Qtde", minW: "min-w-[55px]", align: "text-center" },
  { chave: "azimute", rotulo: "Azimute", minW: "min-w-[130px]", align: "text-center" },
  { chave: "comprimento", rotulo: "Compr.", minW: "min-w-[80px]", align: "text-center" },
  { chave: "largura", rotulo: "Larg.", minW: "min-w-[80px]", align: "text-center" },
  { chave: "profundidade", rotulo: "Prof.", minW: "min-w-[80px]", align: "text-center" },
  { chave: "rad_center", rotulo: "Rad.Ctr", minW: "min-w-[90px]", align: "text-center" },
  { chave: "aev_sem_ca", rotulo: "AEV s/CA", minW: "min-w-[95px]", align: "text-center" },
  { chave: "ca", rotulo: "CA", minW: "min-w-[65px]", align: "text-center" },
  { chave: "aev_com_ca", rotulo: "AEV c/CA", minW: "min-w-[95px]", align: "text-center" },
];

export default function ExtractionPanel({ dados, avisos, meta, onCampo, onEquip, onAddEquip, onRemoveEquip, onExtra }: Props) {
  const extras = dados.extras ?? {};
  const chavesExtras = Object.keys(extras);
  const preenchidos = CAMPOS_PRINCIPAIS.filter((c) => String(dados[c.chave] ?? "").trim() !== "").length;
  const pct = Math.round((preenchidos / CAMPOS_PRINCIPAIS.length) * 100);

  return (
    <div className="rise-in grid gap-4">
      {/* medidor de preenchimento */}
      <div className="tick-panel rounded-md p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-display text-base font-semibold text-mist-100">Dados extraídos do PPI</h3>
            <p className="font-mono text-[10px] uppercase tracking-wider text-mist-500">
              tudo é editável — corrija antes de gerar o Excel
            </p>
          </div>
          <div className="text-right">
            <p className="font-display text-2xl font-bold leading-none text-amber-400">
              {preenchidos}<span className="text-sm text-mist-500">/{CAMPOS_PRINCIPAIS.length}</span>
            </p>
            <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-mist-500">campos no cabeçalho</p>
          </div>
        </div>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-ink-800">
          <div
            className="h-full rounded-full bg-gradient-to-r from-amber-600 via-amber-500 to-ok-400 transition-all duration-700"
            style={{ width: `${pct}%` }}
          />
        </div>
        {meta && (
          <p className="mt-2.5 font-mono text-[10px] text-mist-500">
            <span className="text-cyan-400">{meta.arquivo}</span> · modelo <span className="text-cyan-400">{meta.modelo}</span> ·{" "}
            {(meta.duracaoMs / 1000).toFixed(1)}s ·{" "}
            {new Date(meta.em).toLocaleTimeString("pt-BR")} · {dados.equipamentos.length} equipamento(s)
          </p>
        )}
      </div>

      {avisos.length > 0 && (
        <div className="fade-in rounded border border-warn-400/40 bg-warn-400/8 p-3">
          <p className="mb-1.5 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-warn-400">
            <AlertTriangle size={12} /> Avisos de validação ({avisos.length})
          </p>
          <ul className="grid gap-1">
            {avisos.map((a, i) => (
              <li key={i} className="font-mono text-[11px] leading-snug text-warn-400/90">▸ {a}</li>
            ))}
          </ul>
        </div>
      )}

      <Grupo titulo="Identificação do site" icone={<Crosshair size={13} />}>
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo rotulo="Site ID Cliente" celula="C9" valor={dados.site_id_cliente} onChange={(v) => onCampo("site_id_cliente", v)} />
          <Campo rotulo="Site ID Detentor" celula="P9" valor={dados.site_id_detentor} onChange={(v) => onCampo("site_id_detentor", v)} />
        </div>
      </Grupo>

      <Grupo titulo="Localização" icone={<MapPin size={13} />}>
        <div className="grid gap-3">
          <Campo rotulo="Endereço completo" celula="D12" mono={false} valor={dados.endereco} onChange={(v) => onCampo("endereco", v)} />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Campo rotulo="Bairro" celula="B13" mono={false} valor={dados.bairro} onChange={(v) => onCampo("bairro", v)} />
            <Campo rotulo="Cidade" celula="I13" mono={false} valor={dados.cidade} onChange={(v) => onCampo("cidade", v)} />
            <Campo rotulo="CEP" celula="O13" valor={dados.cep} onChange={(v) => onCampo("cep", v)} />
            <Campo rotulo="UF" celula="S13" valor={dados.uf} onChange={(v) => onCampo("uf", v)} />
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Campo rotulo="Latitude" celula="C11" valor={dados.latitude} onChange={(v) => onCampo("latitude", v)} />
            <Campo rotulo="Longitude" celula="J11" valor={dados.longitude} onChange={(v) => onCampo("longitude", v)} />
            <Campo rotulo="Altura da EV (m)" celula="D14" valor={dados.altura_ev} onChange={(v) => onCampo("altura_ev", v)} />
          </div>
        </div>
      </Grupo>

      {chavesExtras.length > 0 && onExtra && (
        <Grupo titulo={`Campos personalizados (${chavesExtras.length})`} icone={<Puzzle size={13} />}>
          <p className="mb-3 font-mono text-[10px] leading-relaxed text-mist-600">
            Campos extras que você configurou na aba <span className="text-cyan-400">Mapeamento &amp; Prompt</span> e a IA
            encontrou no PPI. Edite antes de gerar o Excel.
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
            {chavesExtras.map((k) => (
              <Campo key={k} rotulo={k} valor={extras[k]} onChange={(v) => onExtra(k, v)} />
            ))}
          </div>
        </Grupo>
      )}

      <Grupo titulo={`Equipamentos na EV (${dados.equipamentos.length})`} icone={<Wrench size={13} />}>
        {dados.equipamentos.length === 0 ? (
          <p className="rounded border border-dashed border-ink-500 px-3 py-4 text-center font-mono text-[11px] text-mist-500">
            nenhum equipamento extraído — adicione manualmente abaixo
          </p>
        ) : (
          <div className="overflow-x-auto rounded border border-ink-600 shadow-inner">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-ink-800/90">
                  <th className="w-10 px-2.5 py-2 text-center font-mono text-[9px] uppercase tracking-wider text-mist-500">#</th>
                  {COLS_EQ.map((c) => (
                    <th key={c.chave} className={`px-2 py-2 font-mono text-[9px] uppercase tracking-wider text-mist-500 ${c.align ?? "text-left"} ${c.minW}`}>
                      {c.rotulo}
                    </th>
                  ))}
                  <th className="w-10 px-1 py-2 text-center" />
                </tr>
              </thead>
              <tbody>
                {dados.equipamentos.map((eq, i) => (
                  <tr key={i} className="border-t border-ink-700/80 transition-colors hover:bg-cyan-400/5">
                    <td className="px-2 py-1.5 text-center font-mono text-[10px] font-semibold text-amber-400">{String(i + 1).padStart(2, "0")}</td>
                    {COLS_EQ.map((c) => (
                      <td key={c.chave} className={`px-1.5 py-1.5 ${c.minW}`}>
                        <input
                          value={String(eq[c.chave] ?? "")}
                          onChange={(e) => onEquip(i, c.chave, e.target.value)}
                          className={`field-input w-full px-2 py-1.5 font-mono text-xs ${c.align ?? "text-left"} ${eq[c.chave] ? "" : "input-empty"}`}
                        />
                      </td>
                    ))}
                    <td className="px-1.5 py-1.5 text-center">
                      <button
                        onClick={() => onRemoveEquip(i)}
                        className="mx-auto grid h-7 w-7 place-items-center rounded border border-ink-600 text-mist-500 transition-colors hover:border-err-400 hover:text-err-400"
                        title="Remover equipamento"
                      >
                        <Trash2 size={12} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <button
          onClick={onAddEquip}
          className="mt-2.5 inline-flex items-center gap-1.5 rounded border border-dashed border-ink-500 px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider text-mist-300 transition-colors hover:border-amber-500 hover:text-amber-400"
        >
          <Plus size={12} /> adicionar equipamento
        </button>
      </Grupo>

      {dados.rastreabilidade && Object.values(dados.rastreabilidade).some((v) => v) && (
        <div className="rounded border border-cyan-500/25 bg-cyan-400/5 p-3.5">
          <p className="mb-2 font-mono text-[9px] uppercase tracking-[0.18em] text-cyan-400">Rastreabilidade — onde a IA encontrou cada dado</p>
          <div className="grid gap-1.5">
            {Object.entries(dados.rastreabilidade).map(([k, v]) => (
              <p key={k} className="font-mono text-[11px] leading-snug text-mist-300">
                <span className="text-mist-600">{k.replace(/_/g, " ")}:</span> {v || "—"}
              </p>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export { EQUIPAMENTO_VAZIO };
