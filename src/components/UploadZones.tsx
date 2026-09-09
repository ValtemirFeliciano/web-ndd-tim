import { useRef, useState, type DragEvent } from "react";
import { Download, FileSpreadsheet, FileText, UploadCloud, X } from "lucide-react";
import type { ArquivoInfo, TemplateInfo } from "../types";
import { baixarTemplatePadrao } from "../lib/excel";

export function formatarBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

interface ZonaProps {
  titulo: string;
  descricao: string;
  aceite: string;
  obrigatorio: boolean;
  arquivo: { nome: string; tamanho: number } | null;
  aoEscolher: (file: File) => string | null; // retorna erro ou null
  aoRemover: () => void;
  desabilitado: boolean;
  icone: "pdf" | "xlsx";
}

function ZonaDrop({ titulo, descricao, aceite, obrigatorio, arquivo, aoEscolher, aoRemover, desabilitado, icone }: ZonaProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [arrastando, setArrastando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const soltar = (e: DragEvent) => {
    e.preventDefault();
    setArrastando(false);
    if (desabilitado) return;
    const f = e.dataTransfer.files?.[0];
    if (f) setErro(aoEscolher(f));
  };

  return (
    <div className={`tick-panel panel-hot min-w-0 overflow-hidden rounded-md p-4 ${desabilitado ? "opacity-60" : ""}`}>
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <h3 className="font-display text-sm font-semibold uppercase tracking-wide text-mist-100">{titulo}</h3>
        <span className={`font-mono text-[9px] uppercase tracking-[0.18em] ${obrigatorio ? "text-amber-500" : "text-mist-500"}`}>
          {obrigatorio ? "obrigatório" : "opcional"}
        </span>
      </div>

      {!arquivo ? (
        <button
          onClick={() => !desabilitado && inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            if (!desabilitado) setArrastando(true);
          }}
          onDragLeave={() => setArrastando(false)}
          onDrop={soltar}
          disabled={desabilitado}
          className={`flex w-full flex-col items-center gap-2 rounded border-2 border-dashed px-4 py-7 transition-all duration-200 ${
            arrastando
              ? "border-amber-500 bg-amber-500/10 scale-[1.01]"
              : "border-ink-500 bg-ink-950/40 hover:border-cyan-400/70 hover:bg-cyan-400/5"
          }`}
        >
          <UploadCloud size={26} className={arrastando ? "text-amber-400" : "text-mist-500"} strokeWidth={1.6} />
          <span className="font-display text-xs font-semibold text-mist-300">
            {arrastando ? "Solte o arquivo aqui" : "Clique ou arraste o arquivo"}
          </span>
          <span className="font-mono text-[10px] uppercase tracking-wider text-mist-600">{descricao}</span>
        </button>
      ) : (
        <div className="fade-in flex min-w-0 items-center gap-3 overflow-hidden rounded border border-ok-500/35 bg-ok-500/8 px-3 py-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded bg-ink-800 text-cyan-300">
            {icone === "pdf" ? <FileText size={19} /> : <FileSpreadsheet size={19} />}
          </div>
          <div className="min-w-0 flex-1 overflow-hidden">
            <p className="truncate break-all font-mono text-xs font-medium text-mist-100" title={arquivo.nome}>
              {arquivo.nome}
            </p>
            <p className="truncate font-mono text-[10px] uppercase tracking-wider text-ok-400">
              carregado · {formatarBytes(arquivo.tamanho)} ✓
            </p>
          </div>
          <button
            onClick={aoRemover}
            disabled={desabilitado}
            className="grid h-7 w-7 shrink-0 place-items-center rounded border border-ink-500 text-mist-500 transition-colors hover:border-err-400 hover:text-err-400"
            title="Remover arquivo"
          >
            <X size={13} />
          </button>
        </div>
      )}

      {erro && (
        <p className="fade-in mt-2 rounded border border-err-500/40 bg-err-500/10 px-2.5 py-1.5 font-mono text-[11px] text-err-400">
          {erro}
        </p>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={aceite}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) setErro(aoEscolher(f));
          e.target.value = "";
        }}
      />
    </div>
  );
}

interface Props {
  ppi: ArquivoInfo | null;
  template: TemplateInfo | null;
  aoEscolherPpi: (f: File) => string | null;
  aoRemoverPpi: () => void;
  aoEscolherTemplate: (f: File) => string | null;
  aoRemoverTemplate: () => void;
  processando: boolean;
}

export default function UploadZones(props: Props) {
  return (
    <div className="min-w-0 grid gap-4 overflow-hidden">
      <ZonaDrop
        titulo="01 · Relatório PPI"
        descricao="PDF do projeto executivo · máx 18 MB"
        aceite="application/pdf,.pdf,image/png,image/jpeg"
        obrigatorio
        icone="pdf"
        arquivo={props.ppi ? { nome: props.ppi.nome, tamanho: props.ppi.tamanho } : null}
        aoEscolher={props.aoEscolherPpi}
        aoRemover={props.aoRemoverPpi}
        desabilitado={props.processando}
      />
      <ZonaDrop
        titulo="02 · Template NDD"
        descricao=".xlsx com a aba NDD · se vazio, usa o modelo embutido"
        aceite=".xlsx,.xlsm,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        obrigatorio={false}
        icone="xlsx"
        arquivo={props.template ? { nome: props.template.nome, tamanho: props.template.tamanho } : null}
        aoEscolher={props.aoEscolherTemplate}
        aoRemover={props.aoRemoverTemplate}
        desabilitado={props.processando}
      />
      <button
        onClick={async () => {
          try {
            await baixarTemplatePadrao();
          } catch (e: any) {
            alert(`Erro ao baixar template: ${e.message}`);
          }
        }}
        className="flex w-full items-center justify-center gap-2 rounded border border-cyan-500/40 bg-cyan-400/5 px-4 py-2.5 font-display text-xs font-semibold uppercase tracking-wide text-cyan-300 transition-all hover:border-cyan-400 hover:bg-cyan-400/10"
      >
        <Download size={14} />
        Baixar template padrão para editar
      </button>
    </div>
  );
}
