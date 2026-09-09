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
 * @returns string formatada (ex: "2 x 2" ou "6 x 10")
 */
export function calcularAreaBase(nxBase: string | undefined, diBase: string | undefined): string {
  if (!nxBase || !diBase) return "";

  // Extrair quantidade (pode ser "2", "2x", "2 bases", etc)
  const qtdMatch = nxBase.match(/(\d+)/);
  if (!qtdMatch) return "";
  const quantidade = parseInt(qtdMatch[1], 10);

  // Extrair dimensões (pode ser "1,00x1,00", "1.00 x 1.00", "3,00m x 5,00m", etc)
  // Normalizar: trocar vírgula por ponto, remover "m", "x" como separador
  const dimensaoLimpa = diBase
    .replace(/m/gi, "") // remover "m"
    .replace(/,/g, ".") // trocar vírgula por ponto
    .trim();

  // Tentar extrair duas dimensões (padrão: "1.00x1.00" ou "1.00 x 1.00")
  const dimMatch = dimensaoLimpa.match(/(\d+(?:\.\d+)?)\s*[xX×]\s*(\d+(?:\.\d+)?)/);
  if (!dimMatch) return "";

  const largura = parseFloat(dimMatch[1]);
  const profundidade = parseFloat(dimMatch[2]);

  if (isNaN(largura) || isNaN(profundidade)) return "";

  // Calcular dimensões totais (quantidade × dimensões)
  const larguraTotal = quantidade * largura;
  const profundidadeTotal = quantidade * profundidade;

  // Formatar resultado (usar vírgula como separador decimal para pt-BR)
  const formatar = (n: number) => {
    // Se for inteiro, não mostrar casas decimais
    if (Number.isInteger(n)) return n.toString();
    // Caso contrário, mostrar até 2 casas decimais
    return n.toFixed(2).replace(".", ",");
  };

  return `${formatar(larguraTotal)} x ${formatar(profundidadeTotal)}`;
}

/**
 * Mapa de transformações disponíveis.
 * Cada função recebe os dados extraídos e retorna o valor transformado.
 */
export const TRANSFORMACOES: Record<string, (dados: any) => string> = {
  area_base: (dados) => calcularAreaBase(dados.nx_base, dados.di_base),
};
