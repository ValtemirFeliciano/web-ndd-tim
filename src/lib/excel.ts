// Interop reforçado: o bundle UMD do ExcelJS pode chegar como { default: ... }
// dependendo do bundler/ambiente — cobrimos os dois formatos.
import * as ExcelJSMod from "exceljs/dist/exceljs.min.js";
import type { Borders, Workbook } from "exceljs";
import type { ConfigAutomacao, DadosPPI, LogLevel } from "../types";
import { CELULA_RE } from "./mapping";
import { TRANSFORMACOES } from "./transformers";

const ExcelJS: any = (ExcelJSMod as any)?.default ?? (ExcelJSMod as any);

function garantirExcelJS() {
  if (!ExcelJS || typeof ExcelJS.Workbook !== "function") {
    throw new Error(
      "A biblioteca de Excel não carregou neste navegador. Atualize a página com Ctrl+F5 (limpeza de cache) e tente novamente."
    );
  }
}

export type Logger = (level: LogLevel, msg: string, detalhe?: string) => void;

const BORDA_FIN: Partial<Borders> = {
  top: { style: "thin", color: { argb: "FF9DB2C9" } },
  left: { style: "thin", color: { argb: "FF9DB2C9" } },
  bottom: { style: "thin", color: { argb: "FF9DB2C9" } },
  right: { style: "thin", color: { argb: "FF9DB2C9" } },
};

/** Converte decimal com ponto para vírgula (ex: 0.888 → 0,888), como no seu Apps Script. */
function brDecimal(v: string | number, padrao = ""): string {
  const s = String(v ?? "").trim();
  if (!s) return padrao;
  return s.replace(".", ",");
}

/* ------------------------------------------------------------------ */
/*  Template padrão embutido (réplica do layout NDD)                   */
/* ------------------------------------------------------------------ */

const LARGURAS: Record<string, number> = {
  A: 11, B: 11, C: 16, D: 15, E: 20, F: 9, G: 7, H: 10, I: 11, J: 11,
  K: 10, L: 11, M: 10, N: 10, O: 12, P: 7, Q: 12, R: 5, S: 6,
};

const HEADERS_EQ = [
  "OPERADORA", "SITUAÇÃO", "TIPO", "FABRICANTE", "MODELO", "BANDA", "QTDE",
  "AZIMUTE (°)", "ALTURA (m)", "LARGURA (m)", "PROF. (m)", "RAD CENTER",
  "TILT MEC.", "TILT ELET.", "AEV S/ CA (m²)", "CA", "AEV C/ CA (m²)",
];

function criarTemplatePadrao(): Workbook {
  const wb = new ExcelJS.Workbook();
  wb.creator = "NDD Forge";
  wb.created = new Date();
  const aba = wb.addWorksheet("NDD", { views: [{ showGridLines: false }] });

  Object.entries(LARGURAS).forEach(([col, w]) => {
    aba.getColumn(col).width = w;
  });

  const titulo = aba.getCell("A1");
  aba.mergeCells("A1:S1");
  titulo.value = "NDD — NOVA DEMANDA DE DISPONIBILIDADE";
  titulo.font = { name: "Calibri", size: 15, bold: true, color: { argb: "FFFFFFFF" } };
  titulo.fill = { type: "pattern", pattern: "solid", bgColor: { argb: "FF10233B" } };
  titulo.alignment = { horizontal: "left", vertical: "middle" };
  aba.getRow(1).height = 28;

  aba.mergeCells("A2:S2");
  const sub = aba.getCell("A2");
  sub.value = "Gerado automaticamente pelo NDD Forge a partir do Projeto Executivo (PPI)";
  sub.font = { size: 9, italic: true, color: { argb: "FF5F7896" } };

  const secao = (cel: string, texto: string) => {
    const c = aba.getCell(cel);
    c.value = texto;
    c.font = { size: 10, bold: true, color: { argb: "FFB45F06" } };
  };
  secao("B4", "1. IDENTIFICAÇÃO DO SITE");
  secao("B17", "2. EQUIPAMENTOS INSTALADOS NA EV");

  const rotulo = (cel: string, texto: string) => {
    const c = aba.getCell(cel);
    c.value = texto;
    c.font = { size: 9, bold: true, color: { argb: "FF44546A" } };
  };
  rotulo("B7", "DATA RFI:");
  rotulo("C8", "SITE ID CLIENTE");
  rotulo("P8", "SITE ID DETENTOR");
  rotulo("C10", "LATITUDE");
  rotulo("J10", "LONGITUDE");
  rotulo("B12", "ENDEREÇO:");
  rotulo("A13", "BAIRRO:");
  rotulo("H13", "CIDADE:");
  rotulo("N13", "CEP:");
  rotulo("R13", "UF:");
  rotulo("B14", "ALTURA EV (m):");
  rotulo("B15", "SOLICITAÇÃO:");
  aba.getCell("C15").value = "NOVA DISPONIBILIDADE";
  aba.getCell("C15").font = { size: 10, bold: true };

  // cabeçalho da tabela de equipamentos (linha 22)
  HEADERS_EQ.forEach((h, i) => {
    const c = aba.getCell(22, i + 1);
    c.value = h;
    c.font = { size: 9, bold: true, color: { argb: "FFFFFFFF" } };
    c.fill = { type: "pattern", pattern: "solid", bgColor: { argb: "FF2C4F7C" } };
    c.border = BORDA_FIN as Borders;
    c.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
  });
  aba.getRow(22).height = 26;

  // linhas em branco da tabela com bordas (23 a 32)
  for (let r = 23; r <= 32; r++) {
    for (let col = 1; col <= 17; col++) {
      const c = aba.getCell(r, col);
      c.border = BORDA_FIN as Borders;
      c.alignment = { horizontal: "center", vertical: "middle" };
      if (r % 2 === 0) c.fill = { type: "pattern", pattern: "solid", bgColor: { argb: "FFF3F7FB" } };
    }
  }

  aba.getCell("A34").value = "Resumo de Equipamentos na EV: mantido pelas fórmulas do template original.";
  aba.getCell("A34").font = { size: 9, italic: true, color: { argb: "FF808080" } };
  return wb;
}

/* ------------------------------------------------------------------ */
/*  Reparo de fórmulas compartilhadas (corrige o erro do ExcelJS:      */
/*  "Shared Formula master must exist above and or left of clone")     */
/* ------------------------------------------------------------------ */

// Constante REAL do ExcelJS: Enums.ValueType.Formula = 6.
// (BUG ANTERIOR: usava "2", que na verdade é ValueType.Number — por isso a
//  varredura não enxergava NENHUMA fórmula e o reparo passava em branco.)
// Pega o valor da própria biblioteca para nunca mais divergir; fallback 6.
const TIPO_FORMULA: number =
  ((ExcelJS as any).ValueType?.Formula as number | undefined) ?? 6;

/**
 * Detecção multi-caminho de célula de fórmula — nunca confia num sinal só:
 * confere o type (6), o formato do .value ({formula | sharedFormula}) e o
 * .model da célula. Imune a diferenças entre versões do ExcelJS.
 */
function ehFormula(c: any): boolean {
  if (!c) return false;
  if (c.type === TIPO_FORMULA) return true;
  const v = c.value;
  if (v && typeof v === "object") {
    if (typeof v.formula === "string" || typeof v.sharedFormula === "string") return true;
  }
  try {
    const m = c.model;
    if (m && (typeof m.formula === "string" || typeof m.sharedFormula === "string")) return true;
  } catch {
    /* getter do model pode falhar em células mescladas — ignora */
  }
  return false;
}

function numParaCol(n: number): string {
  let s = "";
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

function colParaNum(letters: string): number {
  let n = 0;
  for (const ch of letters.toUpperCase()) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n;
}

function colunaDe(address: string): string {
  return address.replace(/\d+$/, "");
}

/**
 * Desloca as referências relativas de uma fórmula (ex: ao converter o clone
 * M24 de "=M23*1,2" para "=M23+1 → deslocamento (1,0)" etc).
 * Respeita travamentos com $ ($A$1, A$1, $A1), intervalos (A1:B5),
 * referências com nome de aba ('Plan 1'!C3 ou Plan1!C3) e ignora strings
 * entre aspas, nomes de função (SOMA(, LOG10( ) e notação científica.
 */
function deslocarReferencias(formula: string, dRow: number, dCol: number): string {
  const strings: string[] = [];
  const mascarada = formula.replace(/"(?:[^"]|"")*"/g, (s) => {
    strings.push(s);
    return `\u0000${strings.length - 1}\u0000`;
  });
  const RE =
    /(?<![A-Za-z0-9_$.])('(?:[^']|'')*'!|[A-Za-z_][A-Za-z0-9_.]*!)?(\$?)([A-Za-z]{1,3})(\$?)(\d{1,7})(?!\()(:(\$?)([A-Za-z]{1,3})(\$?)(\d{1,7}))?/g;
  const deslocada = mascarada.replace(
    RE,
    (_m, sheet: string, $c1: string, c1: string, $r1: string, r1: string, range: string, $c2: string, c2: string, $r2: string, r2: string) => {
      const desloca = ($c: string, c: string, $r: string, r: string) => {
        const nc = $c ? c : numParaCol(Math.min(16384, Math.max(1, colParaNum(c) + dCol)));
        const nr = $r ? r : String(Math.min(1048576, Math.max(1, parseInt(r, 10) + dRow)));
        return $c + nc + $r + nr;
      };
      let out = (sheet ?? "") + desloca($c1, c1, $r1, r1);
      if (range) out += ":" + desloca($c2 ?? "", c2 ?? "", $r2 ?? "", r2 ?? "");
      return out;
    }
  );
  return deslocada.replace(/\u0000(\d+)\u0000/g, (_, i) => strings[parseInt(i, 10)]);
}

/**
 * NEUTRALIZA TODA fórmula compartilhada do template ANTES de gravar os dados:
 *
 *  - MESTRES (células com .formula): reescritas como fórmula 100% independente,
 *    removendo os marcadores shareType/ref do grupo compartilhado.
 *  - CLONES (células com .sharedFormula apontando o mestre): reconstruídos como
 *    fórmula própria deslocando as referências (exatamente o que o Excel faz ao
 *    arrastar), ou convertidos no último valor calculado quando o mestre já foi
 *    sobrescrito no template.
 *
 * Sem grupos compartilhados no modelo, a validação do ExcelJS que gerava
 * "Shared Formula master must exist above and or left of clone" fica
 * impossível de disparar. As fórmulas continuam ATIVAS no arquivo final
 * (o Excel recalcula ao abrir — fullCalcOnLoad).
 */
function repararFormulasCompartilhadas(wb: Workbook, log: Logger): void {
  let mestres = 0;
  let clones = 0;
  let viraramFormula = 0;
  let viraramValor = 0;
  let outrasTratadas = 0;

  wb.worksheets.forEach((aba) => {
    let total = 0;
    const celulasFormula: any[] = [];
    aba.eachRow({ includeEmpty: false }, (linha) => {
      linha.eachCell({ includeEmpty: false }, (cel) => {
        total++;
        if (ehFormula(cel)) celulasFormula.push(cel as any);
      });
    });

    if (celulasFormula.length === 0) {
      if (total > 0) log("info", `Varredura da aba "${aba.name}": ${total} célula(s), nenhuma fórmula encontrada.`);
      return;
    }

    const clonesDaAba = celulasFormula.filter((c) => {
      const v = c.value;
      return v && typeof v === "object" && typeof v.sharedFormula === "string";
    });
    const mestresDaAba = celulasFormula.filter((c) => {
      const v = c.value;
      return (
        v && typeof v === "object" && typeof v.formula === "string" && v.formula.length > 0 &&
        typeof v.sharedFormula !== "string"
      );
    });
    const outras = celulasFormula.length - clonesDaAba.length - mestresDaAba.length;

    // 1) CLONES primeiro (enquanto os mestres ainda têm o texto da fórmula)
    clonesDaAba.forEach((cel) => {
      const v = cel.value;
      // localiza a célula-mestre (resolvendo cadeias de sharedFormula)
      let mestre: any = null;
      let addr: string | undefined = v.sharedFormula;
      const vistos = new Set<string>();
      while (addr && !vistos.has(addr)) {
        vistos.add(addr);
        const c = aba.getCell(addr) as any;
        const cv = c?.value;
        if (
          cv && typeof cv === "object" && typeof cv.formula === "string" && cv.formula.length > 0 &&
          typeof cv.sharedFormula !== "string"
        ) {
          mestre = c;
          break;
        }
        addr = cv && typeof cv === "object" && typeof cv.sharedFormula === "string" ? cv.sharedFormula : undefined;
      }

      let nova: string | null = null;
      if (mestre) {
        const dRow = cel.row - mestre.row;
        const dCol = colParaNum(colunaDe(cel.address)) - colParaNum(colunaDe(mestre.address));
        try {
          nova = deslocarReferencias(String(mestre.value.formula), dRow, dCol);
        } catch {
          nova = null;
        }
      }

      if (nova !== null) {
        cel.value = { formula: nova, result: v.result };
        viraramFormula++;
      } else {
        // sem mestre (ex.: célula-mestre sobrescrita no template) → valor calculado
        cel.value = v.result !== undefined ? v.result : null;
        viraramValor++;
      }
      clones++;
    });

    // 2) MESTRES → fórmula independente (remove shareType/ref do grupo)
    mestresDaAba.forEach((c) => {
      const v = c.value;
      c.value = { formula: v.formula, result: v.result };
      mestres++;
    });

    // 3) RESÍDUO: células de fórmula que não expuseram .formula/.sharedFormula
    //    no .value (defesa contra variações internas do ExcelJS). Neutraliza
    //    via getters da própria célula — nenhuma fórmula compartilhada sobrevive.
    const conjuntoTratado = new Set<any>([...clonesDaAba, ...mestresDaAba]);
    celulasFormula
      .filter((c) => !conjuntoTratado.has(c))
      .forEach((c) => {
        let f: string | null = null;
        try {
          f = typeof c.formula === "string" && c.formula.length > 0 ? c.formula : null;
        } catch {
          f = null;
        }
        if (f) {
          c.value = { formula: f, result: c.result };
        } else {
          const r = (() => {
            try {
              return c.result;
            } catch {
              return null;
            }
          })();
          c.value = r !== undefined && r !== null ? r : null;
        }
        outrasTratadas++;
      });

    log(
      "info",
      `Varredura da aba "${aba.name}": ${total} célula(s) · ${mestresDaAba.length} mestre(s) · ${clonesDaAba.length} clone(s) compartilhado(s)${outras > 0 ? ` · ${outras} outra(s) fórmula(s)` : ""}.`
    );
  });

  log(
    "info",
    `Varredura concluída (detecção ValueType.Formula=${TIPO_FORMULA}): ${mestres} mestre(s), ${clones} clone(s)${outrasTratadas > 0 ? `, ${outrasTratadas} residual(is)` : ""}.`
  );
  if (clones > 0 || mestres > 0 || outrasTratadas > 0) {
    log(
      "ok",
      `Fórmulas compartilhadas neutralizadas ANTES da gravação: ${viraramFormula} clone(s) → fórmula independente (referências deslocadas como o Excel faria ao arrastar), ${viraramValor} clone(s) → valor estático, ${mestres} mestre(s) → fórmula independente${outrasTratadas > 0 ? `, ${outrasTratadas} residual(is) neutralizada(s)` : ""}. O erro "Shared Formula master" não pode mais ocorrer.`
    );
  }
}

/** Modo de segurança extremo: transforma TODA fórmula em seu valor calculado. */
function achatarFormulas(wb: Workbook): number {
  let n = 0;
  wb.worksheets.forEach((aba) => {
    aba.eachRow({ includeEmpty: false }, (linha) => {
      linha.eachCell({ includeEmpty: false }, (cel) => {
        const c = cel as any;
        if (ehFormula(c)) {
          const v = c.value;
          const resultado = v && typeof v === "object" ? v.result : undefined;
          c.value = resultado !== undefined ? resultado : null;
          n++;
        }
      });
    });
  });
  return n;
}

/* ------------------------------------------------------------------ */
/*  Preenchimento — mesmo mapa de células do seu Apps Script           */
/* ------------------------------------------------------------------ */

export interface ResultadoExcel {
  blob: Blob;
  nomeArquivo: string;
  abaUsada: string;
  celulasEscritas: number;
}

export async function gerarNddPreenchido(
  dados: DadosPPI,
  cfg: ConfigAutomacao,
  templateBuffer: ArrayBuffer | null,
  log: Logger
): Promise<ResultadoExcel> {
  garantirExcelJS();
  let wb: Workbook;
  let abaUsada = "NDD (template padrão embutido)";

  if (templateBuffer) {
    wb = new ExcelJS.Workbook();
    await wb.xlsx.load(templateBuffer);
    const alvo =
      wb.worksheets.find((s) => s.name.trim().toUpperCase() === "NDD") ??
      wb.worksheets.find((s) => /ndd/i.test(s.name)) ??
      wb.worksheets[0];
    if (!alvo) throw new Error("O template enviado não possui nenhuma aba/planilha.");
    abaUsada = alvo.name;
    log("info", `Template carregado: ${wb.worksheets.length} aba(s) encontrada(s) [${wb.worksheets.map((s) => s.name).join(", ")}]. Usando a aba "${alvo.name}".`);
    // Reparo obrigatório: templates do Excel usam fórmulas compartilhadas
    // (arrastadas) que o ExcelJS não consegue reescrever em certas posições.
    repararFormulasCompartilhadas(wb, log);
  } else {
    // Tentar carregar o template padrão da pasta public/templates/
    try {
      log("info", "Tentando carregar template padrão de /templates/NDD-padrao.xlsx…");
      const response = await fetch("/templates/NDD-padrao.xlsx");
      if (response.ok) {
        const buffer = await response.arrayBuffer();
        wb = new ExcelJS.Workbook();
        await wb.xlsx.load(buffer);
        const alvo =
          wb.worksheets.find((s) => s.name.trim().toUpperCase() === "NDD") ??
          wb.worksheets.find((s) => /ndd/i.test(s.name)) ??
          wb.worksheets[0];
        if (!alvo) throw new Error("Template padrão não possui aba válida.");
        abaUsada = alvo.name;
        log("ok", `Template padrão carregado de /templates/NDD-padrao.xlsx (${(buffer.byteLength / 1024).toFixed(1)} KB). Usando a aba "${alvo.name}".`);
        repararFormulasCompartilhadas(wb, log);
      } else {
        throw new Error(`HTTP ${response.status}`);
      }
    } catch (e: any) {
      log("warn", `Template padrão não encontrado (${e.message}) — usando modelo embutido.`);
      wb = criarTemplatePadrao();
    }
  }

  // força o Excel a recalcular as fórmulas remanescentes ao abrir o arquivo
  try {
    (wb as any).calcProperties = { fullCalcOnLoad: true };
  } catch {
    /* versões antigas do ExcelJS podem ignorar — sem impacto */
  }

  const aba = wb.worksheets.find((s) => s.name === abaUsada) ?? wb.worksheets[0];
  let n = 0;
  const escreve = (cel: string, valor: string | number) => {
    if (valor === "" || valor === null || valor === undefined) return;
    aba.getCell(cel).value = valor;
    n++;
  };

  // ---------- 1. CAMPOS → CÉLULAS (mapa configurável pelo usuário) ----------
  const resolverValor = (campo: string): string => {
    switch (campo) {
      case "site_id_cliente": return dados.site_id_cliente;
      case "site_id_detentor": return dados.site_id_detentor;
      case "endereco": return dados.endereco;
      case "bairro": return dados.bairro || "Zona Rural";
      case "cidade": return dados.cidade;
      case "cep": return dados.cep;
      case "uf": return dados.uf;
      case "latitude": return dados.latitude;
      case "longitude": return dados.longitude;
      case "altura_ev": return dados.altura_ev || "60";
      case "data_rfi": return dados.data_rfi;
      case "nx_base": return dados.nx_base ?? "";
      case "di_base": return dados.di_base ?? "";
      default: return dados.extras?.[campo] ?? "";
    }
  };

  const escritas: string[] = [];
  let ignoradas = 0;
  cfg.mapeamento.forEach((m) => {
    const celula = m.celula.trim().toUpperCase();
    if (!CELULA_RE.test(celula)) {
      ignoradas++;
      return;
    }
    let valor: string = "";
    if (m.valorFixo !== undefined && m.valorFixo !== "") {
      valor = m.valorFixo;
    } else if (m.transformacao && TRANSFORMACOES[m.transformacao]) {
      // Aplicar transformação (ex: "area_base" calcula nx_base × di_base)
      log("info", `Aplicando transformação "${m.transformacao}" para célula ${celula}...`);
      valor = TRANSFORMACOES[m.transformacao](dados, log);
      if (valor) {
        log("ok", `Transformação "${m.transformacao}" aplicada com sucesso → ${celula}="${valor}"`);
      } else {
        log("warn", `Transformação "${m.transformacao}" retornou vazio para célula ${celula}. Verifique se nx_base e di_base foram extraídos corretamente.`);
      }
    } else if (m.campo.trim()) {
      valor = resolverValor(m.campo.trim());
      if (m.br && valor) valor = String(valor).replace(".", ",");
    } else {
      return;
    }
    if (valor === "") return;
    aba.getCell(celula).value = valor;
    n++;
    escritas.push(`${celula}="${String(valor).slice(0, 16)}${String(valor).length > 16 ? "…" : ""}"`);
  });
  if (ignoradas > 0) {
    log("warn", `${ignoradas} regra(s) do mapa ignoradas por célula inválida — confira na página Configuração.`);
  }
  log("ok", `Mapa de células aplicado: ${n} célula(s) escrita(s) [${escritas.slice(0, 8).join(", ")}${escritas.length > 8 ? ", …" : ""}].`);

  // ---------- 2. TABELA DE EQUIPAMENTOS (linha inicial configurável) ----------
  const qtdEq = dados.equipamentos.length;
  if (qtdEq > 0) {
    const linhaInicial = cfg.linhaInicialEq;
    dados.equipamentos.forEach((eq, idx) => {
      const L = linhaInicial + idx;
      escreve(`A${L}`, "TIM");
      escreve(`B${L}`, "NOVA");
      escreve(`C${L}`, eq.tipo_equipamento);
      escreve(`D${L}`, eq.fabricante || "-");
      escreve(`E${L}`, eq.modelo);
      escreve(`G${L}`, Number(eq.qtde) || eq.qtde || 1);
      escreve(`H${L}`, eq.azimute || "-");
      escreve(`I${L}`, eq.comprimento || "-");
      escreve(`J${L}`, eq.largura || "-");
      escreve(`K${L}`, eq.profundidade || "-");
      escreve(`L${L}`, eq.rad_center);
      escreve(`M${L}`, "N/A");
      escreve(`N${L}`, "N/A");
      escreve(`O${L}`, brDecimal(eq.aev_sem_ca));
      escreve(`P${L}`, brDecimal(eq.ca, "1,2"));
      escreve(`Q${L}`, brDecimal(eq.aev_com_ca));
    });
    log("ok", `Tabela de equipamentos: ${qtdEq} linha(s) escritas a partir da linha 23 (AEV no formato BR, com vírgula).`);
  } else {
    log("warn", "Nenhum equipamento para gravar — a tabela ficou como estava.");
  }

  // OBS: Resumo de Equipamentos e tabela de Gabinete/VSAT NÃO são tocados,
  // preservando as fórmulas do template original — igual ao seu código.

  let buffer: any;
  try {
    buffer = await wb.xlsx.writeBuffer();
    log("info", `Serialização do .xlsx concluída na 1ª tentativa (${((buffer?.byteLength ?? 0) / 1024).toFixed(1)} KB).`);
  } catch (e1: any) {
    log("warn", `1ª serialização falhou: "${e1?.message ?? e1}". Ativando modo de segurança (fórmulas → valores)…`);
    try {
      const achatadas = achatarFormulas(wb);
      log(
        "warn",
        `Modo de segurança aplicado: ${achatadas} célula(s) de fórmula convertidas em valores estáticos. O arquivo será gerado, mas as fórmulas desta cópia não recalcularão (os valores exibidos são os últimos calculados pelo Excel).`
      );
      buffer = await wb.xlsx.writeBuffer();
      log("ok", `Serialização concluída no modo de segurança (${((buffer?.byteLength ?? 0) / 1024).toFixed(1)} KB).`);
    } catch (e2: any) {
      log("error", `Serialização falhou até no modo de segurança: ${e2?.message ?? e2}`, e2?.stack);
      throw new Error(
        `Falha ao serializar o .xlsx mesmo no modo de segurança (${e2?.message ?? e2}). O template provavelmente contém gráficos, macros ou proteção — remova-o no passo 02 e gere com o modelo embutido.`
      );
    }
  }
  if (!buffer || (buffer as ArrayBuffer).byteLength === 0) {
    throw new Error("O buffer do .xlsx saiu vazio. Tente novamente — se persistir, remova o template e use o modelo embutido.");
  }
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });

  // Gerar nome do arquivo seguindo o padrão: [NDD] WINITY_{ID_OPERADORA}_{ID_WINITY}_{CIDADE}_{ID_OPERADORA}
  const idOperadora = dados.site_id_cliente || "SEM_ID_OPERADORA";
  const idWinity = dados.site_id_detentor || "SEM_ID_WINITY";
  const cidade = dados.cidade || "SEM_CIDADE";

  // Sanitizar para uso em nome de arquivo (remover caracteres inválidos)
  const sanitizar = (str: string) => str.replace(/[<>:"/\\|?*]/g, "_").trim();

  const nomeArquivo = `[NDD] WINITY_${sanitizar(idOperadora)}_${sanitizar(idWinity)}_${sanitizar(cidade)}_${sanitizar(idOperadora)}.xlsx`;

  return {
    blob,
    nomeArquivo,
    abaUsada,
    celulasEscritas: n,
  };
}

export function baixarBlob(blob: Blob, nome: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

/**
 * Baixa o template padrão NDD-padrao.xlsx para o usuário editar.
 * Se o arquivo existir em /templates/, baixa ele. Caso contrário,
 * gera e baixa o template embutido.
 */
export async function baixarTemplatePadrao(): Promise<void> {
  try {
    const response = await fetch("/templates/NDD-padrao.xlsx");
    if (response.ok) {
      const blob = await response.blob();
      baixarBlob(blob, "NDD-padrao.xlsx");
      return;
    }
  } catch {
    // arquivo não existe, gerar embutido
  }

  // Fallback: gerar template embutido
  const wb = criarTemplatePadrao();
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  baixarBlob(blob, "NDD-padrao.xlsx");
}
