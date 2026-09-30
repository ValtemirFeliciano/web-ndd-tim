/**
 * Funções de transformação de dados antes de gravar na planilha.
 *
 * Estas funções são aplicadas aos valores extraídos pela IA para
 * calcular campos derivados (ex: área total de base de concreto).
 */

/**
 * Retorna as dimensões da base de concreto diretamente como aparecem no PDF,
 * sem calcular nem multiplicar pela quantidade de bases (ignora o "2x base").
 *
 * Exemplo:
 * - Se no PDF constar "2X BASE DE CONCRETO (1,00X1,00m)" → "1,00 x 1,00"
 * - Se for "1X BASE DE CONCRETO (3,50X1,30m)" → "3,50 x 1,30"
 * - Se for "1,00x1,00" → "1,00 x 1,00"
 *
 * @param nxBase - quantidade de bases (ignorado conforme solicitação do usuário)
 * @param diBase - dimensões da base extraídas do PDF (ex: "1,00x1,00" ou "3,50x1,30")
 * @param log - função de log opcional para debug
 * @returns string formatada (ex: "1,00 x 1,00" ou "3,50 x 1,30")
 */
export function calcularAreaBase(
  nxBase: string | undefined,
  diBase: string | undefined,
  log?: (level: "info" | "warn" | "error", msg: string) => void
): string {
  const logDebug = log || (() => {});

  logDebug("info", `═══ ÁREA DA BASE (SEM CÁLCULO / DIRETO DO PDF) ═══`);
  logDebug("info", `Entrada do PDF: di_base="${diBase}", nx_base="${nxBase}" (nx_base ignorado: pegando apenas o que estiver no PDF)`);

  if (!diBase) {
    logDebug("warn", `Campo di_base vazio - dimensões da base não informadas`);
    return "";
  }

  // Remove prefixos de quantidade se vierem juntos em di_base (ex: "2X", "2X BASE DE CONCRETO", etc.)
  let limpo = diBase.replace(/^\s*\d+\s*[xX×]\s*(?:bases?\s*(?:de\s*(?:concreto\s*)?)?)?/i, "");
  limpo = limpo.replace(/[\(\)m]/gi, "").trim();

  // Extrai as duas dimensões literais mantendo a pontuação original (ex: "1,00" e "1,00" ou "3,50" e "1,30")
  const match = limpo.match(/([0-9]+(?:[.,][0-9]+)?)\s*[xX×*]\s*([0-9]+(?:[.,][0-9]+)?)/);
  if (!match) {
    logDebug("info", `Dimensões literais mantidas: "${limpo}"`);
    return limpo;
  }

  const d1Str = match[1].replace(".", ",");
  const d2Str = match[2].replace(".", ",");
  const resultado = `${d1Str} x ${d2Str}`;

  logDebug("info", `Dimensão da base direta (sem multiplicar por nx_base): "${resultado}"`);
  logDebug("info", `══════════════════════════════════════════════════`);

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
