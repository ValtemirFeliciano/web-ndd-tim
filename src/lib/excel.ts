// Interop reforçado: o bundle UMD do ExcelJS pode chegar como { default: ... }
// dependendo do bundler/ambiente — cobrimos os dois formatos.
import * as ExcelJSMod from "exceljs/dist/exceljs.min.js";
import type { Borders, Workbook } from "exceljs";
import type { DadosPPI, LogLevel } from "../types";

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

const TIPO_FORMULA = 2; // ExcelJS CellTypes.Formula

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
 * Converte TODOS os clones de fórmulas compartilhadas em fórmulas
 * independentes (com referências recalculadas) ou em valores estáticos
 * quando não há como reconstruir a fórmula. Isso elimina a validação do
 * ExcelJS que derrubava a serialização com templates que usam fórmulas
 * arrastadas (muito comum em NDD: colunas de AEV, tilt e Resumo).
 */
function repararFormulasCompartilhadas(wb: Workbook, log: Logger): void {
  let mestres = 0;
  let clones = 0;
  let viraramFormula = 0;
  let viraramValor = 0;

  wb.worksheets.forEach((aba) => {
    const celulasFormula: any[] = [];
    aba.eachRow({ includeEmpty: false }, (linha) => {
      linha.eachCell({ includeEmpty: false }, (cel) => {
        const c = cel as any;
        if (c?.type === TIPO_FORMULA) celulasFormula.push(c);
      });
    });

    mestres += celulasFormula.filter(
      (c) => c.value && typeof c.value === "object" && typeof c.value.formula === "string" && !c.value.sharedFormula
    ).length;

    const clonesDaAba = celulasFormula.filter(
      (c) => c.value && typeof c.value === "object" && typeof c.value.sharedFormula === "string"
    );
    clones += clonesDaAba.length;

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
        if (cv && typeof cv === "object" && typeof cv.formula === "string" && !cv.sharedFormula) {
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
        // sem mestre (ex.: célula-mestre sobrescrita) → mantém o valor calculado
        cel.value = v.result ?? null;
        viraramValor++;
      }
    });
  });

  log(
    "info",
    `Varredura de fórmulas no template: ${mestres} fórmula(s) independentes e ${clones} clone(s) de fórmula compartilhada.`
  );
  if (clones > 0) {
    log(
      "ok",
      `Fórmulas compartilhadas reparadas ANTES da gravação: ${viraramFormula} clone(s) → fórmula independente (referências deslocadas como o Excel faria), ${viraramValor} → valor estático. Correção preventiva do erro "Shared Formula master" do ExcelJS.`
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
        if (c?.type === TIPO_FORMULA && c.value && typeof c.value === "object") {
          c.value = c.value.result ?? null;
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
    wb = criarTemplatePadrao();
    log("info", "Nenhum template enviado — usando o modelo padrão embutido (layout NDD).");
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

  // ---------- 1. CABEÇALHO (mapa idêntico ao Apps Script) ----------
  escreve("D7", dados.data_rfi);
  escreve("C9", dados.site_id_cliente);
  escreve("P9", dados.site_id_detentor);
  escreve("C11", dados.latitude);
  escreve("J11", dados.longitude);
  escreve("C12", dados.endereco);
  escreve("D12", dados.endereco);
  if (dados.endereco) {
    ["C12", "D12"].forEach((c) => (aba.getCell(c).font = { color: { argb: "FF000000" } }));
  }
  escreve("B13", dados.bairro || "Zona Rural");
  escreve("I13", dados.cidade);
  escreve("O13", dados.cep);
  escreve("S13", dados.uf);
  escreve("C14", dados.altura_ev || "60");
  escreve("D14", dados.altura_ev || "60");
  ["C14", "D14"].forEach((c) => (aba.getCell(c).font = { color: { argb: "FF000000" } }));
  escreve("D15", "( X )");
  log("ok", `Cabeçalho preenchido (células D7→D15): ${n} células escritas.`);

  // ---------- 2. TABELA DE EQUIPAMENTOS (a partir da linha 23) ----------
  const qtdEq = dados.equipamentos.length;
  if (qtdEq > 0) {
    const linhaInicial = 23;
    dados.equipamentos.forEach((eq, idx) => {
      const L = linhaInicial + idx;
      escreve(`A${L}`, "TIM");
      escreve(`B${L}`, "NOVA");
      escreve(`C${L}`, eq.tipo_equipamento);
      escreve(`D${L}`, eq.fabricante || "-");
      escreve(`E${L}`, eq.modelo);
      escreve(`G${L}`, Number(eq.qtde) || eq.qtde || 1);
      escreve(`H${L}`, eq.azimute || "-");
      escreve(`I${L}`, eq.altura || "-");
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
  const siteId = (dados.site_id_cliente || dados.site_id_detentor || "SITE").replace(/[^\w-]+/g, "_");
  const hoje = new Date();
  const stamp = `${String(hoje.getDate()).padStart(2, "0")}${String(hoje.getMonth() + 1).padStart(2, "0")}${hoje.getFullYear()}`;
  return {
    blob,
    nomeArquivo: `NDD_${siteId}_${stamp}.xlsx`,
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
