import { CONFIG_PADRAO, montarPromptFinal } from "./mapping";

/**
 * O prompt agora é MONTADO dinamicamente a partir da configuração do usuário
 * (página Configuração): instruções de domínio + mapa de células + schema JSON.
 *
 * Veja: src/lib/mapping.ts → montarPromptFinal()
 *
 * Esta constante permanece apenas como o prompt de fábrica (mapa padrão do
 * Apps Script original), usada como fallback/preview.
 */
export const PROMPT_EXTRACAO = montarPromptFinal(CONFIG_PADRAO);

export { INSTRUCOES_PADRAO } from "./mapping";
