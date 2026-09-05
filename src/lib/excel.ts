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
  } else {
    wb = criarTemplatePadrao();
    log("info", "Nenhum template enviado — usando o modelo padrão embutido (layout NDD).");
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
  } catch (e: any) {
    throw new Error(
      `Falha ao serializar o .xlsx (${e?.message ?? e}). Se estiver usando um template com gráficos, macros ou proteção, remova-o no passo 02 e gere com o modelo embutido.`
    );
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
