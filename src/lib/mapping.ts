import type { AliasColuna, CampoMapeamento, ConfigAutomacao, TipoProjeto } from "../types";

/* ------------------------------------------------------------------ */
/*  Mapa de células — antes vivia hardcoded em src/lib/excel.ts.       */
/*  Agora é configurável pelo usuário (página Configuração) e          */
/*  persistido no localStorage do navegador.                           */
/* ------------------------------------------------------------------ */

const LS_KEY = "nddforge.automacao.v1";

/** Dicas de extração dos campos padrão — entram no prompt montado. */
export const DESCRICOES_CAMPOS: Record<string, string> = {
  site_id_cliente: '2ª linha do carimbo "SITE:" (ex: SN-XXXXX0)',
  site_id_detentor: '1ª linha do carimbo "SITE:" (ex: XXXXX000_A)',
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
    { id: novoId(), campoSistema: "trecho_citado_do_pdf", aliasPdf: "TRECHO CITADO" },
    { id: novoId(), campoSistema: "trecho_citado_do_pdf", aliasPdf: "TRECHO ORIGINAL" },
    { id: novoId(), campoSistema: "trecho_citado_do_pdf", aliasPdf: "CITAÇÃO" },
    { id: novoId(), campoSistema: "trecho_citado_do_pdf", aliasPdf: "CITACAO" },
    { id: novoId(), campoSistema: "pagina", aliasPdf: "PÁGINA" },
    { id: novoId(), campoSistema: "pagina", aliasPdf: "PAGINA" },
    { id: novoId(), campoSistema: "pagina", aliasPdf: "FOLHA" },
  ];
}

/**
 * Prompt BTS (v1, 14/10/2026): prompt COMPLETO, enviado como está (ver montarPromptFinal).
 * Escolhido no teste de 14/10 (8 PPIs + 4 PPIs x 2 execuções): menos erros de valor que o anterior
 * (5 x 15 sem contar IDs). Os exemplos são FICTÍCIOS de propósito: IDs reais em exemplo eram copiados
 * pela IA para a resposta (os dois IDs de exemplo do prompt antigo). Detalhes: teste_prompt_gemini\README.md.
 * O prompt anterior está em backup_prompt_v1_2026-10-14/mapping.ts.
 */
export const MARCADOR_PROMPT_BTS_COMPLETO = "MÉTODO ANTI-ALUCINAÇÃO (CITAÇÃO OBRIGATÓRIA)";

export const INSTRUCOES_PADRAO = `Você é um engenheiro de telecomunicações sênior analisando este Projeto Executivo (PPI) em PDF do tipo BTS (Site Novo / Greenfield).
Extraia os dados técnicos com fidelidade óptica rigorosa a partir do carimbo, desenhos, legendas e tabelas (foco nas páginas 1, 2 e 3).
Não deduza, não invente e não complete valores que não existam explicitamente no documento. Se não encontrar, use string vazia "".

MÉTODO ANTI-ALUCINAÇÃO (CITAÇÃO OBRIGATÓRIA):
Para cada grupo de informações, primeiro copie a linha literal do documento no campo de citação correspondente; os valores extraídos devem derivar exclusivamente dessa citação:
1. "trecho_citado_localizacao" (Página 1): copie a linha literal completa de endereço e coordenadas impressa no carimbo do PDF.
2. "trecho_citado_base" (Página 2): copie a linha literal da legenda na Planta Civil/Radier que comprova a base de concreto a implantar.
3. "trecho_citado_do_pdf" (Página 3): para CADA equipamento, copie a linha literal completa da tabela de carregamento. Se a linha não existir na tabela, NÃO crie o equipamento.

REGRAS DE EXTRAÇÃO DE CAMPOS:

1. CARIMBO DO SITE ("SITE:"):
   - O campo "SITE:" traz dois códigos: o da detentora (Winity) e o da operadora (TIM). Eles podem vir em duas linhas (1ª = detentora, 2ª = operadora) ou numa linha só, um seguido do outro (ex: "XXXXX000_A_SN-XXXXX0").
   - "site_id_detentor": SOMENTE o código da detentora/Winity: 5 letras + 3 dígitos, mais a letra do candidato quando houver (ex: XXXXX000_A).
   - "site_id_cliente": SOMENTE o código da operadora (ex: SN-XXXXX0).
   - Nunca coloque os dois códigos no mesmo campo. Copie letra por letra (não confunda O com 0, I com 1, S com 5).

2. LOCALIZAÇÃO E ENDEREÇO (Carimbo):
   - "endereco": extraia APENAS o logradouro (rua, avenida ou rodovia). Em rodovias, o quilômetro e complemento fazem parte obrigatória do logradouro (ex: "BR-000 Km 000+000"). NUNCA corte o Km e NUNCA repita o bairro, cidade ou CEP neste campo.
   - "bairro": extraia EXCLUSIVAMENTE o nome do bairro ou localidade (ex: "Vila Exemplo" ou "Zona Rural"). REGRA CRÍTICA: NUNCA aglutine nem coloque o nome do município/cidade dentro do campo bairro (se o carimbo estiver "VILA EXEMPLO - CIDADE EXEMPLO", o bairro é APENAS "Vila Exemplo").
   - "cidade": nome do município (ex: "Cidade Exemplo").
   - "uf": sigla do estado com 2 letras (ex: "MS").
   - "cep": formato 00000-000.
   - "latitude" e "longitude": copie EXATAMENTE como impressas no carimbo, com sinal, graus, minutos, segundos e letra (ex: -12°34'56.78"S ou -12.345678). NÃO converta: o sistema converte para grau decimal.

3. ALTURA DA EV (TORRE):
   - "altura_ev": altura total da torre indicada na cota do topo da elevação ou item da legenda (ex: "40" ou "60").

4. BASE DE CONCRETO (Planta Civil - Página 2):
   - "nx_base": quantidade literal de bases a implantar (ex: se constar "2X BASE...", extraia "2"; se constar "1X...", extraia "1").
   - "di_base": dimensões da base no formato "1,00x1,00" (sem "m", sem multiplicar as medidas pela quantidade).
   - Se não houver base a implantar na legenda civil, deixe "nx_base": "", "di_base": "" e "trecho_citado_base": "".

5. TABELA DE EQUIPAMENTOS (Página 3 - "CARREGAMENTO ANTENAS TIM A INSTALAR"):
   - Extraia exatamente um objeto por linha real da tabela.
   - "tipo_equipamento": texto literal da coluna TIPO (RF, RRU, MW, ODU, GPS, MODULO). NUNCA troque RRU por MODULO e NUNCA troque ODU por MW.
   - "modelo": modelo exato impresso na célula.
   - "qtde": quantidade numérica sem zero à esquerda ("01" -> "1", "04" -> "4").
   - "azimute": número antes do "°" para antenas direcionais. Para equipamentos sem azimute (RRU, ODU, GPS, Módulo), use OBRIGATORIAMENTE "-".
   - "comprimento", "largura" e "profundidade":
     * Equipamentos com 3 dimensões (ex: "1400 x 320 x 145", "440 x 400 x 120"): preencha cada respectivo campo.
     * REGRA CRÍTICA PARA EQUIPAMENTOS COM 2 DIMENSÕES (ex: GPS AYGE "146 x 78" ou "78 x 146"): preencha "comprimento" e "largura", deixando a "profundidade" OBRIGATORIAMENTE como "-". NUNCA duplique ou deduza uma terceira medida.
     * Antenas MW com diâmetro único (ex: "600" ou "900"): grave o valor em "profundidade", mantendo "comprimento": "-" e "largura": "-".
   - "rad_center": cota de instalação na torre (coluna ALTURA).
   - "aev_sem_ca": valor da coluna ÁREA DE EXPOSIÇÃO (m²).
   - "ca": valor da coluna ARRASTO.
   - "aev_com_ca": valor da coluna ÁREA DE EXPOSIÇÃO COM ARRASTO (m²).

FORMATO EXATO DA RESPOSTA:
{
  "site_id_cliente": "",
  "site_id_detentor": "",
  "data_rfi": "",
  "data_emissao": "",
  "endereco": "",
  "bairro": "",
  "cidade": "",
  "cep": "",
  "uf": "",
  "latitude": "",
  "longitude": "",
  "altura_ev": "",
  "nx_base": "",
  "di_base": "",
  "trecho_citado_localizacao": "",
  "pagina_localizacao": 1,
  "trecho_citado_base": "",
  "pagina_base": 2,
  "rastreabilidade": {
    "origem_site_id": "",
    "origem_altura_torre": "",
    "origem_equipamentos": "",
    "base_em_concreto": ""
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
      "aev_com_ca": "",
      "trecho_citado_do_pdf": "",
      "pagina": 3
    }
  ]
}`;

export const INSTRUCOES_BTS = INSTRUCOES_PADRAO;

export const INSTRUCOES_COLLO = `1. CARIMBO ("SITE:"):
   - Se houver rótulo explícito (ex: "WINITY: SELGRCOLLO1"), use o código da detentora/torreora = "site_id_detentor".
   - Se houver rótulo explícito (ex: "TIM: SZ-LGARK6"), use o código da operadora = "site_id_cliente".
   - Se vier sem rótulo (apenas duas linhas): primeira linha = "site_id_detentor", segunda linha = "site_id_cliente".
2. ALTURA DA EV (TORRE EXISTENTE):
   - Em projetos de COLLO (colocation/compartilhamento), a torre já existe fisicamente.
   - Procure a cota total no TOPO da torre na elevação/fachada (Folha 03 / Página 3), indicada por cota de nível (ex: "+40,00" ou "+50,00" ou cota total de altura). Use essa altura total (ex: "40" ou "50"). NUNCA confunda com a cota de instalação das antenas (ex: 33m). Se não encontrar, use "40".
3. LOCALIZAÇÃO E ENDEREÇO (Carimbo):
   - REGRA ANTI-ALUCINAÇÃO (LOCALIZAÇÃO): Copie OBRIGATORIAMENTE no campo "trecho_citado_localizacao" a linha literal completa de endereço e coordenadas impressa no carimbo do PDF e informe a "pagina_localizacao" (geralmente página 1).
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
   - Procure na LEGENDA da Planta Civil (Página 2 / Folha 02) o item de base de concreto para equipamentos TIM (ex: "1. BASE EM CONCRETO 1,0x1,0m PARA IMPLANTAÇÃO DO EQUIPAMENTO OPSS 1P - A INSTALAR" ou "2X BASE DE CONCRETO (1,00X1,00m)").
   - REGRA ANTI-ALUCINAÇÃO (BASE DE CONCRETO): Copie OBRIGATORIAMENTE no campo "trecho_citado_base" a linha literal da legenda civil que comprova a base a implantar e informe a "pagina_base" (geralmente página 2). Se não houver item de base na legenda civil, deixe "trecho_citado_base": "", "nx_base": "" e "di_base": "".
   - Extraia as DIMENSÕES da base EXATAMENTE como aparecem no PDF (ex: "1,00x1,00" ou "1,0x1,0") -> campo "di_base". Pegue apenas o que estiver no documento, ignorando o "2x" ou quantidade (NUNCA multiplique as dimensões).
   - Extraia a QUANTIDADE de bases se indicada (ex: "1" ou "2") -> campo "nx_base".
6. TÉCNICA DE CITAÇÃO OBRIGATÓRIA (ANTI-ALUCINAÇÃO):
   - EQUIPAMENTOS: copie a linha literal no campo "trecho_citado_do_pdf" e "pagina": 3. Itens sem comprovação serão descartados.
   - LOCALIZAÇÃO: copie a linha literal do carimbo no campo "trecho_citado_localizacao" e "pagina_localizacao": 1. NUNCA invente logradouros ou coordenadas.
   - BASE DE CONCRETO: copie a legenda literal no campo "trecho_citado_base" e "pagina_base": 2. Se não houver base a implantar, deixe vazio.
7. RASTREABILIDADE: indique em qual página/item cada grupo de dados foi encontrado.
8. Se um dado NÃO existir no documento, use string vazia "" — NUNCA invente valores.`;

export const CONFIG_PADRAO: ConfigAutomacao = {
  tipoProjeto: "bts",
  usarSchema: false,
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
    // Prompt BTS antigo (só instruções, sem o formato da resposta) é trocado pelo prompt completo atual;
    // um prompt completo editado pelo usuário (tem o marcador) é mantido.
    if (!instrucoesBts || !instrucoesBts.includes(MARCADOR_PROMPT_BTS_COMPLETO)) {
      instrucoesBts = INSTRUCOES_BTS;
    }

    let instrucoesCollo = typeof j.instrucoesCollo === "string" && j.instrucoesCollo.trim()
      ? j.instrucoesCollo
      : INSTRUCOES_COLLO;
    if (
      !instrucoesCollo ||
      instrucoesCollo.includes("RRU será tratado como MODULO") ||
      instrucoesCollo.includes('onde constar "MODULO", extraia "MODULO"') ||
      !instrucoesCollo.includes('NUNCA troque "RRU" por "MODULO"') ||
      !instrucoesCollo.includes("Pegue apenas o que estiver no documento")
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
      usarSchema: j.usarSchema === true,
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
    usarSchema: false,
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
/** Campos simples que a IA deve extrair: os do mapa de células (sem valor fixo) + nx_base/di_base. */
function camposExtraidos(cfg: ConfigAutomacao): string[] {
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
  return camposDoSchema;
}

/**
 * Monta o responseSchema do Gemini (modo "Schema") a partir do mesmo mapa que gera o prompt
 * (prompt e schema nunca ficam dessincronizados).
 * A ordem das propriedades (propertyOrdering) faz a IA escrever a citação literal
 * ANTES dos valores: carimbo antes do endereço, legenda antes da base, linha da tabela antes do equipamento.
 */
export function montarSchemaResposta(cfg: ConfigAutomacao): Record<string, unknown> {
  const texto = { type: "STRING" };
  const inteiro = { type: "INTEGER" };
  const camposBase = ["nx_base", "di_base"];
  const campos = camposExtraidos(cfg).filter((c) => !camposBase.includes(c));

  const camposEquipamento = [
    "trecho_citado_do_pdf", "pagina", "tipo_equipamento", "modelo", "qtde", "azimute",
    "comprimento", "largura", "profundidade", "rad_center", "aev_sem_ca", "ca", "aev_com_ca",
  ];
  const propsEquipamento: Record<string, unknown> = {};
  camposEquipamento.forEach((c) => { propsEquipamento[c] = c === "pagina" ? inteiro : texto; });

  const camposRastreabilidade = ["origem_site_id", "origem_altura_torre", "origem_equipamentos", "base_em_concreto"];
  const propsRastreabilidade: Record<string, unknown> = {};
  camposRastreabilidade.forEach((c) => { propsRastreabilidade[c] = texto; });

  const properties: Record<string, unknown> = {
    trecho_citado_localizacao: texto,
    pagina_localizacao: inteiro,
  };
  campos.forEach((c) => { properties[c] = texto; });
  properties.trecho_citado_base = texto;
  properties.pagina_base = inteiro;
  properties.nx_base = texto;
  properties.di_base = texto;
  properties.rastreabilidade = {
    type: "OBJECT",
    properties: propsRastreabilidade,
    required: camposRastreabilidade,
    propertyOrdering: camposRastreabilidade,
  };
  properties.equipamentos = {
    type: "ARRAY",
    items: {
      type: "OBJECT",
      properties: propsEquipamento,
      required: camposEquipamento,
      propertyOrdering: camposEquipamento,
    },
  };

  const ordem = Object.keys(properties);
  return { type: "OBJECT", properties, required: ordem, propertyOrdering: ordem };
}

/** Campos simples que o prompt BTS completo já pede (o resto do mapa entra como "CAMPOS ADICIONAIS"). */
const CAMPOS_PROMPT_BTS = [
  "site_id_cliente", "site_id_detentor", "data_rfi", "data_emissao", "endereco", "bairro", "cidade",
  "cep", "uf", "latitude", "longitude", "altura_ev", "nx_base", "di_base",
];

export function montarPromptFinal(cfg: ConfigAutomacao, tipoProjeto?: TipoProjeto): string {
  const tipo = tipoProjeto ?? cfg.tipoProjeto ?? "bts";
  const camposDoSchema = camposExtraidos(cfg);

  const schemaCampos = camposDoSchema.map((c) => `  "${c}": "",`).join("\n");

  const instrucoesAtivas = tipo === "collo"
    ? (cfg.instrucoesCollo?.trim() || INSTRUCOES_COLLO)
    : (cfg.instrucoesBts?.trim() || cfg.instrucoes?.trim() || INSTRUCOES_BTS);

  // BTS: o prompt completo (com o formato da resposta) vai exatamente como foi testado.
  // Campos criados pelo usuário no mapa de células são acrescentados no fim.
  if (tipo !== "collo" && instrucoesAtivas.includes(MARCADOR_PROMPT_BTS_COMPLETO)) {
    const extras = camposExtraidos(cfg).filter((c) => !CAMPOS_PROMPT_BTS.includes(c));
    if (extras.length === 0) return instrucoesAtivas;
    return `${instrucoesAtivas}\n\nCAMPOS ADICIONAIS (inclua também no JSON, no nível principal, como string; "" se não existir no documento):\n`
      + extras.map((c) => `- "${c}": ${DESCRICOES_CAMPOS[c] ?? "extraia do documento"}`).join("\n");
  }

  const tituloTabelaEquip = tipo === "collo"
    ? 'TABELA DE EQUIPAMENTOS (Página 3 - "CARREGAMENTO TIM - À INSTALAR"):'
    : 'TABELA DE EQUIPAMENTOS (Página 3 - "CARREGAMENTO ANTENAS TIM A INSTALAR"):';

  const detalheTabelaEquip = tipo === "collo"
    ? `extraia um objeto por equipamento com os valores brutos da tabela de carregamento da TIM.
IMPORTANTE: Extraia APENAS os equipamentos da tabela "CARREGAMENTO TIM - À INSTALAR" e IGNORE completamente a tabela de equipamentos existentes.
- AZIMUTE: se os setores vierem agrupados na mesma linha (ex: "125°/230°/315°"), copie a sequência ("125/230/315"). Mantenha a linha agrupada com sua respectiva QUANT.
- DIMENSÕES: para antenas de 3 dimensões, preencha comprimento, largura e profundidade. Para equipamentos com apenas 2 dimensões (ex: GPS "146 x 78"), extraia apenas comprimento e largura, mantendo a profundidade "-". Para antenas MW com diâmetro único (ex: "600"), coloque o diâmetro OBRIGATORIAMENTE em "profundidade", e coloque "-" em "comprimento" e "largura".
- AEV: copie os valores decimais com atenção redobrada aos dígitos (ex: "0.852", "2.025", "0.605").`
    : `extraia um objeto por equipamento com os valores brutos da tabela de carregamento.
- AZIMUTE: copie rigorosamente o valor que antecede o "°" na coluna AZIMUTE (ex: "160" e NUNCA "0" quando a célula indicar 160°; "220"; "340"). Se estiver "-" use "-".
- DIMENSÕES: para antenas celulares de 3 dimensões, preencha comprimento, largura e profundidade. Para equipamentos com apenas 2 dimensões (ex: GPS "146 x 78"), extraia apenas comprimento e largura, mantendo a profundidade "-". Para antenas MW com diâmetro único (ex: "900" ou "600"), coloque o diâmetro OBRIGATORIAMENTE em "profundidade", e coloque "-" em "comprimento" e "largura".
- AEV: copie os valores decimais com atenção redobrada aos dígitos (ex: "0.172" e NUNCA "6.17").`;

  return `Você é um engenheiro de telecomunicações sênior analisando este Projeto Executivo (PPI) em PDF do tipo ${tipo.toUpperCase()} (${tipo === "collo" ? "Compartilhamento / Colocation" : "Site Novo / Greenfield"}).
Extraia os dados técnicos com base no carimbo, desenhos, legendas e tabelas (foco nas páginas 1, 2 e 3).

INSTRUÇÕES DE EXTRAÇÃO (${tipo.toUpperCase()}):
${instrucoesAtivas}

CAMPOS A EXTRAIR:
${camposDoSchema.map((c) => `- ${c}`).join("\n")}

${tituloTabelaEquip} ${detalheTabelaEquip}
Não faça conversões manuais de unidades — a aplicação fará a normalização, decomposição e conversão de mm para metros automaticamente.

TÉCNICA DA CITAÇÃO OBRIGATÓRIA (ANTI-ALUCINAÇÃO):
1. EQUIPAMENTOS:
- Para CADA equipamento listado, copie OBRIGATORIAMENTE no campo "trecho_citado_do_pdf" a linha ou trecho literal impresso na tabela do PDF que comprova sua existência física (ex: "RF | APXVLL199014-C-A20 | 06 | 100° | 1400 x 320 x 145 | ...") e indique a "pagina" (geralmente página 3).
- REGRA ANTI-ALUCINAÇÃO CRÍTICA: Se não houver uma linha real na tabela do PDF comprovando o equipamento, NÃO o inclua. Equipamentos sem citação exata serão descartados automaticamente pelo sistema.

2. LOCALIZAÇÃO E ENDEREÇO (Carimbo):
- Copie OBRIGATORIAMENTE no campo "trecho_citado_localizacao" a linha literal completa de endereço e coordenadas impressa no carimbo do PDF (ex: "VC CAFÉ DO POVO - CRISTO VIVO - BREU BRANCO - PA CEP:68695-000 | COORD: -3.413902, -49.042893") e indique a "pagina_localizacao" (geralmente 1).
- NUNCA invente logradouros, bairros ou coordenadas.

3. BASE DE CONCRETO (Planta Civil/Radier):
- Copie OBRIGATORIAMENTE no campo "trecho_citado_base" a linha literal da legenda na Folha 02 / Planta Civil (ex: "1. BASE EM CONCRETO 1,0x1,0m PARA IMPLANTAÇÃO DO EQUIPAMENTO OPSS 1P - A INSTALAR" ou "2X BASE DE CONCRETO (1,00X1,00m)") e indique a "pagina_base" (geralmente 2).
- Se o projeto NÃO possuir base de concreto ou a legenda civil não contiver item de base a implantar, deixe "trecho_citado_base": "", "nx_base": "" e "di_base": "".
- NUNCA confunda cotas de aterramento (2,00m), gradil ou expansão com base de concreto. O sistema descartará a base se o trecho citado não contiver comprovação real de base em concreto.

REGRAS FINAIS:
1. Se um dado NÃO existir no documento, use string vazia "" — NUNCA invente valores.
2. Em "rastreabilidade", escreva a página e o item/tabela onde VOCÊ encontrou cada grupo de dados NESTE PDF (ex: "Pág. 1 — carimbo SITE"). Se não encontrou, deixe "".
3. ENDEREÇO EM RODOVIA/ESTRADA: o quilômetro faz parte do logradouro. Copie em "endereco" a rodovia COM o km e o complemento exatamente como no carimbo (ex: "BR-000 Km 00+000", "SP-000 Km 00,5"). NUNCA corte o "Km" deixando só o nome da rodovia.
4. Responda APENAS com o JSON abaixo. SEM crases, SEM bloco \`\`\`json, SEM texto antes ou depois.

FORMATO EXATO DA RESPOSTA:
{
${schemaCampos || '  "site_id_cliente": "",'}
  "trecho_citado_localizacao": "",
  "pagina_localizacao": 1,
  "trecho_citado_base": "",
  "pagina_base": 2,
  "rastreabilidade": {
    "origem_site_id": "",
    "origem_altura_torre": "",
    "origem_equipamentos": "",
    "base_em_concreto": ""
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
      "aev_com_ca": "",
      "trecho_citado_do_pdf": "",
      "pagina": 3
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
