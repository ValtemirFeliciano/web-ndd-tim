import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import {
  AlertCircle,
  AlertTriangle,
  Archive,
  ArrowRight,
  CheckCircle2,
  Clock,
  Download,
  Edit3,
  ExternalLink,
  Eye,
  FileSpreadsheet,
  FileText,
  Filter,
  FolderArchive,
  FolderCheck,
  FolderCog,
  FolderOpen,
  FolderPlus,
  Info,
  Layers,
  Loader2,
  Pause,
  Play,
  Plus,
  RefreshCw,
  Save,
  Trash2,
  Upload,
  X,
  XCircle,
  Zap,
} from "lucide-react";
import type { ConfigAutomacao, DadosPPI, Equipamento, LogLevel, TemplateInfo, TipoProjeto } from "../types";
import {
  selecionarPastaEntrada,
  selecionarPastaSaida,
  salvarArquivosEmPasta,
  gerarPacoteZip,
  lerArquivoComoBase64,
  suportaDirectoryPicker,
  type ArquivoLoteInfo,
  type ArquivoSalvar,
} from "../lib/fileSystem";
import { usePastaPadrao } from "../hooks/usePastaPadrao";
import { extrairDoPdf, validarDados } from "../lib/gemini";
import { gerarNddPreenchido, baixarBlob } from "../lib/excel";
import { formatarBytes } from "./UploadZones";

export interface ItemLote {
  id: string;
  file: File;
  nome: string;
  caminhoRelativo: string;
  tamanho: number;
  status: "pendente" | "processando" | "sucesso" | "aviso" | "erro";
  dataRfiIndividual?: string;
  dados?: DadosPPI;
  avisos?: string[];
  erro?: string;
  duracaoMs?: number;
  tentativas?: number;
  modeloUsado?: string;
}

interface Props {
  apiKey: string;
  modelo: string;
  cfg: ConfigAutomacao;
  tipoProjeto: TipoProjeto;
  promptFinal: string;
  templateBuffer: ArrayBuffer | null;
  log: (level: LogLevel, msg: string, detalhe?: string) => void;
}

const INTERVALO_RATE_LIMIT_MS = 4500; // ~13 RPM — margem de segurança estrita para cota gratuita
const TEMPO_ESPERA_429_S = 60; // 60 segundos de pausa se atingir cota 429

export default function MassProcessingPage({
  apiKey,
  modelo,
  cfg,
  tipoProjeto,
  promptFinal,
  templateBuffer: templateBufferApp,
  log,
}: Props) {
  const pastaPadrao = usePastaPadrao();
  const [itens, setItens] = useState<ItemLote[]>([]);
  const [recursivo, setRecursivo] = useState(true);
  const [lendoPasta, setLendoPasta] = useState(false);

  // Template customizado opcional específico para este lote
  const [templateLote, setTemplateLote] = useState<TemplateInfo | null>(null);

  // Modo da Data de RFI
  const [modoRfi, setModoRfi] = useState<"global" | "individual">("global");
  const [dataRfiGlobal, setDataRfiGlobal] = useState("");

  // Estado da Fila de Execução
  const [executando, setExecutando] = useState(false);
  const [pausado, setPausado] = useState(false);
  const pausadoRef = useRef(false);
  pausadoRef.current = pausado;
  const abortarRef = useRef(false);

  // Tratamento de 429 / Cota Excedida
  const [espera429, setEspera429] = useState<number | null>(null);

  // Item ativo em processamento
  const [itemAtualId, setItemAtualId] = useState<string | null>(null);

  // Filtro de exibição na tabela
  const [filtro, setFiltro] = useState<"todos" | "pendente" | "sucesso" | "aviso" | "erro">("todos");

  // Item selecionado para inspeção / edição detalhada no Modal
  const [itemInspecao, setItemInspecao] = useState<ItemLote | null>(null);

  // Estado de exportação em lote
  const [exportando, setExportando] = useState(false);
  const [progressoExportacao, setProgressoExportacao] = useState<{ atual: number; total: number; msg: string } | null>(null);
  const [sucessoExportacao, setSucessoExportacao] = useState<{ total: number; pasta?: string } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const templateInputRef = useRef<HTMLInputElement>(null);

  // Contadores de status
  const metricas = useMemo(() => {
    const total = itens.length;
    const pendentes = itens.filter((i) => i.status === "pendente").length;
    const processando = itens.filter((i) => i.status === "processando").length;
    const sucesso = itens.filter((i) => i.status === "sucesso").length;
    const aviso = itens.filter((i) => i.status === "aviso").length;
    const erro = itens.filter((i) => i.status === "erro").length;
    const concluidos = sucesso + aviso;
    const percentual = total > 0 ? Math.round((concluidos / total) * 100) : 0;
    return { total, pendentes, processando, sucesso, aviso, erro, concluidos, percentual };
  }, [itens]);

  // Itens filtrados para a tabela
  const itensFiltrados = useMemo(() => {
    if (filtro === "todos") return itens;
    return itens.filter((i) => i.status === filtro);
  }, [itens, filtro]);

  /* ------------------------------------------------------------------ */
  /*  Seleção de Pasta e Carregamento de PDFs                           */
  /* ------------------------------------------------------------------ */

  const aoSelecionarPastaNativa = async () => {
    try {
      setLendoPasta(true);
      log("info", `Iniciando leitura da pasta de PPIs (modo recursivo: ${recursivo ? "ativado" : "desativado"})…`);
      const arquivos = await selecionarPastaEntrada(recursivo);
      if (arquivos.length === 0) {
        log("warn", "Nenhum arquivo PDF encontrado na pasta selecionada.");
        return;
      }
      const novosItens: ItemLote[] = arquivos.map((arq) => ({
        id: arq.id,
        file: arq.file,
        nome: arq.nome,
        caminhoRelativo: arq.caminhoRelativo,
        tamanho: arq.tamanho,
        status: "pendente",
      }));
      setItens(novosItens);
      log("ok", `${arquivos.length} arquivo(s) PDF carregado(s) para o lote com sucesso.`);
    } catch (e: any) {
      if (e?.name !== "AbortError") {
        log("error", `Erro ao selecionar pasta: ${e?.message ?? e}`);
      }
    } finally {
      setLendoPasta(false);
    }
  };

  const aoSelecionarPastaFallback = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const lista: ItemLote[] = [];
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      if (f.name.toLowerCase().endsWith(".pdf")) {
        const rel = (f as any).webkitRelativePath || f.name;
        lista.push({
          id: `${rel}_${f.size}_${f.lastModified}`,
          file: f,
          nome: f.name,
          caminhoRelativo: rel,
          tamanho: f.size,
          status: "pendente",
        });
      }
    }
    if (lista.length > 0) {
      lista.sort((a, b) => a.caminhoRelativo.localeCompare(b.caminhoRelativo));
      setItens(lista);
      log("ok", `${lista.length} PDF(s) carregado(s) via upload de pasta.`);
    } else {
      log("warn", "Nenhum arquivo PDF encontrado no upload de pasta.");
    }
    e.target.value = "";
  };

  const limparLote = () => {
    if (executando) return;
    setItens([]);
    setItemAtualId(null);
    setSucessoExportacao(null);
    log("info", "Lote de arquivos limpo.");
  };

  /* ------------------------------------------------------------------ */
  /*  Upload de Template Customizado para o Lote                        */
  /* ------------------------------------------------------------------ */

  const aoCarregarTemplateLote = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".xlsx")) {
      log("error", "O template precisa ser um arquivo Excel (.xlsx).");
      return;
    }
    const buffer = await file.arrayBuffer();
    setTemplateLote({
      nome: file.name,
      tamanho: file.size,
      buffer,
    });
    log("ok", `Template customizado "${file.name}" carregado para o lote.`);
    e.target.value = "";
  };

  const removerTemplateLote = () => {
    setTemplateLote(null);
    log("info", "Template customizado do lote removido. Voltando ao template padrão do projeto.");
  };

  /* ------------------------------------------------------------------ */
  /*  Fila Sequencial com Rate Limiter e Detecção de 429                */
  /* ------------------------------------------------------------------ */

  const dormir = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  const iniciarProcessamentoLote = async (apenasErros = false) => {
    const chaveLimpa = (apiKey || "").trim();
    if (!chaveLimpa) {
      log("error", "Chave da API Gemini não configurada. Configure a API no topo da página antes de iniciar.");
      return;
    }

    abortarRef.current = false;
    setPausado(false);
    setExecutando(true);
    setSucessoExportacao(null);

    log("info", `Iniciando execução da fila em massa (Cadência segura: ~${(INTERVALO_RATE_LIMIT_MS / 1000).toFixed(1)}s por requisição)…`);

    // Pegamos a lista atual de itens que precisam ser processados
    const fila = itens.filter((item) => {
      if (apenasErros) return item.status === "erro";
      return item.status === "pendente" || item.status === "erro";
    });

    for (let idx = 0; idx < fila.length; idx++) {
      if (abortarRef.current) {
        log("warn", "Execução do lote cancelada pelo usuário.");
        break;
      }

      // Verificação de Pausa
      while (pausadoRef.current && !abortarRef.current) {
        await dormir(500);
      }
      if (abortarRef.current) break;

      const item = fila[idx];
      setItemAtualId(item.id);

      // Marca item como 'processando'
      setItens((prev) =>
        prev.map((it) => (it.id === item.id ? { ...it, status: "processando", erro: undefined } : it))
      );

      let sucessoItem = false;
      let tentativaItem = 1;

      while (!sucessoItem && tentativaItem <= 2 && !abortarRef.current) {
        try {
          log("info", `[${idx + 1}/${fila.length}] Lendo PDF "${item.nome}"…`);
          const { base64, mime } = await lerArquivoComoBase64(item.file);

          log("info", `[${idx + 1}/${fila.length}] Enviando requisição ao Gemini (${modelo})…`);
          const resultado = await extrairDoPdf(
            chaveLimpa,
            modelo,
            { nome: item.nome, tamanho: item.tamanho, mime, base64 },
            promptFinal,
            cfg.aliasesColunas ?? [],
            log
          );

          const avisosValidacao = validarDados(resultado.dados);
          const novoStatus = avisosValidacao.length > 0 ? "aviso" : "sucesso";

          // Se a IA extraiu data_rfi e o item não tinha valor individual ainda, inicializa
          const dataExtraida = resultado.dados.data_rfi || "";

          setItens((prev) =>
            prev.map((it) =>
              it.id === item.id
                ? {
                    ...it,
                    status: novoStatus,
                    dados: resultado.dados,
                    avisos: avisosValidacao,
                    dataRfiIndividual: it.dataRfiIndividual || dataExtraida,
                    duracaoMs: resultado.duracaoMs,
                    tentativas: resultado.tentativas,
                    modeloUsado: resultado.modeloUsado,
                  }
                : it
            )
          );

          log(
            novoStatus === "sucesso" ? "ok" : "warn",
            `[${idx + 1}/${fila.length}] Extração de "${item.nome}" concluída (${resultado.duracaoMs}ms) — Site ID: "${resultado.dados.site_id_cliente || resultado.dados.site_id_detentor || "-"}" · ${resultado.dados.equipamentos.length} eq.`
          );

          sucessoItem = true;
        } catch (err: any) {
          const msgErro = err?.message || String(err);
          const eh429 = msgErro.includes("429") || msgErro.toLowerCase().includes("quota") || msgErro.toLowerCase().includes("resource exhausted");

          if (eh429) {
            log("warn", `[429] Limite de cota atingido na extração de "${item.nome}". Ativando pausa automática de ${TEMPO_ESPERA_429_S}s…`);
            // Inicia contagem regressiva de espera
            for (let seg = TEMPO_ESPERA_429_S; seg > 0; seg--) {
              if (abortarRef.current) break;
              setEspera429(seg);
              await dormir(1000);
            }
            setEspera429(null);
            if (abortarRef.current) break;
            log("info", "Pausa de cota concluída. Retentando requisição…");
            tentativaItem++;
            continue;
          }

          // Se for outro erro ou esgotou tentativas
          log("error", `[${idx + 1}/${fila.length}] Falha em "${item.nome}": ${msgErro}`);
          setItens((prev) =>
            prev.map((it) =>
              it.id === item.id ? { ...it, status: "erro", erro: msgErro } : it
            )
          );
          break;
        }
      }

      setItemAtualId(null);

      // Intervalo de segurança obrigatório entre requisições para respeitar os ~15 RPM
      if (idx < fila.length - 1 && !abortarRef.current) {
        await dormir(INTERVALO_RATE_LIMIT_MS);
      }
    }

    setExecutando(false);
    setPausado(false);
    setItemAtualId(null);
    log("ok", "Processamento da fila em massa finalizado!");
  };

  const alternarPausa = () => {
    setPausado((prev) => {
      const novo = !prev;
      log("info", novo ? "Fila de processamento pausada." : "Fila de processamento retomada.");
      return novo;
    });
  };

  const cancelarExecucao = () => {
    abortarRef.current = true;
    setPausado(false);
    setExecutando(false);
    setEspera429(null);
    setItemAtualId(null);
    log("warn", "Comando de cancelamento enviado para a fila.");
  };

  const reprocessarItem = async (itemId: string) => {
    const item = itens.find((i) => i.id === itemId);
    if (!item || executando) return;

    const chaveLimpa = (apiKey || "").trim();
    if (!chaveLimpa) {
      log("error", "Chave da API Gemini não configurada.");
      return;
    }

    setItens((prev) =>
      prev.map((it) => (it.id === itemId ? { ...it, status: "processando", erro: undefined } : it))
    );

    try {
      log("info", `Re-extraindo arquivo "${item.nome}"…`);
      const { base64, mime } = await lerArquivoComoBase64(item.file);
      const resultado = await extrairDoPdf(
        chaveLimpa,
        modelo,
        { nome: item.nome, tamanho: item.tamanho, mime, base64 },
        promptFinal,
        cfg.aliasesColunas ?? [],
        log
      );
      const avisos = validarDados(resultado.dados);
      const status = avisos.length > 0 ? "aviso" : "sucesso";

      setItens((prev) =>
        prev.map((it) =>
          it.id === itemId
            ? {
                ...it,
                status,
                dados: resultado.dados,
                avisos,
                dataRfiIndividual: it.dataRfiIndividual || resultado.dados.data_rfi || "",
                duracaoMs: resultado.duracaoMs,
                tentativas: resultado.tentativas,
                modeloUsado: resultado.modeloUsado,
              }
            : it
        )
      );
      log("ok", `Re-extração de "${item.nome}" finalizada com sucesso.`);
    } catch (err: any) {
      log("error", `Erro na re-extração de "${item.nome}": ${err?.message || err}`);
      setItens((prev) =>
        prev.map((it) => (it.id === itemId ? { ...it, status: "erro", erro: err?.message || String(err) } : it))
      );
    }
  };

  const removerItem = (itemId: string) => {
    if (executando) return;
    setItens((prev) => prev.filter((i) => i.id !== itemId));
  };

  /* ------------------------------------------------------------------ */
  /*  Edição de Campos / Data do RFI                                     */
  /* ------------------------------------------------------------------ */

  const atualizarDataRfiIndividual = (itemId: string, valor: string) => {
    setItens((prev) =>
      prev.map((it) => (it.id === itemId ? { ...it, dataRfiIndividual: valor } : it))
    );
  };

  const salvarEdicaoInspecao = (dadosAtualizados: DadosPPI, dataRfi: string) => {
    if (!itemInspecao) return;
    const avisosNovos = validarDados(dadosAtualizados);
    const statusNovo = avisosNovos.length > 0 ? "aviso" : "sucesso";

    setItens((prev) =>
      prev.map((it) =>
        it.id === itemInspecao.id
          ? {
              ...it,
              dados: dadosAtualizados,
              dataRfiIndividual: dataRfi,
              avisos: avisosNovos,
              status: statusNovo,
            }
          : it
      )
    );
    setItemInspecao(null);
    log("ok", `Dados do arquivo "${itemInspecao.nome}" atualizados manualmente.`);
  };

  /* ------------------------------------------------------------------ */
  /*  Geração e Exportação das NDDs (.xlsx)                             */
  /* ------------------------------------------------------------------ */

  const templateBufferEfetivo = templateLote?.buffer ?? templateBufferApp;

  const prepararListaNdds = async (): Promise<ArquivoSalvar[]> => {
    const prontos = itens.filter((i) => i.dados && (i.status === "sucesso" || i.status === "aviso"));
    if (prontos.length === 0) {
      throw new Error("Nenhum item com extração concluída para gerar NDD.");
    }

    const arquivosProntos: ArquivoSalvar[] = [];

    for (let i = 0; i < prontos.length; i++) {
      const item = prontos[i];
      setProgressoExportacao({
        atual: i + 1,
        total: prontos.length,
        msg: `Preenchendo planilha (${i + 1}/${prontos.length}): ${item.nome}`,
      });

      // Aplica a regra de Data do RFI:
      const dataRfiFinal =
        modoRfi === "global"
          ? (dataRfiGlobal.trim() || item.dados!.data_rfi || "")
          : (item.dataRfiIndividual || item.dados!.data_rfi || "");

      const dadosParaGerar: DadosPPI = {
        ...item.dados!,
        data_rfi: dataRfiFinal,
      };

      const res = await gerarNddPreenchido(dadosParaGerar, cfg, templateBufferEfetivo, log);
      arquivosProntos.push({
        nome: res.nomeArquivo,
        blob: res.blob,
      });
    }

    return arquivosProntos;
  };

  const aoGerarNddsEmPasta = async () => {
    const prontos = itens.filter((i) => i.dados && (i.status === "sucesso" || i.status === "aviso"));
    if (prontos.length === 0) {
      log("warn", "Nenhum arquivo processado com sucesso para gerar NDDs.");
      return;
    }

    try {
      setExportando(true);
      setSucessoExportacao(null);

      let dirHandle = await pastaPadrao.obterHandleComPermissao();
      if (!dirHandle) {
        log("info", "Abrindo seletor para escolha da pasta padrão de destino das NDDs…");
        const definiu = await pastaPadrao.definirPasta();
        if (!definiu) return;
        dirHandle = await pastaPadrao.obterHandleComPermissao();
      }

      if (!dirHandle) return;

      const arquivos = await prepararListaNdds();

      setProgressoExportacao({ atual: 0, total: arquivos.length, msg: "Criando subpastas e gravando planilhas na pasta selecionada…" });

      await salvarArquivosEmPasta(dirHandle, arquivos, (atual, total, nome) => {
        setProgressoExportacao({
          atual,
          total,
          msg: `Gravando [${atual}/${total}]: ${nome}`,
        });
      });

      const nomeDestino = pastaPadrao.nome || dirHandle.name;
      setSucessoExportacao({ total: arquivos.length, pasta: nomeDestino });
      log("ok", `Sucesso! ${arquivos.length} planilha(s) NDD gravada(s) em subpastas organizadas dentro de "${nomeDestino}".`);
    } catch (e: any) {
      if (e?.name !== "AbortError") {
        const isNotFound = e?.name === "NotFoundError" || /not found/i.test(e?.message || "");
        if (isNotFound) {
          log("error", "A pasta configurada não foi encontrada no disco (pode ter sido renomeada, removida ou desvinculada). Redefina a pasta padrão de destino.");
          await pastaPadrao.removerPasta();
        } else {
          log("error", `Erro ao salvar NDDs na pasta: ${e?.message ?? e}`);
        }
      }
    } finally {
      setExportando(false);
      setProgressoExportacao(null);
    }
  };

  const aoBaixarZip = async () => {
    const prontos = itens.filter((i) => i.dados && (i.status === "sucesso" || i.status === "aviso"));
    if (prontos.length === 0) {
      log("warn", "Nenhum arquivo processado com sucesso para gerar ZIP.");
      return;
    }

    try {
      setExportando(true);
      setSucessoExportacao(null);

      const arquivos = await prepararListaNdds();

      setProgressoExportacao({ atual: arquivos.length, total: arquivos.length, msg: "Compactando arquivos em formato .ZIP…" });

      const zipBlob = await gerarPacoteZip(arquivos);
      const dataHoje = new Date().toISOString().slice(0, 10);
      const nomeZip = `[NDDs]_Lote_${tipoProjeto.toUpperCase()}_${dataHoje}.zip`;

      baixarBlob(zipBlob, nomeZip);
      setSucessoExportacao({ total: arquivos.length });
      log("ok", `Pacote compactado "${nomeZip}" gerado e baixado com ${arquivos.length} planilhas.`);
    } catch (e: any) {
      log("error", `Erro ao gerar ZIP das NDDs: ${e?.message ?? e}`);
    } finally {
      setExportando(false);
      setProgressoExportacao(null);
    }
  };

  return (
    <div className="mx-auto flex max-w-[1840px] w-full flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8 xl:px-10">
      {/* ------------------------------------------------------------------ */}
      {/*  Topo: Título, Modo de Projeto e Controles Globais                 */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="font-display text-2xl font-bold tracking-tight text-mist-100 sm:text-3xl">
              Lançamento em <span className="text-amber-500">Massa</span>
            </h2>
            <span
              className={`rounded-full border px-2.5 py-0.5 font-mono text-[11px] font-semibold uppercase tracking-wider ${
                tipoProjeto === "collo"
                  ? "border-cyan-500/40 bg-cyan-500/10 text-cyan-300"
                  : "border-amber-500/40 bg-amber-500/10 text-amber-400"
              }`}
            >
              Modo {tipoProjeto.toUpperCase()}
            </span>
          </div>
          <p className="mt-1 font-mono text-xs text-mist-400">
            Varredura de pasta com PPIs, extração sequencial na cota gratuita (~12-15 RPM) e geração massiva de NDDs (.xlsx)
          </p>
        </div>

        {/* Status da Cota Gratuita */}
        <div className="flex items-center gap-3 rounded-md border border-ink-600 bg-ink-850 px-3.5 py-2 font-mono text-xs">
          <div className="h-2 w-2 rounded-full bg-ok-400 pulse-dot" />
          <div className="flex flex-col">
            <span className="text-[10px] uppercase text-mist-500">Cadência de Cota Gratuita</span>
            <span className="font-semibold text-mist-200">
              1 req a cada {(INTERVALO_RATE_LIMIT_MS / 1000).toFixed(1)}s (~13 RPM seguro)
            </span>
          </div>
        </div>
      </div>

      {/* Banner de Espera se 429 for atingido */}
      {espera429 !== null && (
        <div className="fade-in flex items-center justify-between gap-4 rounded-md border border-warn-500/50 bg-warn-500/15 p-4 text-warn-300">
          <div className="flex items-center gap-3">
            <Clock size={20} className="animate-spin text-warn-400" />
            <div>
              <p className="font-display text-sm font-semibold">Cota temporariamente excedida pelo Google (HTTP 429)</p>
              <p className="font-mono text-xs text-warn-400/90">
                Pausa de segurança ativa para respeitar a cota gratuita. Retomando automaticamente em{" "}
                <span className="font-bold text-warn-200">{espera429} segundos</span>…
              </p>
            </div>
          </div>
          <button
            onClick={cancelarExecucao}
            className="rounded border border-warn-500/40 bg-warn-500/20 px-3 py-1.5 font-display text-xs font-semibold hover:bg-warn-500/30"
          >
            Interromper
          </button>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/*  Painéis de Configuração do Lote: Pastas, RFI e Template           */}
      {/* ------------------------------------------------------------------ */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Painel 1: Seleção de Pasta de PPIs */}
        <div className="tick-panel rounded-md p-4">
          <div className="mb-3 flex items-center justify-between">
            <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-amber-500">
              01 · Pasta de Entrada (PPIs)
            </span>
            <span className="font-mono text-[10px] text-mist-500">{itens.length} arquivo(s)</span>
          </div>

          <div className="flex flex-col gap-3">
            <button
              onClick={aoSelecionarPastaNativa}
              disabled={lendoPasta || executando}
              className="flex w-full items-center justify-center gap-2 rounded border border-amber-500/60 bg-amber-500/15 px-4 py-3 font-display text-xs font-bold uppercase tracking-wider text-amber-300 transition-all hover:bg-amber-500/25 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {lendoPasta ? <Loader2 size={16} className="animate-spin" /> : <FolderOpen size={16} />}
              {lendoPasta ? "Varrendo Pasta…" : "Selecionar Pasta de PPIs"}
            </button>

            {/* Fallback para navegadores sem File System Access API */}
            {!suportaDirectoryPicker() && (
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={executando}
                className="flex w-full items-center justify-center gap-1.5 rounded border border-ink-500 bg-ink-800 px-3 py-2 font-display text-xs font-semibold text-mist-300 hover:border-cyan-400 hover:text-cyan-300"
              >
                <Upload size={14} /> Selecionar Pasta via Upload
              </button>
            )}
            <input
              ref={fileInputRef}
              type="file"
              // @ts-ignore
              webkitdirectory=""
              directory=""
              multiple
              className="hidden"
              onChange={aoSelecionarPastaFallback}
            />

            <div className="flex items-center justify-between pt-1">
              <label className="flex cursor-pointer items-center gap-2 font-mono text-xs text-mist-400 hover:text-mist-200">
                <input
                  type="checkbox"
                  checked={recursivo}
                  onChange={(e) => setRecursivo(e.target.checked)}
                  disabled={executando}
                  className="rounded border-ink-500 bg-ink-800 text-amber-500 focus:ring-0"
                />
                Incluir subpastas (recursivo)
              </label>

              {itens.length > 0 && !executando && (
                <button
                  onClick={limparLote}
                  className="inline-flex items-center gap-1 font-mono text-[11px] text-err-400 hover:text-err-300 hover:underline"
                >
                  <Trash2 size={12} /> Limpar
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Painel 2: Configuração da Data do RFI */}
        <div className="tick-panel rounded-md p-4">
          <div className="mb-3 flex items-center justify-between">
            <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-cyan-400">
              02 · Data do RFI (Célula D7)
            </span>
            <span className="font-mono text-[10px] text-mist-500">
              {modoRfi === "global" ? "Mesma data" : "Individual"}
            </span>
          </div>

          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-2 rounded border border-ink-600 bg-ink-950 p-1">
              <button
                type="button"
                onClick={() => setModoRfi("global")}
                className={`rounded px-2.5 py-1.5 font-display text-xs font-semibold transition-all ${
                  modoRfi === "global"
                    ? "bg-cyan-500 text-ink-950 shadow"
                    : "text-mist-400 hover:text-mist-200"
                }`}
              >
                Mesma para todos
              </button>
              <button
                type="button"
                onClick={() => setModoRfi("individual")}
                className={`rounded px-2.5 py-1.5 font-display text-xs font-semibold transition-all ${
                  modoRfi === "individual"
                    ? "bg-cyan-500 text-ink-950 shadow"
                    : "text-mist-400 hover:text-mist-200"
                }`}
              >
                Data individual
              </button>
            </div>

            {modoRfi === "global" ? (
              <div>
                <label className="mb-1 block font-mono text-[10px] uppercase tracking-wider text-mist-400">
                  Data RFI Global (aplica em todas as NDDs)
                </label>
                <input
                  type="text"
                  value={dataRfiGlobal}
                  onChange={(e) => setDataRfiGlobal(e.target.value)}
                  placeholder="Ex: 15/10/2026 (ou deixe vazio p/ manter da IA)"
                  className="field-input font-mono text-xs"
                />
              </div>
            ) : (
              <p className="rounded border border-ink-600 bg-ink-900/60 p-2.5 font-mono text-[11px] leading-relaxed text-mist-400">
                A data de cada PPI será preenchida automaticamente com o que o Gemini extrair do documento, podendo ser editada na tabela abaixo.
              </p>
            )}
          </div>
        </div>

        {/* Painel 3: Template & Regras de Preenchimento */}
        <div className="tick-panel rounded-md p-4">
          <div className="mb-3 flex items-center justify-between">
            <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-mist-300">
              03 · Template Excel (.xlsx)
            </span>
            <span className="font-mono text-[10px] text-mist-500">
              {templateLote ? "Customizado" : "Padrão"}
            </span>
          </div>

          <div className="flex flex-col gap-2">
            {!templateLote ? (
              <div className="flex items-center justify-between rounded border border-ink-600 bg-ink-950/70 p-2.5">
                <div className="min-w-0">
                  <p className="truncate font-mono text-xs font-semibold text-mist-200">
                    NDD-{tipoProjeto}.xlsx (Padrão)
                  </p>
                  <p className="font-mono text-[10px] text-mist-500">
                    Template oficial para projetos {tipoProjeto.toUpperCase()}
                  </p>
                </div>
                <button
                  onClick={() => templateInputRef.current?.click()}
                  disabled={executando}
                  className="rounded border border-ink-500 px-2.5 py-1 font-display text-[11px] text-mist-300 hover:border-cyan-400 hover:text-cyan-300"
                >
                  Alterar
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-between rounded border border-ok-500/40 bg-ok-500/10 p-2.5">
                <div className="min-w-0">
                  <p className="truncate font-mono text-xs font-semibold text-ok-300" title={templateLote.nome}>
                    {templateLote.nome}
                  </p>
                  <p className="font-mono text-[10px] text-ok-400/80">
                    {formatarBytes(templateLote.tamanho)} · customizado
                  </p>
                </div>
                <button
                  onClick={removerTemplateLote}
                  disabled={executando}
                  className="rounded border border-err-500/40 p-1 text-err-400 hover:bg-err-500/20"
                  title="Remover template customizado"
                >
                  <X size={14} />
                </button>
              </div>
            )}
            <input
              ref={templateInputRef}
              type="file"
              accept=".xlsx"
              className="hidden"
              onChange={aoCarregarTemplateLote}
            />
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/*  Cards de Métricas e Controles da Fila                             */}
      {/* ------------------------------------------------------------------ */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <div className="tick-panel flex flex-col justify-between rounded-md p-3.5">
          <span className="font-mono text-[10px] uppercase tracking-wider text-mist-500">Total Encontrados</span>
          <span className="font-display text-2xl font-bold text-mist-100">{metricas.total}</span>
        </div>
        <div className="tick-panel flex flex-col justify-between rounded-md p-3.5">
          <span className="font-mono text-[10px] uppercase tracking-wider text-ok-400">Processados com Sucesso</span>
          <span className="font-display text-2xl font-bold text-ok-400">{metricas.sucesso}</span>
        </div>
        <div className="tick-panel flex flex-col justify-between rounded-md p-3.5">
          <span className="font-mono text-[10px] uppercase tracking-wider text-warn-400">Com Avisos de Validação</span>
          <span className="font-display text-2xl font-bold text-warn-400">{metricas.aviso}</span>
        </div>
        <div className="tick-panel flex flex-col justify-between rounded-md p-3.5">
          <span className="font-mono text-[10px] uppercase tracking-wider text-err-400">Falhas / Erros</span>
          <span className="font-display text-2xl font-bold text-err-400">{metricas.erro}</span>
        </div>
        <div className="tick-panel flex flex-col justify-between rounded-md p-3.5">
          <span className="font-mono text-[10px] uppercase tracking-wider text-mist-400">Pendentes na Fila</span>
          <span className="font-display text-2xl font-bold text-mist-400">{metricas.pendentes}</span>
        </div>
      </div>

      {/* Barra de Progresso e Ações da Fila */}
      <div className="tick-panel flex flex-col gap-4 rounded-md p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex-1">
          <div className="mb-2 flex items-center justify-between font-mono text-xs">
            <span className="text-mist-300">
              Progresso do Lote:{" "}
              <strong className="text-mist-100">{metricas.concluidos}</strong> de{" "}
              <strong className="text-mist-100">{metricas.total}</strong> ({metricas.percentual}%)
            </span>
            {itemAtualId && (
              <span className="flex items-center gap-1.5 font-semibold text-amber-400">
                <Loader2 size={13} className="animate-spin" />
                Processando: {itens.find((i) => i.id === itemAtualId)?.nome}
              </span>
            )}
          </div>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-ink-800">
            <div
              className="h-full bg-gradient-to-r from-amber-500 to-cyan-400 transition-all duration-300"
              style={{ width: `${metricas.percentual}%` }}
            />
          </div>
        </div>

        {/* Botões de Ação da Fila */}
        <div className="flex flex-wrap items-center gap-2">
          {!executando ? (
            <>
              <button
                onClick={() => iniciarProcessamentoLote(false)}
                disabled={itens.length === 0 || metricas.pendentes === 0}
                className="flex items-center gap-2 rounded bg-amber-500 px-4 py-2 font-display text-xs font-bold uppercase tracking-wider text-ink-950 shadow-[0_2px_12px_-2px_rgba(255,178,36,0.5)] transition-all hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Play size={14} fill="currentColor" />
                {metricas.concluidos > 0 ? "Continuar Fila" : "Iniciar Extração em Massa"}
              </button>
              {metricas.erro > 0 && (
                <button
                  onClick={() => iniciarProcessamentoLote(true)}
                  className="flex items-center gap-1.5 rounded border border-err-500/50 bg-err-500/15 px-3 py-2 font-display text-xs font-semibold text-err-300 hover:bg-err-500/25"
                >
                  <RefreshCw size={13} />
                  Re-tentar Falhas ({metricas.erro})
                </button>
              )}
            </>
          ) : (
            <>
              <button
                onClick={alternarPausa}
                className="flex items-center gap-1.5 rounded border border-amber-500 bg-amber-500/20 px-3.5 py-2 font-display text-xs font-semibold text-amber-300 hover:bg-amber-500/30"
              >
                {pausado ? <Play size={14} /> : <Pause size={14} />}
                {pausado ? "Retomar Fila" : "Pausar Fila"}
              </button>
              <button
                onClick={cancelarExecucao}
                className="flex items-center gap-1.5 rounded border border-err-500/60 bg-err-500/20 px-3.5 py-2 font-display text-xs font-semibold text-err-300 hover:bg-err-500/30"
              >
                <XCircle size={14} />
                Parar
              </button>
            </>
          )}
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/*  Tabela Interativa de Itens do Lote                                */}
      {/* ------------------------------------------------------------------ */}
      <div className="tick-panel overflow-hidden rounded-md">
        {/* Barra de Filtros */}
        <div className="flex flex-wrap items-center justify-between border-b border-ink-600/70 bg-ink-850 px-4 py-2.5">
          <div className="flex items-center gap-1">
            <span className="mr-2 font-mono text-[10px] uppercase text-mist-500">Filtrar:</span>
            {(
              [
                { id: "todos", label: "Todos", count: metricas.total },
                { id: "pendente", label: "Pendentes", count: metricas.pendentes },
                { id: "sucesso", label: "Sucesso", count: metricas.sucesso },
                { id: "aviso", label: "Com Avisos", count: metricas.aviso },
                { id: "erro", label: "Falhas", count: metricas.erro },
              ] as const
            ).map((f) => (
              <button
                key={f.id}
                onClick={() => setFiltro(f.id)}
                className={`rounded px-2.5 py-1 font-mono text-xs transition-colors ${
                  filtro === f.id
                    ? "bg-ink-700 font-semibold text-amber-400 shadow-sm"
                    : "text-mist-400 hover:text-mist-200"
                }`}
              >
                {f.label} ({f.count})
              </button>
            ))}
          </div>

          <span className="font-mono text-[11px] text-mist-500">
            Mostrando {itensFiltrados.length} de {itens.length} itens
          </span>
        </div>

        {/* Tabela */}
        <div className="max-h-[520px] overflow-auto">
          {itens.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 text-center">
              <FolderPlus size={36} className="text-mist-600" />
              <p className="mt-3 font-display text-sm font-semibold text-mist-300">
                Nenhum arquivo carregado no lote
              </p>
              <p className="mt-1 font-mono text-xs text-mist-500">
                Clique no botão "Selecionar Pasta de PPIs" no passo 01 para carregar os PDFs.
              </p>
            </div>
          ) : (
            <table className="w-full border-collapse text-left font-mono text-xs">
              <thead className="sticky top-0 z-10 border-b border-ink-600 bg-ink-900 text-[10px] uppercase tracking-wider text-mist-500">
                <tr>
                  <th className="py-2.5 pl-4 pr-2 w-12 text-center">#</th>
                  <th className="py-2.5 px-3 w-28">Status</th>
                  <th className="py-2.5 px-3">Arquivo / Caminho</th>
                  <th className="py-2.5 px-3 w-32">Site ID Cliente</th>
                  <th className="py-2.5 px-3 w-32">Site ID Detentor</th>
                  <th className="py-2.5 px-3 w-36">Cidade / UF</th>
                  <th className="py-2.5 px-3 w-24 text-center">Equip.</th>
                  <th className="py-2.5 px-3 w-36">Data RFI (D7)</th>
                  <th className="py-2.5 pl-2 pr-4 w-28 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-700/60 bg-ink-950/40">
                {itensFiltrados.map((item, index) => {
                  const num = index + 1;
                  const dados = item.dados;
                  const valorRfiExibido =
                    modoRfi === "global"
                      ? (dataRfiGlobal || dados?.data_rfi || "-")
                      : (item.dataRfiIndividual ?? dados?.data_rfi ?? "");

                  return (
                    <tr
                      key={item.id}
                      className={`transition-colors hover:bg-ink-850/60 ${
                        item.status === "processando" ? "bg-amber-500/5" : ""
                      }`}
                    >
                      <td className="py-2.5 pl-4 pr-2 text-center text-mist-500">{num}</td>
                      <td className="py-2.5 px-3">
                        {item.status === "pendente" && (
                          <span className="inline-flex items-center gap-1 rounded bg-ink-800 px-2 py-0.5 text-[10px] text-mist-400">
                            <Clock size={11} /> Pendente
                          </span>
                        )}
                        {item.status === "processando" && (
                          <span className="inline-flex items-center gap-1 rounded bg-amber-500/20 px-2 py-0.5 text-[10px] font-semibold text-amber-300">
                            <Loader2 size={11} className="animate-spin" /> Extraindo…
                          </span>
                        )}
                        {item.status === "sucesso" && (
                          <span className="inline-flex items-center gap-1 rounded bg-ok-500/20 px-2 py-0.5 text-[10px] font-semibold text-ok-400">
                            <CheckCircle2 size={11} /> OK
                          </span>
                        )}
                        {item.status === "aviso" && (
                          <span
                            className="inline-flex items-center gap-1 rounded bg-warn-500/20 px-2 py-0.5 text-[10px] font-semibold text-warn-400"
                            title={item.avisos?.join("\n")}
                          >
                            <AlertTriangle size={11} /> Avisos ({item.avisos?.length})
                          </span>
                        )}
                        {item.status === "erro" && (
                          <span
                            className="inline-flex items-center gap-1 rounded bg-err-500/20 px-2 py-0.5 text-[10px] font-semibold text-err-400"
                            title={item.erro}
                          >
                            <XCircle size={11} /> Erro
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 min-w-0">
                        <div className="truncate font-semibold text-mist-100" title={item.nome}>
                          {item.nome}
                        </div>
                        {item.caminhoRelativo !== item.nome && (
                          <div className="truncate text-[10px] text-mist-500" title={item.caminhoRelativo}>
                            {item.caminhoRelativo}
                          </div>
                        )}
                        {item.erro && (
                          <div className="truncate text-[10px] text-err-400" title={item.erro}>
                            {item.erro}
                          </div>
                        )}
                      </td>
                      <td className="py-2.5 px-3 truncate text-mist-200">
                        {dados?.site_id_cliente || "-"}
                      </td>
                      <td className="py-2.5 px-3 truncate text-mist-200">
                        {dados?.site_id_detentor || "-"}
                      </td>
                      <td className="py-2.5 px-3 truncate text-mist-300">
                        {dados?.cidade ? `${dados.cidade} / ${dados.uf || "-"}` : "-"}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        {dados?.equipamentos ? (
                          <span className="rounded bg-ink-800 px-1.5 py-0.5 text-[10px] font-semibold text-cyan-300">
                            {dados.equipamentos.length}
                          </span>
                        ) : (
                          "-"
                        )}
                      </td>
                      <td className="py-2.5 px-3">
                        {modoRfi === "individual" ? (
                          <input
                            type="text"
                            value={item.dataRfiIndividual ?? dados?.data_rfi ?? ""}
                            onChange={(e) => atualizarDataRfiIndividual(item.id, e.target.value)}
                            placeholder="DD/MM/AAAA"
                            className="w-full rounded border border-ink-600 bg-ink-900 px-2 py-1 font-mono text-[11px] text-mist-100 placeholder-mist-600 focus:border-cyan-400 focus:outline-none"
                          />
                        ) : (
                          <span className="text-mist-400">{valorRfiExibido}</span>
                        )}
                      </td>
                      <td className="py-2.5 pl-2 pr-4 text-right">
                        <div className="inline-flex items-center gap-1">
                          {dados && (
                            <button
                              onClick={() => setItemInspecao(item)}
                              className="rounded border border-ink-600 p-1 text-mist-400 transition-colors hover:border-cyan-400 hover:text-cyan-300"
                              title="Inspecionar / Editar dados extraídos"
                            >
                              <Edit3 size={13} />
                            </button>
                          )}
                          {item.status === "erro" && !executando && (
                            <button
                              onClick={() => reprocessarItem(item.id)}
                              className="rounded border border-err-500/50 p-1 text-err-400 transition-colors hover:bg-err-500/20"
                              title="Tentar novamente"
                            >
                              <RefreshCw size={13} />
                            </button>
                          )}
                          {!executando && (
                            <button
                              onClick={() => removerItem(item.id)}
                              className="rounded border border-ink-600 p-1 text-mist-500 transition-colors hover:border-err-500 hover:text-err-400"
                              title="Remover do lote"
                            >
                              <Trash2 size={13} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/*  Barra de Geração e Exportação Final das NDDs                      */}
      {/* ------------------------------------------------------------------ */}
      <div className="tick-panel rounded-md p-5 border-t-2 border-t-amber-500 bg-gradient-to-b from-ink-850 to-ink-900">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h3 className="font-display text-base font-bold text-mist-100 flex items-center gap-2">
              <FileSpreadsheet className="text-amber-500" size={18} />
              Geração das Planilhas NDD (.xlsx)
            </h3>
            <p className="mt-0.5 font-mono text-xs text-mist-400">
              {metricas.concluidos > 0
                ? `${metricas.concluidos} NDD(s) pronta(s) para gravação com o padrão [NDD] WINITY_{ID_OPERADORA}_{ID_WINITY}_{CIDADE}_{ID_OPERADORA}.xlsx`
                : "Processe os PPIs acima para liberar a geração em massa das planilhas."}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Widget Pasta Padrão (Marcado de azul na Imagem 2) */}
            {pastaPadrao.nome ? (
              <div className="flex items-center gap-2.5 rounded border border-cyan-500/40 bg-ink-850 px-3.5 py-2 text-xs shadow-sm">
                <FolderCheck size={16} className="text-cyan-400 shrink-0" />
                <div className="min-w-0">
                  <div className="font-mono text-[9px] uppercase tracking-wider text-mist-400">Pasta padrão:</div>
                  <div className="truncate font-mono text-xs font-semibold text-cyan-300 max-w-[140px] sm:max-w-[180px]" title={pastaPadrao.nome}>
                    {pastaPadrao.nome}
                  </div>
                </div>
                <button
                  onClick={() => pastaPadrao.definirPasta()}
                  className="ml-1 text-[11px] font-semibold text-mist-400 hover:text-cyan-300 underline"
                  title="Alterar pasta padrão de saída"
                >
                  Alterar
                </button>
              </div>
            ) : (
              <button
                onClick={() => pastaPadrao.definirPasta()}
                className="flex items-center gap-2 rounded border border-cyan-500/50 bg-cyan-500/10 px-3.5 py-2.5 font-display text-xs font-semibold text-cyan-300 transition-all hover:bg-cyan-500/20 hover:border-cyan-400"
                title="Defina uma pasta padrão fixa para salvar as NDDs sem perguntar toda vez"
              >
                <FolderCog size={15} />
                Definir Pasta Padrão
              </button>
            )}

            {/* Botão Secundário: ZIP */}
            <button
              onClick={aoBaixarZip}
              disabled={metricas.concluidos === 0 || exportando || executando}
              className="flex items-center gap-2 rounded border border-ink-500 bg-ink-800 px-4 py-2.5 font-display text-xs font-semibold text-mist-200 transition-all hover:border-cyan-400 hover:text-cyan-300 disabled:cursor-not-allowed disabled:opacity-40"
              title="Compactar todas as NDDs em um único arquivo .zip (organizadas em subpastas)"
            >
              <FolderArchive size={15} />
              Baixar tudo em .ZIP
            </button>

            {/* Botão Principal: Salvar direto em Pasta */}
            <button
              onClick={aoGerarNddsEmPasta}
              disabled={metricas.concluidos === 0 || exportando || executando}
              className="flex items-center gap-2 rounded bg-amber-500 px-5 py-2.5 font-display text-xs font-bold uppercase tracking-wider text-ink-950 shadow-[0_2px_14px_-2px_rgba(255,178,36,0.6)] transition-all hover:bg-amber-400 hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {exportando ? <Loader2 size={16} className="animate-spin" /> : <FolderCheck size={16} />}
              {exportando
                ? "Gravando Planilhas…"
                : pastaPadrao.nome
                ? `Gerar NDDs em Pasta (${pastaPadrao.nome})`
                : "Gerar NDDs em Pasta"}
            </button>
          </div>
        </div>

        {/* Modal / Alerta de Progresso da Exportação */}
        {progressoExportacao && (
          <div className="fade-in mt-4 rounded border border-cyan-500/40 bg-cyan-500/10 p-3 text-cyan-300">
            <div className="flex items-center justify-between font-mono text-xs">
              <span className="flex items-center gap-2">
                <Loader2 size={14} className="animate-spin" />
                {progressoExportacao.msg}
              </span>
              <span>
                {progressoExportacao.atual} / {progressoExportacao.total}
              </span>
            </div>
          </div>
        )}

        {/* Notificação de Sucesso */}
        {sucessoExportacao && (
          <div className="fade-in mt-4 flex items-center justify-between rounded border border-ok-500/50 bg-ok-500/15 p-3.5 text-ok-300">
            <div className="flex items-center gap-3">
              <CheckCircle2 size={18} className="text-ok-400" />
              <span className="font-mono text-xs">
                <strong>{sucessoExportacao.total} planilhas NDD geradas com sucesso!</strong>
                {sucessoExportacao.pasta && ` Salvas na pasta "${sucessoExportacao.pasta}".`}
              </span>
            </div>
            <button
              onClick={() => setSucessoExportacao(null)}
              className="text-ok-400 hover:text-ok-200"
            >
              <X size={14} />
            </button>
          </div>
        )}
      </div>

      {/* ------------------------------------------------------------------ */}
      {/*  Modal de Inspeção e Edição Detalhada de um Item                   */}
      {/* ------------------------------------------------------------------ */}
      {itemInspecao && itemInspecao.dados && (
        <ModalInspecaoItem
          item={itemInspecao}
          onSalvar={salvarEdicaoInspecao}
          onFechar={() => setItemInspecao(null)}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Subcomponente: Modal de Inspeção e Edição dos Dados Extraídos     */
/* ------------------------------------------------------------------ */

interface ModalProps {
  item: ItemLote;
  onSalvar: (dados: DadosPPI, dataRfi: string) => void;
  onFechar: () => void;
}

function ModalInspecaoItem({ item, onSalvar, onFechar }: ModalProps) {
  const [dadosLocais, setDadosLocais] = useState<DadosPPI>(() => JSON.parse(JSON.stringify(item.dados!)));
  const [dataRfiLocal, setDataRfiLocal] = useState(
    item.dataRfiIndividual ?? item.dados?.data_rfi ?? ""
  );

  const aoMudarCampo = (campo: keyof DadosPPI, valor: any) => {
    setDadosLocais((prev) => ({ ...prev, [campo]: valor }));
  };

  const aoMudarEquipamento = (index: number, campo: keyof Equipamento, valor: any) => {
    setDadosLocais((prev) => {
      const novos = [...prev.equipamentos];
      novos[index] = { ...novos[index], [campo]: valor };
      return { ...prev, equipamentos: novos };
    });
  };

  const aoAdicionarEquipamento = () => {
    setDadosLocais((prev) => ({
      ...prev,
      equipamentos: [
        ...prev.equipamentos,
        {
          tipo_equipamento: "ANTENA",
          modelo: "",
          qtde: 1,
          azimute: "-",
          comprimento: "-",
          largura: "-",
          profundidade: "-",
          rad_center: "",
          aev_sem_ca: "",
          ca: "1,2",
          aev_com_ca: "",
        },
      ],
    }));
  };

  const aoRemoverEquipamento = (index: number) => {
    setDadosLocais((prev) => ({
      ...prev,
      equipamentos: prev.equipamentos.filter((_, i) => i !== index),
    }));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
      <div className="flex max-h-[90vh] w-full max-w-5xl flex-col rounded-lg border border-ink-600 bg-ink-900 shadow-2xl">
        {/* Cabeçalho do Modal */}
        <div className="flex items-center justify-between border-b border-ink-600/80 px-6 py-4">
          <div className="min-w-0">
            <h3 className="font-display text-lg font-bold text-mist-100 flex items-center gap-2">
              <Edit3 size={18} className="text-amber-500" />
              Inspecionar e Ajustar: <span className="text-mist-200 truncate">{item.nome}</span>
            </h3>
            <p className="font-mono text-xs text-mist-500">
              Revise os campos e a tabela de equipamentos antes da geração da NDD
            </p>
          </div>
          <button
            onClick={onFechar}
            className="rounded p-1 text-mist-400 hover:bg-ink-800 hover:text-mist-100"
          >
            <X size={18} />
          </button>
        </div>

        {/* Corpo do Modal com Scroll */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Avisos se houver */}
          {item.avisos && item.avisos.length > 0 && (
            <div className="rounded border border-warn-500/40 bg-warn-500/10 p-3 text-warn-300">
              <p className="font-mono text-xs font-semibold mb-1 flex items-center gap-1.5">
                <AlertTriangle size={14} /> Avisos de validação identificados:
              </p>
              <ul className="list-disc pl-5 font-mono text-[11px] space-y-0.5 text-warn-400">
                {item.avisos.map((aviso, idx) => (
                  <li key={idx}>{aviso}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Grid de Identificação do Site */}
          <div>
            <h4 className="font-mono text-xs font-bold uppercase tracking-wider text-amber-500 mb-3">
              Identificação do Site & Localização
            </h4>
            <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4">
              <div>
                <label className="mb-1 block font-mono text-[10px] uppercase text-mist-500">
                  Site ID Cliente
                </label>
                <input
                  type="text"
                  value={dadosLocais.site_id_cliente}
                  onChange={(e) => aoMudarCampo("site_id_cliente", e.target.value)}
                  className="field-input font-mono text-xs"
                />
              </div>
              <div>
                <label className="mb-1 block font-mono text-[10px] uppercase text-mist-500">
                  Site ID Detentor
                </label>
                <input
                  type="text"
                  value={dadosLocais.site_id_detentor}
                  onChange={(e) => aoMudarCampo("site_id_detentor", e.target.value)}
                  className="field-input font-mono text-xs"
                />
              </div>
              <div>
                <label className="mb-1 block font-mono text-[10px] uppercase text-mist-500">
                  Data RFI (D7)
                </label>
                <input
                  type="text"
                  value={dataRfiLocal}
                  onChange={(e) => setDataRfiLocal(e.target.value)}
                  placeholder="DD/MM/AAAA"
                  className="field-input font-mono text-xs"
                />
              </div>
              <div>
                <label className="mb-1 block font-mono text-[10px] uppercase text-mist-500">
                  Altura EV (m)
                </label>
                <input
                  type="text"
                  value={dadosLocais.altura_ev}
                  onChange={(e) => aoMudarCampo("altura_ev", e.target.value)}
                  className="field-input font-mono text-xs"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="mb-1 block font-mono text-[10px] uppercase text-mist-500">
                  Endereço
                </label>
                <input
                  type="text"
                  value={dadosLocais.endereco}
                  onChange={(e) => aoMudarCampo("endereco", e.target.value)}
                  className="field-input font-mono text-xs"
                />
              </div>
              <div>
                <label className="mb-1 block font-mono text-[10px] uppercase text-mist-500">
                  Bairro
                </label>
                <input
                  type="text"
                  value={dadosLocais.bairro}
                  onChange={(e) => aoMudarCampo("bairro", e.target.value)}
                  className="field-input font-mono text-xs"
                />
              </div>
              <div>
                <label className="mb-1 block font-mono text-[10px] uppercase text-mist-500">
                  Cidade
                </label>
                <input
                  type="text"
                  value={dadosLocais.cidade}
                  onChange={(e) => aoMudarCampo("cidade", e.target.value)}
                  className="field-input font-mono text-xs"
                />
              </div>

              <div>
                <label className="mb-1 block font-mono text-[10px] uppercase text-mist-500">
                  UF
                </label>
                <input
                  type="text"
                  value={dadosLocais.uf}
                  onChange={(e) => aoMudarCampo("uf", e.target.value.toUpperCase())}
                  maxLength={2}
                  className="field-input font-mono text-xs"
                />
              </div>
              <div>
                <label className="mb-1 block font-mono text-[10px] uppercase text-mist-500">
                  CEP
                </label>
                <input
                  type="text"
                  value={dadosLocais.cep}
                  onChange={(e) => aoMudarCampo("cep", e.target.value)}
                  className="field-input font-mono text-xs"
                />
              </div>
              <div>
                <label className="mb-1 block font-mono text-[10px] uppercase text-mist-500">
                  Latitude
                </label>
                <input
                  type="text"
                  value={dadosLocais.latitude}
                  onChange={(e) => aoMudarCampo("latitude", e.target.value)}
                  className="field-input font-mono text-xs"
                />
              </div>
              <div>
                <label className="mb-1 block font-mono text-[10px] uppercase text-mist-500">
                  Longitude
                </label>
                <input
                  type="text"
                  value={dadosLocais.longitude}
                  onChange={(e) => aoMudarCampo("longitude", e.target.value)}
                  className="field-input font-mono text-xs"
                />
              </div>
            </div>
          </div>

          {/* Tabela de Equipamentos */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-mono text-xs font-bold uppercase tracking-wider text-cyan-400">
                Tabela de Equipamentos ({dadosLocais.equipamentos.length})
              </h4>
              <button
                type="button"
                onClick={aoAdicionarEquipamento}
                className="flex items-center gap-1 rounded border border-ink-600 px-2 py-1 font-mono text-[11px] text-mist-300 hover:border-cyan-400 hover:text-cyan-300"
              >
                <Plus size={12} /> Adicionar Linha
              </button>
            </div>

            <div className="overflow-x-auto rounded border border-ink-700 bg-ink-950">
              <table className="w-full border-collapse text-left font-mono text-[11px]">
                <thead className="border-b border-ink-700 bg-ink-900 text-mist-500 uppercase text-[9px]">
                  <tr>
                    <th className="p-2 w-24">Tipo</th>
                    <th className="p-2 min-w-[140px]">Modelo</th>
                    <th className="p-2 w-14">Qtd</th>
                    <th className="p-2 w-16">Azimute</th>
                    <th className="p-2 w-16">Comp (m)</th>
                    <th className="p-2 w-16">Larg (m)</th>
                    <th className="p-2 w-16">Prof (m)</th>
                    <th className="p-2 w-16">Rad Ctr</th>
                    <th className="p-2 w-16">AEV s/CA</th>
                    <th className="p-2 w-14">CA</th>
                    <th className="p-2 w-16">AEV c/CA</th>
                    <th className="p-2 w-8"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-800">
                  {dadosLocais.equipamentos.map((eq, i) => (
                    <tr key={i} className="hover:bg-ink-900/40">
                      <td className="p-1.5">
                        <input
                          type="text"
                          value={eq.tipo_equipamento}
                          onChange={(e) => aoMudarEquipamento(i, "tipo_equipamento", e.target.value)}
                          className="w-full rounded bg-ink-900 px-1.5 py-1 text-mist-100 border border-ink-700"
                        />
                      </td>
                      <td className="p-1.5">
                        <input
                          type="text"
                          value={eq.modelo}
                          onChange={(e) => aoMudarEquipamento(i, "modelo", e.target.value)}
                          className="w-full rounded bg-ink-900 px-1.5 py-1 text-mist-100 border border-ink-700"
                        />
                      </td>
                      <td className="p-1.5">
                        <input
                          type="text"
                          value={eq.qtde}
                          onChange={(e) => aoMudarEquipamento(i, "qtde", e.target.value)}
                          className="w-full rounded bg-ink-900 px-1.5 py-1 text-mist-100 border border-ink-700 text-center"
                        />
                      </td>
                      <td className="p-1.5">
                        <input
                          type="text"
                          value={eq.azimute}
                          onChange={(e) => aoMudarEquipamento(i, "azimute", e.target.value)}
                          className="w-full rounded bg-ink-900 px-1.5 py-1 text-mist-100 border border-ink-700 text-center"
                        />
                      </td>
                      <td className="p-1.5">
                        <input
                          type="text"
                          value={eq.comprimento}
                          onChange={(e) => aoMudarEquipamento(i, "comprimento", e.target.value)}
                          className="w-full rounded bg-ink-900 px-1.5 py-1 text-mist-100 border border-ink-700 text-center"
                        />
                      </td>
                      <td className="p-1.5">
                        <input
                          type="text"
                          value={eq.largura}
                          onChange={(e) => aoMudarEquipamento(i, "largura", e.target.value)}
                          className="w-full rounded bg-ink-900 px-1.5 py-1 text-mist-100 border border-ink-700 text-center"
                        />
                      </td>
                      <td className="p-1.5">
                        <input
                          type="text"
                          value={eq.profundidade}
                          onChange={(e) => aoMudarEquipamento(i, "profundidade", e.target.value)}
                          className="w-full rounded bg-ink-900 px-1.5 py-1 text-mist-100 border border-ink-700 text-center"
                        />
                      </td>
                      <td className="p-1.5">
                        <input
                          type="text"
                          value={eq.rad_center}
                          onChange={(e) => aoMudarEquipamento(i, "rad_center", e.target.value)}
                          className="w-full rounded bg-ink-900 px-1.5 py-1 text-mist-100 border border-ink-700 text-center"
                        />
                      </td>
                      <td className="p-1.5">
                        <input
                          type="text"
                          value={eq.aev_sem_ca}
                          onChange={(e) => aoMudarEquipamento(i, "aev_sem_ca", e.target.value)}
                          className="w-full rounded bg-ink-900 px-1.5 py-1 text-mist-100 border border-ink-700 text-center"
                        />
                      </td>
                      <td className="p-1.5">
                        <input
                          type="text"
                          value={eq.ca}
                          onChange={(e) => aoMudarEquipamento(i, "ca", e.target.value)}
                          className="w-full rounded bg-ink-900 px-1.5 py-1 text-mist-100 border border-ink-700 text-center"
                        />
                      </td>
                      <td className="p-1.5">
                        <input
                          type="text"
                          value={eq.aev_com_ca}
                          onChange={(e) => aoMudarEquipamento(i, "aev_com_ca", e.target.value)}
                          className="w-full rounded bg-ink-900 px-1.5 py-1 text-mist-100 border border-ink-700 text-center"
                        />
                      </td>
                      <td className="p-1.5 text-center">
                        <button
                          type="button"
                          onClick={() => aoRemoverEquipamento(i)}
                          className="text-mist-500 hover:text-err-400 p-1"
                        >
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Rodapé do Modal com Ações */}
        <div className="flex items-center justify-end gap-3 border-t border-ink-600/80 px-6 py-4 bg-ink-850">
          <button
            type="button"
            onClick={onFechar}
            className="rounded border border-ink-500 px-4 py-2 font-display text-xs font-semibold text-mist-300 hover:bg-ink-800"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => onSalvar(dadosLocais, dataRfiLocal)}
            className="flex items-center gap-1.5 rounded bg-amber-500 px-4 py-2 font-display text-xs font-bold uppercase tracking-wider text-ink-950 hover:bg-amber-400 shadow"
          >
            <Save size={14} /> Salvar Alterações
          </button>
        </div>
      </div>
    </div>
  );
}
