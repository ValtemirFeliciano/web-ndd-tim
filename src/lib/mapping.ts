import type { AliasColuna, CampoMapeamento, ConfigAutomacao } from "../types";

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
    { id: novoId(), campo: "latitude", celula: "C11" },
    { id: novoId(), campo: "longitude", celula: "J11" },
    { id: novoId(), campo: "endereco", celula: "D12" },
    { id: novoId(), campo: "bairro", celula: "B13" },
    { id: novoId(), campo: "cidade", celula: "I13" },
    { id: novoId(), campo: "cep", celula: "O13" },
    { id: novoId(), campo: "uf", celula: "S13" },
    { id: novoId(), campo: "altura_ev", celula: "D14" },
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
4. TABELA DE EQUIPAMENTOS (Página 3): um objeto por equipamento.
   - Extraia os dados brutos exatamente como aparecem nas colunas (não faça conversões manuais).
   - A coluna "TIPO DE ANTENA" (ou "TIPO" / "TIPO DE EQUIPAMENTO"): extraia EXATAMENTE o texto literal da célula (ex: "RF", "MODULO", "MW", "GPS", "TMA") para o campo "tipo_equipamento". NUNCA deixe vazio se houver valor na célula (ex: para equipamentos RRU onde constar "MODULO", extraia "MODULO").
   - A coluna "ALTURA" da tabela indica a cota de instalação na torre e deve ser mapeada para "rad_center" (ex: "50,0000" ou "59,0000" ou "60,0000").
   - A coluna "DIMENSÕES (mm)" traz as medidas físicas (ex: "2500 x 355 x 192", "560 x 308 x 133" ou "900"):
     * Para antenas com 3 dimensões (ex: RF ou MODULO "2500 x 355 x 192"): comprimento="2500", largura="355", profundidade="192".
     * REGRA CRÍTICA PARA ANTENAS MW (Micro-ondas / Parábola / Diâmetro único ex: "900" ou "600"):
       - O valor da dimensão/diâmetro DEVE OBRIGATORIAMENTE ser gravado no campo "profundidade" (ex: "900").
       - Os campos "comprimento" e "largura" DEVEM OBRIGATORIAMENTE ficar como "-".
       - NUNCA coloque o diâmetro ou dimensão da antena MW nos campos "comprimento" ou "largura".
   - A coluna "ARRASTO" corresponde ao coeficiente "ca" (ex: "1.2" ou "1.6").
   - Mantenha os valores de AEV como aparecem no documento.
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

export const CONFIG_PADRAO: ConfigAutomacao = {
  instrucoes: INSTRUCOES_PADRAO,
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

    // Garante que a regra E49 exista mesmo para quem já tinha config salva no navegador
    if (!mapCarregado.some((m: any) => m.celula === "E49")) {
      mapCarregado.push({
        id: novoId(),
        campo: "",
        celula: "E49",
        transformacao: "multiplicacao_base",
      });
    }

    let instrucoes = typeof j.instrucoes === "string" ? j.instrucoes : INSTRUCOES_PADRAO;
    if (
      !instrucoes.includes("MODULO") ||
      !instrucoes.includes("TIPO DE ANTENA") ||
      !instrucoes.includes("REGRA CRÍTICA PARA ANTENAS MW")
    ) {
      instrucoes = INSTRUCOES_PADRAO;
    }

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
      instrucoes,
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
    localStorage.setItem(LS_KEY, JSON.stringify(cfg));
  } catch {
    /* quota cheia — ignora */
  }
}

export function resetarConfig(): ConfigAutomacao {
  const c: ConfigAutomacao = {
    instrucoes: INSTRUCOES_PADRAO,
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
 * usuário. O schema JSON é GERADO daqui — assim o prompt nunca fica
 * dessincronizado do que será gravado na planilha.
 */
export function montarPromptFinal(cfg: ConfigAutomacao): string {
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

  return `Você é um engenheiro de telecomunicações sênior analisando este Projeto Executivo (PPI) em PDF.
Extraia os dados técnicos com base no carimbo, desenhos, legendas e tabelas (foco nas páginas 1, 2 e 3).

INSTRUÇÕES DE EXTRAÇÃO:
${cfg.instrucoes.trim() || "(nenhuma instrução adicional)"}

CAMPOS A EXTRAIR:
${camposDoSchema.map((c) => `- ${c}`).join("\n")}

TABELA DE EQUIPAMENTOS (Página 3): extraia um objeto por equipamento com os valores brutos da tabela de carregamento.
- Para antenas celulares de 3 dimensões (ex: "RF" ou "MODULO" "2500 x 355 x 192"): preencha comprimento, largura e profundidade com cada medida.
- Para antenas MW (micro-ondas / parábolas com diâmetro único, ex: "900" ou "600"): coloque o diâmetro OBRIGATORIAMENTE em "profundidade", e coloque "-" em "comprimento" e "largura".
Não faça conversões manuais de unidades — a aplicação fará a normalização, decomposição e conversão de mm para metros automaticamente.

REGRAS FINAIS:
1. Se um dado NÃO existir no documento, use string vazia "" — NUNCA invente valores.
2. Responda APENAS com o JSON abaixo. SEM crases, SEM bloco \`\`\`json, SEM texto antes ou depois.

FORMATO EXATO DA RESPOSTA:
{
${schemaCampos || '  "site_id_cliente": "",'}
  "rastreabilidade": {
    "origem_site_id": "Páginas 1, 2 e 3 — carimbo SITE",
    "origem_altura_torre": "Página 2 item 03 e Página 3 elevação",
    "origem_equipamentos": "Página 3  — tabela de carregamento",
    "base_em_concreto":   "Página 2 e 9  — LEGENDA da Planta Civil/Planta Baixo/Radier"
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
