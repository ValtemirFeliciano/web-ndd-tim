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
 * Mapa de transformações disponíveis.
 * Cada função recebe os dados extraídos e retorna o valor transformado.
 */
export const TRANSFORMACOES: Record<string, (dados: any, log?: (level: "info" | "warn" | "error", msg: string) => void) => string> = {
  area_base: (dados, log) => calcularAreaBase(dados.nx_base, dados.di_base, log),
};
