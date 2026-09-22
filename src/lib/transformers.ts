/**
 * Funções de transformação de dados antes de gravar na planilha.
 *
 * Estas funções são aplicadas aos valores extraídos pela IA para
 * calcular campos derivados (ex: área total de base de concreto).
 */

/**
 * Calcula a área total da base de concreto a partir da quantidade e dimensões.
 *
 * Regra:
 * - Se houver 2 bases de "1,00m x 1,00m" → "2 x 2"
 * - Se for 1 base de "1,00m x 1,00m" → "1 x 1"
 * - Se for 1 base de "3,00m x 5,00m" → "3 x 5"
 * - Se for 2 bases de "3,00m x 5,00m" → "6 x 10"
 *
 * @param nxBase - quantidade de bases (ex: "2")
 * @param diBase - dimensões da base (ex: "1,00x1,00" ou "3,00x5,00")
 * @param log - função de log opcional para debug
 * @returns string formatada (ex: "2 x 2" ou "6 x 10")
 */
export function calcularAreaBase(
  nxBase: string | undefined,
  diBase: string | undefined,
  log?: (level: "info" | "warn" | "error", msg: string) => void
): string {
  const logDebug = log || (() => {});

  logDebug("info", `═══ CÁLCULO DE ÁREA DA BASE ═══`);
  logDebug("info", `Entrada do PDF: nx_base="${nxBase}", di_base="${diBase}"`);

  if (!nxBase || !diBase) {
    logDebug("warn", `Campos vazios - não é possível calcular área`);
    return "";
  }

  // Extrair quantidade (pode ser "2", "2x", "2 bases", etc)
  const qtdMatch = nxBase.match(/(\d+)/);
  if (!qtdMatch) {
    logDebug("warn", `Não foi possível extrair quantidade de "${nxBase}"`);
    return "";
  }
  const quantidade = parseInt(qtdMatch[1], 10);
  logDebug("info", `Quantidade de bases extraída: ${quantidade}`);

  // Extrair dimensões (pode ser "1,00x1,00", "1.00 x 1.00", "3,00m x 5,00m", etc)
  // Normalizar: trocar vírgula por ponto, remover "m"
  const dimensaoLimpa = diBase
    .replace(/m/gi, "") // remover "m"
    .replace(/,/g, ".") // trocar vírgula por ponto
    .trim();

  logDebug("info", `Dimensões do PDF (normalizadas): "${dimensaoLimpa}"`);

  // Tentar extrair duas dimensões (padrão: "1.00x1.00" ou "1.00 x 1.00")
  // IMPORTANTE: Mantemos a ordem original do PDF!
  const dimMatch = dimensaoLimpa.match(/(\d+(?:\.\d+)?)\s*[xX×]\s*(\d+(?:\.\d+)?)/);
  if (!dimMatch) {
    logDebug("warn", `Não foi possível extrair dimensões de "${dimensaoLimpa}"`);
    return "";
  }

  const dim1Original = parseFloat(dimMatch[1]);
  const dim2Original = parseFloat(dimMatch[2]);
  logDebug("info", `Ordem original do PDF: ${dim1Original}m × ${dim2Original}m`);

  if (isNaN(dim1Original) || isNaN(dim2Original)) {
    logDebug("warn", `Valores inválidos (dim1=${dim1Original}, dim2=${dim2Original})`);
    return "";
  }

  // Calcular dimensões totais (quantidade × dimensões)
  // PRESERVANDO a ordem original do PDF!
  const total1 = quantidade * dim1Original;
  const total2 = quantidade * dim2Original;
  logDebug("info", `Cálculo: ${quantidade} × ${dim1Original} = ${total1}m | ${quantidade} × ${dim2Original} = ${total2}m`);

  // Formatar resultado (usar vírgula como separador decimal para pt-BR)
  const formatar = (n: number) => {
    // Se for inteiro, não mostrar casas decimais
    if (Number.isInteger(n)) return n.toString();
    // Caso contrário, mostrar até 2 casas decimais
    return n.toFixed(2).replace(".", ",");
  };

  const resultado = `${formatar(total1)} x ${formatar(total2)}`;
  logDebug("info", `Resultado final (mantendo ordem do PDF): "${resultado}"`);
  logDebug("info", `═══════════════════════════════`);

  return resultado;
}

/**
 * Multiplica as dimensões resultantes da base de concreto.
 * Exemplo:
 * - Se a base for "3 x 5" → retorna "15" (3 × 5)
 * - Se for "1 x 1" → retorna "1" (1 × 1)
 * - Se for "2 x 2" → retorna "4" (2 × 2)
 * - Se for "2,10 x 1,30" → retorna "2,73" (2.10 × 1.30)
 *
 * @param dimensoesStr - texto com as dimensões (ex: "3 x 5" ou "2,10 x 1,30")
 * @returns string com o resultado da multiplicação (ex: "15" ou "2,73")
 */
export function multiplicarDimensoes(dimensoesStr: string): string {
  if (!dimensoesStr) return "";
  const match = dimensoesStr.match(/(\d+(?:[.,]\d+)?)\s*[xX×*]\s*(\d+(?:[.,]\d+)?)/);
  if (!match) return "";
  const d1 = parseFloat(match[1].replace(",", "."));
  const d2 = parseFloat(match[2].replace(",", "."));
  if (isNaN(d1) || isNaN(d2)) return "";
  const mult = d1 * d2;
  return Number.isInteger(mult) ? mult.toString() : mult.toFixed(2).replace(".", ",");
}

/**
 * Calcula a multiplicação da base para a célula E49 a partir dos dados do PPI.
 */
export function calcularMultiplicacaoBase(
  nxBaseOrDados: any,
  diBaseOrLog?: any,
  logFn?: (level: "info" | "warn" | "error", msg: string) => void
): string {
  let nx: string | undefined;
  let di: string | undefined;
  let log = logFn;

  if (typeof nxBaseOrDados === "object" && nxBaseOrDados !== null) {
    nx = nxBaseOrDados.nx_base;
    di = nxBaseOrDados.di_base;
    log = diBaseOrLog;
  } else if (typeof nxBaseOrDados === "string" && (!diBaseOrLog || typeof diBaseOrLog === "function")) {
    return multiplicarDimensoes(nxBaseOrDados);
  } else {
    nx = nxBaseOrDados;
    di = diBaseOrLog;
  }

  const logDebug = log || (() => {});
  logDebug("info", `═══ CÁLCULO DE MULTIPLICAÇÃO DA BASE (E49) ═══`);
  const area = calcularAreaBase(nx, di, log);
  if (!area) {
    logDebug("warn", `Dimensões da base vazias — multiplicação não calculada`);
    return "";
  }
  const resultado = multiplicarDimensoes(area);
  logDebug("info", `Multiplicação calculada a partir de "${area}": "${resultado}"`);
  logDebug("info", `══════════════════════════════════════════════`);
  return resultado;
}

/**
 * Converte string com vírgula ou ponto para Number real.
 */
export function paraNumero(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v !== "string") return null;
  const limpo = v.trim();
  if (!limpo || limpo === "-" || limpo === "N/A" || limpo === "NA") return null;
  let normalizado: string;
  if (limpo.includes(",")) {
    normalizado = limpo.replace(/\./g, "").replace(",", ".");
  } else {
    normalizado = limpo;
  }
  const n = Number(normalizado);
  return Number.isFinite(n) ? n : null;
}

/**
 * Calcula a soma do AEV SEM Coeficiente de Arrasto de todos os equipamentos (G37).
 */
export function calcularAevTotalSemCa(
  dados: any,
  log?: (level: "info" | "warn" | "error", msg: string) => void
): string {
  const equipamentos = Array.isArray(dados?.equipamentos) ? dados.equipamentos : [];
  let soma = 0;
  for (const eq of equipamentos) {
    const val = paraNumero(eq.aev_sem_ca);
    if (val !== null) soma += val;
  }
  const res = soma.toFixed(3);
  log?.("info", `AEV Total SEM CA calculado: ${res} m² (${equipamentos.length} equipamentos)`);
  return res;
}

/**
 * Calcula a soma do AEV COM Coeficiente de Arrasto de todos os equipamentos (K37).
 */
export function calcularAevTotalComCa(
  dados: any,
  log?: (level: "info" | "warn" | "error", msg: string) => void
): string {
  const equipamentos = Array.isArray(dados?.equipamentos) ? dados.equipamentos : [];
  let soma = 0;
  for (const eq of equipamentos) {
    const val = paraNumero(eq.aev_com_ca);
    if (val !== null) soma += val;
  }
  const res = soma.toFixed(3);
  log?.("info", `AEV Total COM CA calculado: ${res} m² (${equipamentos.length} equipamentos)`);
  return res;
}

/**
 * Calcula a reserva de AEV SEM Coeficiente de Arrasto (4,00m² - AEV Total Atual) (G38).
 */
export function calcularAevReservaSemCa(
  dados: any,
  log?: (level: "info" | "warn" | "error", msg: string) => void
): string {
  const total = parseFloat(calcularAevTotalSemCa(dados)) || 0;
  const reserva = Math.max(0, 4.0 - total);
  const res = reserva.toFixed(2);
  log?.("info", `AEV Reserva SEM CA calculada: 4,00 - ${total.toFixed(3)} = ${res} m²`);
  return res;
}

/**
 * Calcula a reserva de AEV COM Coeficiente de Arrasto (4,00m² - AEV Total Atual) (K38).
 */
export function calcularAevReservaComCa(
  dados: any,
  log?: (level: "info" | "warn" | "error", msg: string) => void
): string {
  const total = parseFloat(calcularAevTotalComCa(dados)) || 0;
  const reserva = Math.max(0, 4.0 - total);
  const res = reserva.toFixed(2);
  log?.("info", `AEV Reserva COM CA calculada: 4,00 - ${total.toFixed(3)} = ${res} m²`);
  return res;
}

/**
 * AEV Total a Instalar SEM Coeficiente de Arrasto (G39).
 */
export function calcularAevInstalarSemCa(
  dados: any,
  log?: (level: "info" | "warn" | "error", msg: string) => void
): string {
  return calcularAevTotalSemCa(dados, log);
}

/**
 * AEV Total a Instalar COM Coeficiente de Arrasto (K39).
 */
export function calcularAevInstalarComCa(
  dados: any,
  log?: (level: "info" | "warn" | "error", msg: string) => void
): string {
  return calcularAevTotalComCa(dados, log);
}

/**
 * AEV Final SEM Coeficiente de Arrasto (G42).
 */
export function calcularAevFinalSemCa(
  dados: any,
  log?: (level: "info" | "warn" | "error", msg: string) => void
): string {
  return calcularAevTotalSemCa(dados, log);
}

/**
 * AEV Final COM Coeficiente de Arrasto (K42).
 */
export function calcularAevFinalComCa(
  dados: any,
  log?: (level: "info" | "warn" | "error", msg: string) => void
): string {
  return calcularAevTotalComCa(dados, log);
}

/**
 * Mapa de transformações disponíveis.
 * Cada função recebe os dados extraídos e retorna o valor transformado.
 */
export const TRANSFORMACOES: Record<string, (dados: any, log?: (level: "info" | "warn" | "error", msg: string) => void) => string> = {
  area_base: (dados, log) => calcularAreaBase(dados?.nx_base, dados?.di_base, log),
  multiplicacao_base: (dados, log) => calcularMultiplicacaoBase(dados, log),
  aev_total_sem_ca: (dados, log) => calcularAevTotalSemCa(dados, log),
  aev_total_com_ca: (dados, log) => calcularAevTotalComCa(dados, log),
  aev_reserva_sem_ca: (dados, log) => calcularAevReservaSemCa(dados, log),
  aev_reserva_com_ca: (dados, log) => calcularAevReservaComCa(dados, log),
  aev_instalar_sem_ca: (dados, log) => calcularAevInstalarSemCa(dados, log),
  aev_instalar_com_ca: (dados, log) => calcularAevInstalarComCa(dados, log),
  aev_final_sem_ca: (dados, log) => calcularAevFinalSemCa(dados, log),
  aev_final_com_ca: (dados, log) => calcularAevFinalComCa(dados, log),
};
