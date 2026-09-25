import type { AliasColuna, CampoMapeamento, ConfigAutomacao, TipoProjeto } from "../types";

/* ------------------------------------------------------------------ */
/*  Mapa de células — antes vivia hardcoded em src/lib/excel.ts.       */
/*  Agora é configurável pelo usuário (página Configuração) e          */
/*  persistido no localStorage do navegador.                           */
/* ------------------------------------------------------------------ */

const LS_KEY = "nddforge.automacao.v1";

/** Dicas de extração dos campos padrão — entram no prompt montado. */
export const DESCRICOES_CAMPOS: Record<string, string> = {
  site_id_cliente: '2ª linha do carimbo "SITE:" (ex: SN-RRRSI4)',
  site_id_detentor: '1ª linha do carimbo "SITE:" (ex: MSRBS006_A)',
  data_emissao: "data de geração da NDD (preenchida automaticamente via código)",
  data_rfi: "data do RFI informada pelo usuário ou extraída do PPI (formato DD/MM/AAAA)",
  endereco: "endereço completo do site",
  bairro: "bairro (ou Zona Rural)",
  cidade: "cidade",
  cep: "CEP, somente dígitos no formato 00000-000",
  uf: "UF, sigla com 2 letras",
  latitude: "latitude em graus decimais (ex: -22.906847, sem ° nem N/S)",
  longitude: "longitude em graus decimais (ex: -43.172897, sem ° nem E/W)",
  altura_ev: 'altura da EV — item 03 da legenda ou cota na elevação da torre (ex: "60")',
  nx_base: "quantidade de bases de concreto (ex: 2)",
  di_base: 'dimensões da base (ex: "1,00x1,00" ou "3,00x5,00")',
};

export const CAMPOS_CONHECIDOS = Object.keys(DESCRICOES_CAMPOS);

export const CELULA_RE = /^[A-Za-z]{1,3}[1-9][0-9]*$/;
export const CAMPO_RE = /^[a-z][a-z0-9_]*$/;

let seq = 0;
const novoId = () => `m_${Date.now().toString(36)}_${(seq++).toString(36)}`;

function mapeamentoPadrao(): CampoMapeamento[] {
  // Réplica exata do mapa de células do Apps Script original (preencherPlanilha).
  return [
    { id: novoId(), campo: "site_id_cliente", celula: "C9" },
    { id: novoId(), campo: "site_id_detentor", celula: "P9" },
    { id: novoId(), campo: "data_emissao", celula: "D6" },
    { id: novoId(), campo: "data_rfi", celula: "D7" },
    { id: novoId(), campo: "latitude", celula: "C11" },
    { id: novoId(), campo: "longitude", celula: "J11" },
    { id: novoId(), campo: "endereco", celula: "D12" },
    { id: novoId(), campo: "bairro", celula: "B13" },
    { id: novoId(), campo: "cidade", celula: "I13" },
    { id: novoId(), campo: "cep", celula: "O13" },
    { id: novoId(), campo: "uf", celula: "S13" },
    { id: novoId(), campo: "altura_ev", celula: "D14" },
    { id: novoId(), campo: "", celula: "G37", transformacao: "aev_total_sem_ca" },
    { id: novoId(), campo: "", celula: "K37", transformacao: "aev_total_com_ca" },
    { id: novoId(), campo: "", celula: "G38", transformacao: "aev_reserva_sem_ca" },
    { id: novoId(), campo: "", celula: "K38", transformacao: "aev_reserva_com_ca" },
    { id: novoId(), campo: "", celula: "G39", transformacao: "aev_instalar_sem_ca" },
    { id: novoId(), campo: "", celula: "K39", transformacao: "aev_instalar_com_ca" },
    { id: novoId(), campo: "", celula: "G42", transformacao: "aev_final_sem_ca" },
    { id: novoId(), campo: "", celula: "K42", transformacao: "aev_final_com_ca" },
    { id: novoId(), campo: "", celula: "K46", transformacao: "area_base" },
    { id: novoId(), campo: "", celula: "E49", transformacao: "multiplicacao_base" },
  ];
}

/** Aliases padrão para mapear nomes de colunas do PDF para o sistema */
function aliasesPadrao(): AliasColuna[] {
  return [
    { id: novoId(), campoSistema: "tipo_equipamento", aliasPdf: "TIPO DE ANTENA" },
    { id: novoId(), campoSistema: "tipo_equipamento", aliasPdf: "TIPO ANTENA" },
    { id: novoId(), campoSistema: "tipo_equipamento", aliasPdf: "TIPO DE EQUIPAMENTO" },
    { id: novoId(), campoSistema: "tipo_equipamento", aliasPdf: "TIPO EQUIPAMENTO" },
    { id: novoId(), campoSistema: "tipo_equipamento", aliasPdf: "TIPO" },
    { id: novoId(), campoSistema: "tipo_equipamento", aliasPdf: "Equipment" },
    { id: novoId(), campoSistema: "modelo", aliasPdf: "Model" },
    { id: novoId(), campoSistema: "modelo", aliasPdf: "Mod" },
    { id: novoId(), campoSistema: "qtde", aliasPdf: "QUANT." },
    { id: novoId(), campoSistema: "qtde", aliasPdf: "QUANT" },
    { id: novoId(), campoSistema: "qtde", aliasPdf: "Qtd" },
    { id: novoId(), campoSistema: "qtde", aliasPdf: "Qtd." },
    { id: novoId(), campoSistema: "qtde", aliasPdf: "Qty" },
    { id: novoId(), campoSistema: "azimute", aliasPdf: "AZIMUTE (°NV)" },
    { id: novoId(), campoSistema: "azimute", aliasPdf: "AZIMUTE" },
    { id: novoId(), campoSistema: "azimute", aliasPdf: "Az" },
    { id: novoId(), campoSistema: "azimute", aliasPdf: "Azim" },
    { id: novoId(), campoSistema: "comprimento", aliasPdf: "Length" },
    { id: novoId(), campoSistema: "comprimento", aliasPdf: "Height" },
    { id: novoId(), campoSistema: "comprimento", aliasPdf: "Alt" },
    { id: novoId(), campoSistema: "comprimento", aliasPdf: "Comp" },
    { id: novoId(), campoSistema: "comprimento", aliasPdf: "Comprimento" },
    { id: novoId(), campoSistema: "largura", aliasPdf: "Larg" },
    { id: novoId(), campoSistema: "largura", aliasPdf: "Width" },
    { id: novoId(), campoSistema: "largura", aliasPdf: "Largura" },
    { id: novoId(), campoSistema: "profundidade", aliasPdf: "Prof" },
    { id: novoId(), campoSistema: "profundidade", aliasPdf: "Depth" },
    { id: novoId(), campoSistema: "profundidade", aliasPdf: "Profundidade" },
    { id: novoId(), campoSistema: "profundidade", aliasPdf: "Diâmetro" },
    { id: novoId(), campoSistema: "profundidade", aliasPdf: "Diametro" },
    { id: novoId(), campoSistema: "rad_center", aliasPdf: "COTA" },
    { id: novoId(), campoSistema: "rad_center", aliasPdf: "RAD CENTER" },
    { id: novoId(), campoSistema: "rad_center", aliasPdf: "RadCenter" },
    { id: novoId(), campoSistema: "ca", aliasPdf: "ARRASTO" },
    { id: novoId(), campoSistema: "ca", aliasPdf: "CA" },
    { id: novoId(), campoSistema: "aev_sem_ca", aliasPdf: "ÁREA DE EXPOSIÇÃO" },
    { id: novoId(), campoSistema: "aev_sem_ca", aliasPdf: "AEV" },
    { id: novoId(), campoSistema: "aev_com_ca", aliasPdf: "ÁREA COM ARRASTO" },
    { id: novoId(), campoSistema: "aev_com_ca", aliasPdf: "ÁREA DE EXPOSIÇÃO COM ARRASTO" },
  ];
}

export const INSTRUCOES_PADRAO = `1. CARIMBO ("SITE:"):
   - Primeira linha (ex: MSRBS006_A) = "site_id_detentor".
   - Segunda linha (ex: SN-RRRSI4) = "site_id_cliente".
2. ALTURA DA EV: item 03 da legenda ou cota na elevação da torre (ex: "60"). Se não encontrar, use "60".
3. LOCALIZAÇÃO E ENDEREÇO (Carimbo):
   - No carimbo, o endereço costuma vir em linha única separado por hífens (ex: "VC CAFÉ DO POVO - CRISTO VIVO - BREU BRANCO - PA CEP:68695-000").
   - Isole no campo "endereco" APENAS o logradouro/rua/vicinal/estrada (ex: "VC CAFÉ DO POVO"). NUNCA repita o bairro, cidade, UF ou CEP dentro do campo "endereco".
   - Extraia separadamente: "bairro" (ex: "CRISTO VIVO" ou "Zona Rural"), "cidade" (ex: "BREU BRANCO"), "uf" (sigla com 2 letras, ex: "PA"), "cep" (somente dígitos ou formato 00000-000) e COORDENADAS em graus decimais (ex: -3.413902 e -49.042893, sem símbolos ° ou letras N/S/E/W).
4. TABELA DE EQUIPAMENTOS (Página 3 - "CARREGAMENTO ANTENAS TIM A INSTALAR"):
   - Leia a tabela linha por linha com fidelidade óptica rigorosa:
   - A coluna "TIPO DE ANTENA" (ou "TIPO" / "TIPO DE EQUIPAMENTO"): extraia EXATAMENTE o texto literal da célula.
     * "RF" -> extraia "RF"
     * "RRU" -> extraia EXATAMENTE "RRU" (NUNCA troque por "MODULO"!)
     * "ODU" -> extraia EXATAMENTE "ODU" (NUNCA troque por "MW"!)
     * "MW" -> extraia EXATAMENTE "MW"
     * "MODULO" -> extraia "MODULO" (apenas se a célula de tipo contiver literalmente "MODULO")
     * "GPS" -> extraia "GPS"
     * "TMA" -> extraia "TMA"
     * NUNCA troque "RRU" por "MODULO" e NUNCA troque "ODU" por "MW"! Copie fielmente o que estiver impresso na coluna de tipo.
   - A coluna "ALTURA" da tabela indica a cota de instalação na torre e deve ser mapeada para "rad_center" (ex: "50,0000" ou "59,0000" ou "60,0000").
   - A coluna "QUANT.": extraia a quantidade exata indicada na célula (ex: "06" -> "6", "02" -> "2", "01" -> "1").
   - A coluna "AZIMUTE (N.V.)":
     * Copie exatamente o valor numérico que antecede o "°" para antenas direcionais (ex: 100°, 280°, 275°, 77°, 96°, 283°). NUNCA assuma 0° para o setor Alpha quando houver outro valor na célula.
     * ATENÇÃO CRÍTICA (NÃO CONFUNDIR COM DIMENSÕES): Equipamentos como RRU, ODU, GPS e módulos NÃO possuem azimute e trazem hífen "-" na coluna AZIMUTE. NUNCA use a terceira dimensão (profundidade de 120, 84 ou 100 de "440 x 400 x 120" ou "151 x 151 x 84") no campo azimute! Se a coluna azimute trouxer "-", o azimute DEVE ser "-".
   - A coluna "DIMENSÕES (mm)":
     * Para equipamentos com 3 dimensões (ex: RF "1400 x 320 x 145", RRU "440 x 400 x 120", ODU "151 x 151 x 84", GPS "150 x 150 x 100"): preencha comprimento, largura e profundidade com cada medida respectiva.
     * REGRA CRÍTICA PARA ANTENAS MW (Micro-ondas / Parábola / Diâmetro único ex: "900" ou "600"):
       - O valor da dimensão/diâmetro DEVE OBRIGATORIAMENTE ser gravado no campo "profundidade" (ex: "900").
       - Os campos "comprimento" e "largura" DEVEM OBRIGATORIAMENTE ficar como "-".
       - NUNCA coloque o diâmetro ou dimensão da antena MW nos campos "comprimento" ou "largura".
   - As colunas de ÁREA DE EXPOSIÇÃO e ARRASTO:
     * "ÁREA DE EXPOSIÇÃO (m²)" -> campo "aev_sem_ca" (ex: "0.888", "0.172", "0.636"). CUIDADO para não confundir o dígito '0' com '6' (ex: copie "0.172" e NUNCA "6.17").
     * "ARRASTO" -> campo "ca" (ex: "1.2" ou "1.6").
     * "ÁREA DE EXPOSIÇÃO COM ARRASTO (m²)" -> campo "aev_com_ca" (ex: "1.065", "0.207", "1.018").
5. ÁREA DE INSTALAÇÃO DO GABINETE (BASE DE CONCRETO):
   - Procure na LEGENDA da Planta Civil/Planta Baixo/Radier (Página 2), o item de "BASE DE CONCRETO PARA EQUIPAMENTO" "PARA IMPLANTAÇÃO" ou "A INSTALAR".
   - Extraia a QUANTIDADE de bases (ex: "2") → campo "nx_base"
   - Extraia as DIMENSÕES de cada base EXATAMENTE como aparecem no PDF → campo "di_base"
   - IMPORTANTE:
     * Extraia APENAS a quantidade e as dimensões individuais
     * Mantenha a ordem das dimensões EXATAMENTE como aparece no PDF (não inverta)
     * O cálculo da área total será feito automaticamente
     REGRA DE EXCLUSÃO CRÍTICA: 
      - IGNORE completamente qualquer medida atrelada a "PROJEÇÃO DE BASE", "FUTURA EXPANSÃO" ou "EXPANSÃO"
      - IGNORE cotas de hastes ou barras de aterramento (comum apresentarem 2,00m / 2.00m).
      - IGNORE alturas de gradil, cercas ou afastamentos do muro/divisória (comum apresentarem 2,00m).
      - IGNORE recuos de segurança ou espaçamentos entre equipamentos.
 REGRA DE EXTRAÇÃO E FORMATO:
     * Verifique rigorosamente se os dígitos da imagem são "2,10" / "2.10" e não confunda "1" com "0".
     * A dimensão deve ser a área/superfície da base plana de concreto.
     * Retorne no formato [Comprimento x Largura] em metros com 2 casas decimais. Exemplo: "2,10x1,30".
    Exemplos:
     * "2X BASE DE CONCRETO PARA EQUIPAMENTO TIM 1P (1,00X1,00m)" → nx_base="2", di_base="1,00x1,00"
     * "1X BASE DE CONCRETO PARA EQUIPAMENTO (3,50X1,30m)" → nx_base="1", di_base="3,50x1,30"
     * "1X BASE DE CONCRETO (1,30x3,50m)" → nx_base="1", di_base="1,30x3,50" (mantenha a ordem do PDF)
6. RASTREABILIDADE: indique em qual página/item cada grupo de dados foi encontrado.
7. Se um dado NÃO existir no documento, use string vazia "" — NUNCA invente valores.`;

export const INSTRUCOES_BTS = INSTRUCOES_PADRAO;

export const INSTRUCOES_COLLO = `1. CARIMBO ("SITE:"):
   - Se houver rótulo explícito (ex: "WINITY: SELGRCOLLO1"), use o código da detentora/torreora = "site_id_detentor".
   - Se houver rótulo explícito (ex: "TIM: SZ-LGARK6"), use o código da operadora = "site_id_cliente".
   - Se vier sem rótulo (apenas duas linhas): primeira linha = "site_id_detentor", segunda linha = "site_id_cliente".
2. ALTURA DA EV (TORRE EXISTENTE):
   - Em projetos de COLLO (colocation/compartilhamento), a torre já existe fisicamente.
   - Procure a cota total no TOPO da torre na elevação/fachada (Folha 03 / Página 3), indicada por cota de nível (ex: "+40,00" ou "+50,00" ou cota total de altura). Use essa altura total (ex: "40" ou "50"). NUNCA confunda com a cota de instalação das antenas (ex: 33m). Se não encontrar, use "40".
3. LOCALIZAÇÃO E ENDEREÇO (Carimbo):
   - Isole no campo "endereco" APENAS o logradouro/rua/vicinal/estrada (ex: "RUA JOSÉ FRANCISCO DOS SANTOS, S/N"). NUNCA repita o bairro, cidade, UF ou CEP dentro do campo "endereco".
   - Extraia separadamente: "bairro" (ex: "COLÔNIA 13" ou "Zona Rural"), "cidade" (ex: "LAGARTO"), "uf" (sigla com 2 letras, ex: "SE"), "cep" (somente dígitos ou formato 00000-000) e COORDENADAS em graus decimais (ex: -10.986597 e -37.547600, sem símbolos ° ou letras N/S/E/W).
4. TABELA DE EQUIPAMENTOS (Página 3 / Folha 03):
   - REGRA CRÍTICA DE SELEÇÃO: Na Folha 03 aparecem duas tabelas: "CARREGAMENTO ANTENAS EXISTENTES" e "CARREGAMENTO TIM - À INSTALAR".
   - Extraia EXCLUSIVAMENTE os equipamentos da tabela "CARREGAMENTO TIM - À INSTALAR" (ou "CARREGAMENTO TIM A INSTALAR" / "PROJETADO").
   - IGNORE COMPLETAMENTE a tabela "CARREGAMENTO ANTENAS EXISTENTES" (antenas legadas ou de terceiros NÃO devem entrar).
    - Para cada linha da tabela "CARREGAMENTO TIM - À INSTALAR":
      * A coluna "TIPO DE ANTENA" (ou "TIPO"): extraia EXATAMENTE o texto literal da célula.
        - "RF" -> extraia "RF"
        - "RRU" -> extraia EXATAMENTE "RRU" (NUNCA troque por "MODULO"!)
        - "ODU" -> extraia EXATAMENTE "ODU" (NUNCA troque por "MW"!)
        - "MW" -> extraia EXATAMENTE "MW"
        - "MODULO" -> extraia "MODULO" (apenas se a célula trouxer literalmente "MODULO")
        - "GPS" -> extraia "GPS"
        - "TMA" -> extraia "TMA"
        - ATENÇÃO CRÍTICA: NUNCA troque "RRU" por "MODULO" e NUNCA troque "ODU" por "MW"! Copie fielmente o texto do cabeçalho "TIPO DE ANTENA".
      * A coluna "ALTURA": cota de instalação na torre (ex: "40,0000" ou "38,0000" ou "33,00") -> mapeie para "rad_center".
      * A coluna "QUANT.": extraia a quantidade exata indicada na célula (ex: "06" -> "6", "02" -> "2", "01" -> "1"). NUNCA ignore ou resuma a quantidade.
      * A coluna "AZIMUTE (N.V.)":
        - Para antenas direcionais com azimute (RF, MW), copie o valor com "°" (ex: "100°" -> "100", "280°" -> "280", "275°" -> "275", "77°" -> "77", "96°" -> "96", "283°" -> "283").
        - Quando os setores vierem agrupados na mesma linha (ex: "125°/230°/315°"), copie a sequência completa ("125/230/315").
        - ATENÇÃO CRÍTICA (NÃO CONFUNDIR COM DIMENSÕES): Equipamentos como RRU, ODU, GPS e módulos NÃO possuem azimute e trazem hífen "-" na coluna AZIMUTE. NUNCA copie a terceira dimensão (profundidade de 120, 84 ou 100 de "440 x 400 x 120" ou "151 x 151 x 84") para o campo "azimute"! Se a célula tiver "-", use "-".
      * A coluna "DIMENSÕES (mm)":
        - Para equipamentos com 3 medidas (ex: "1400 x 320 x 145", "440 x 400 x 120", "151 x 151 x 84", "150 x 150 x 100", "710 x 400 x 192"): preencha comprimento, largura e profundidade com cada valor respectivo.
        - Para antenas MW com diâmetro único (ex: "600", "900"): o diâmetro DEVE OBRIGATORIAMENTE ser gravado em "profundidade", mantendo "comprimento" e "largura" como "-".
     * Colunas ÁREA DE EXPOSIÇÃO e ARRASTO:
       - "ÁREA DE EXPOSIÇÃO (m²)" -> campo "aev_sem_ca" (ex: "0.852", "2.025", "0.605").
       - "ARRASTO" -> campo "ca" (ex: "1.2" ou "1.6").
       - "ÁREA DE EXPOSIÇÃO COM ARRASTO (m²)" -> campo "aev_com_ca" (ex: "1.022", "2.430", "0.726").
5. ÁREA DE INSTALAÇÃO DO GABINETE / SOLO:
   - Procure na LEGENDA da Planta Civil (Página 2 / Folha 02) o item de base de concreto para equipamentos TIM (ex: "1. BASE EM CONCRETO 1,0x1,0m PARA IMPLANTAÇÃO DO EQUIPAMENTO OPSS 1P - A INSTALAR").
   - Extraia a QUANTIDADE de bases (ex: "1") -> campo "nx_base"
   - Extraia as DIMENSÕES da base (ex: "1,00x1,00" ou "1,0x1,0") -> campo "di_base"
6. RASTREABILIDADE: indique em qual página/item cada grupo de dados foi encontrado.
7. Se um dado NÃO existir no documento, use string vazia "" — NUNCA invente valores.`;

export const CONFIG_PADRAO: ConfigAutomacao = {
  tipoProjeto: "bts",
  instrucoesBts: INSTRUCOES_BTS,
  instrucoesCollo: INSTRUCOES_COLLO,
  instrucoes: INSTRUCOES_BTS,
  mapeamento: mapeamentoPadrao(),
  linhaInicialEq: 23,
  aliasesColunas: aliasesPadrao(),
};

/* ------------------------------------------------------------------ */
/*  Persistência                                                       */
/* ------------------------------------------------------------------ */

export function carregarConfig(): ConfigAutomacao {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return CONFIG_PADRAO;
    const j = JSON.parse(raw);
    const mapCarregado =
      Array.isArray(j.mapeamento) && j.mapeamento.length > 0
        ? j.mapeamento
            .filter((m: any) => m && typeof m.celula === "string")
            .map((m: any) => ({
              id: String(m.id ?? novoId()),
              campo: String(m.campo ?? "").trim(),
              celula: String(m.celula).trim().toUpperCase(),
              br: !!m.br,
              valorFixo: typeof m.valorFixo === "string" ? m.valorFixo : undefined,
              transformacao: typeof m.transformacao === "string" ? m.transformacao : undefined,
            }))
        : mapeamentoPadrao();

    // Garante que as regras de D6, D7, AEV e E49 existam mesmo para quem já tinha config salva no navegador
    const regrasMigracao: { celula: string; campo?: string; transformacao?: string }[] = [
      { celula: "D6", campo: "data_emissao" },
      { celula: "D7", campo: "data_rfi" },
      { celula: "E49", transformacao: "multiplicacao_base" },
      { celula: "G37", transformacao: "aev_total_sem_ca" },
      { celula: "K37", transformacao: "aev_total_com_ca" },
      { celula: "G38", transformacao: "aev_reserva_sem_ca" },
      { celula: "K38", transformacao: "aev_reserva_com_ca" },
      { celula: "G39", transformacao: "aev_instalar_sem_ca" },
      { celula: "K39", transformacao: "aev_instalar_com_ca" },
      { celula: "G42", transformacao: "aev_final_sem_ca" },
      { celula: "K42", transformacao: "aev_final_com_ca" },
    ];
    regrasMigracao.forEach((regra) => {
      if (!mapCarregado.some((m: any) => m.celula === regra.celula)) {
        mapCarregado.push({
          id: novoId(),
          campo: regra.campo ?? "",
          celula: regra.celula,
          transformacao: regra.transformacao,
        });
      }
    });

    const tipoProjeto: TipoProjeto = j.tipoProjeto === "collo" ? "collo" : "bts";

    let instrucoesBts = typeof j.instrucoesBts === "string" && j.instrucoesBts.trim() ? j.instrucoesBts : "";
    if (
      !instrucoesBts ||
      !instrucoesBts.includes("fidelidade óptica rigorosa") ||
      instrucoesBts.includes("RRU será tratado como MODULO") ||
      instrucoesBts.includes('onde constar "MODULO", extraia "MODULO"') ||
      !instrucoesBts.includes('NUNCA troque "RRU" por "MODULO"')
    ) {
      instrucoesBts = INSTRUCOES_BTS;
    }

    let instrucoesCollo = typeof j.instrucoesCollo === "string" && j.instrucoesCollo.trim()
      ? j.instrucoesCollo
      : INSTRUCOES_COLLO;
    if (
      !instrucoesCollo ||
      instrucoesCollo.includes("RRU será tratado como MODULO") ||
      instrucoesCollo.includes('onde constar "MODULO", extraia "MODULO"') ||
      !instrucoesCollo.includes('NUNCA troque "RRU" por "MODULO"')
    ) {
      instrucoesCollo = INSTRUCOES_COLLO;
    }

    const instrucoesAtivas = tipoProjeto === "collo" ? instrucoesCollo : instrucoesBts;

    let aliasesCarregados =
      Array.isArray(j.aliasesColunas) && j.aliasesColunas.length > 0
        ? j.aliasesColunas.map((a: any) => ({
            id: String(a.id ?? novoId()),
            campoSistema: String(a.campoSistema ?? "").trim(),
            aliasPdf: String(a.aliasPdf ?? "").trim(),
          }))
        : aliasesPadrao();

    // Remove aliases legados conflitantes onde "DIMENSÕES" foi mapeado para colunas individuais
    aliasesCarregados = aliasesCarregados.filter((a: any) => {
      const aliasNorm = (a?.aliasPdf ?? "").toUpperCase().trim();
      return !aliasNorm.startsWith("DIMENS");
    });

    // Garante que aliases essenciais de tipo estejam sempre presentes
    const temAlias = (nome: string) => aliasesCarregados.some((a: any) => a.aliasPdf.toUpperCase() === nome.toUpperCase());
    if (!temAlias("TIPO ANTENA")) {
      aliasesCarregados.push({ id: novoId(), campoSistema: "tipo_equipamento", aliasPdf: "TIPO ANTENA" });
    }
    if (!temAlias("TIPO DE EQUIPAMENTO")) {
      aliasesCarregados.push({ id: novoId(), campoSistema: "tipo_equipamento", aliasPdf: "TIPO DE EQUIPAMENTO" });
    }
    if (!temAlias("TIPO EQUIPAMENTO")) {
      aliasesCarregados.push({ id: novoId(), campoSistema: "tipo_equipamento", aliasPdf: "TIPO EQUIPAMENTO" });
    }

    return {
      tipoProjeto,
      instrucoesBts,
      instrucoesCollo,
      instrucoes: instrucoesAtivas,
      mapeamento: mapCarregado,
      linhaInicialEq: Number(j.linhaInicialEq) > 0 ? Number(j.linhaInicialEq) : 23,
      aliasesColunas: aliasesCarregados,
    };
  } catch {
    return CONFIG_PADRAO;
  }
}

export function salvarConfig(cfg: ConfigAutomacao): void {
  try {
    const tipo = cfg.tipoProjeto ?? "bts";
    const cfgParaSalvar: ConfigAutomacao = {
      ...cfg,
      tipoProjeto: tipo,
      instrucoesBts: cfg.instrucoesBts || INSTRUCOES_BTS,
      instrucoesCollo: cfg.instrucoesCollo || INSTRUCOES_COLLO,
      instrucoes: tipo === "collo" ? (cfg.instrucoesCollo || INSTRUCOES_COLLO) : (cfg.instrucoesBts || INSTRUCOES_BTS),
    };
    localStorage.setItem(LS_KEY, JSON.stringify(cfgParaSalvar));
  } catch {
    /* quota cheia — ignora */
  }
}

export function resetarConfig(): ConfigAutomacao {
  const c: ConfigAutomacao = {
    tipoProjeto: "bts",
    instrucoesBts: INSTRUCOES_BTS,
    instrucoesCollo: INSTRUCOES_COLLO,
    instrucoes: INSTRUCOES_BTS,
    mapeamento: mapeamentoPadrao(),
    linhaInicialEq: 23,
    aliasesColunas: aliasesPadrao(),
  };
  salvarConfig(c);
  return c;
}

/* ------------------------------------------------------------------ */
/*  Montagem do prompt final                                           */
/* ------------------------------------------------------------------ */

/**
 * Monta o prompt completo enviado ao Gemini a partir da configuração do
 * usuário e do tipo de projeto ativo (BTS ou COLLO).
 */
export function montarPromptFinal(cfg: ConfigAutomacao, tipoProjeto?: TipoProjeto): string {
  const tipo = tipoProjeto ?? cfg.tipoProjeto ?? "bts";
  const camposDoSchema: string[] = [];

  // Coletar apenas os campos que precisam ser extraídos (sem células)
  cfg.mapeamento.forEach((m) => {
    const campo = m.campo.trim();
    if (m.valorFixo !== undefined && m.valorFixo !== "") {
      return; // Não precisa extrair valores fixos
    }
    if (!campo) return;
    if (!camposDoSchema.includes(campo)) camposDoSchema.push(campo);
  });

  // Garantir que nx_base e di_base estejam sempre no schema para cálculo de área
  if (!camposDoSchema.includes("nx_base")) {
    camposDoSchema.push("nx_base");
  }
  if (!camposDoSchema.includes("di_base")) {
    camposDoSchema.push("di_base");
  }

  const schemaCampos = camposDoSchema.map((c) => `  "${c}": "",`).join("\n");

  const instrucoesAtivas = tipo === "collo"
    ? (cfg.instrucoesCollo?.trim() || INSTRUCOES_COLLO)
    : (cfg.instrucoesBts?.trim() || cfg.instrucoes?.trim() || INSTRUCOES_BTS);

  const tituloTabelaEquip = tipo === "collo"
    ? 'TABELA DE EQUIPAMENTOS (Página 3 - "CARREGAMENTO TIM - À INSTALAR"):'
    : 'TABELA DE EQUIPAMENTOS (Página 3 - "CARREGAMENTO ANTENAS TIM A INSTALAR"):';

  const detalheTabelaEquip = tipo === "collo"
    ? `extraia um objeto por equipamento com os valores brutos da tabela de carregamento da TIM.
IMPORTANTE: Extraia APENAS os equipamentos da tabela "CARREGAMENTO TIM - À INSTALAR" e IGNORE completamente a tabela de equipamentos existentes.
- AZIMUTE: se os setores vierem agrupados na mesma linha (ex: "125°/230°/315°"), copie a sequência ("125/230/315"). Mantenha a linha agrupada com sua respectiva QUANT.
- DIMENSÕES: para antenas de 3 dimensões (ex: "710 x 400 x 192"), preencha comprimento, largura e profundidade com cada medida. Para antenas MW com diâmetro único (ex: "600"), coloque o diâmetro OBRIGATORIAMENTE em "profundidade", e coloque "-" em "comprimento" e "largura".
- AEV: copie os valores decimais com atenção redobrada aos dígitos (ex: "0.852", "2.025", "0.605").`
    : `extraia um objeto por equipamento com os valores brutos da tabela de carregamento.
- AZIMUTE: copie rigorosamente o valor que antecede o "°" na coluna AZIMUTE (ex: "160" e NUNCA "0" quando a célula indicar 160°; "220"; "340"). Se estiver "-" use "-".
- DIMENSÕES: para antenas celulares de 3 dimensões (ex: "2500 x 355 x 192"), preencha comprimento, largura e profundidade com cada medida. Para antenas MW com diâmetro único (ex: "900" ou "600"), coloque o diâmetro OBRIGATORIAMENTE em "profundidade", e coloque "-" em "comprimento" e "largura".
- AEV: copie os valores decimais com atenção redobrada aos dígitos (ex: "0.172" e NUNCA "6.17").`;

  return `Você é um engenheiro de telecomunicações sênior analisando este Projeto Executivo (PPI) em PDF do tipo ${tipo.toUpperCase()} (${tipo === "collo" ? "Compartilhamento / Colocation" : "Site Novo / Greenfield"}).
Extraia os dados técnicos com base no carimbo, desenhos, legendas e tabelas (foco nas páginas 1, 2 e 3).

INSTRUÇÕES DE EXTRAÇÃO (${tipo.toUpperCase()}):
${instrucoesAtivas}

CAMPOS A EXTRAIR:
${camposDoSchema.map((c) => `- ${c}`).join("\n")}

${tituloTabelaEquip} ${detalheTabelaEquip}
Não faça conversões manuais de unidades — a aplicação fará a normalização, decomposição e conversão de mm para metros automaticamente.

REGRAS FINAIS:
1. Se um dado NÃO existir no documento, use string vazia "" — NUNCA invente valores.
2. Responda APENAS com o JSON abaixo. SEM crases, SEM bloco \`\`\`json, SEM texto antes ou depois.

FORMATO EXATO DA RESPOSTA:
{
${schemaCampos || '  "site_id_cliente": "",'}
  "rastreabilidade": {
    "origem_site_id": "Páginas 1, 2 e 3 — carimbo SITE",
    "origem_altura_torre": "${tipo === "collo" ? "Página 3 cota do topo da elevação da torre" : "Página 2 item 03 e Página 3 elevação"}",
    "origem_equipamentos": "${tipo === "collo" ? "Página 3 — tabela CARREGAMENTO TIM - À INSTALAR" : "Página 3 — tabela de carregamento"}",
    "base_em_concreto":   "Página 2 e 9 — LEGENDA da Planta Civil/Planta Baixo/Radier"
  },
  "equipamentos": [
    {
      "tipo_equipamento": "",
      "modelo": "",
      "qtde": "",
      "azimute": "",
      "comprimento": "",
      "largura": "",
      "profundidade": "",
      "rad_center": "",
      "aev_sem_ca": "",
      "ca": "",
      "aev_com_ca": ""
    }
  ]
}`;
}

/** Problemas de configuração que merecem aviso (não bloqueiam). */
export function validarConfig(cfg: ConfigAutomacao): string[] {
  const avisos: string[] = [];
  cfg.mapeamento.forEach((m, i) => {
    const cel = m.celula.trim();
    if (!CELULA_RE.test(cel)) avisos.push(`Regra #${i + 1}: célula "${cel || "(vazia)"}" é inválida — use o formato A1, B12, AA3…`);
    const temFixo = m.valorFixo !== undefined && m.valorFixo !== "";
    if (!temFixo && !m.transformacao && m.campo && !CAMPO_RE.test(m.campo)) {
      avisos.push(`Regra #${i + 1}: campo "${m.campo}" deve ser minúsculo com underline (ex: tipo_torre) para bater com o JSON.`);
    }
    if (!temFixo && !m.campo && !m.transformacao) avisos.push(`Regra #${i + 1}: sem campo e sem valor fixo — não grava nada em ${cel}.`);
  });
  if (!(cfg.linhaInicialEq >= 1)) avisos.push("Linha inicial da tabela de equipamentos deve ser ≥ 1.");
  return avisos;
}
