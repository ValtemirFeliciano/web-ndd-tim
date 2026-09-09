import type { CampoMapeamento, ConfigAutomacao } from "../types";

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
  data_rfi: "data do RFI no formato dd/mm/aaaa",
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
    { id: novoId(), campo: "data_rfi", celula: "D7" },
    { id: novoId(), campo: "site_id_cliente", celula: "C9" },
    { id: novoId(), campo: "site_id_detentor", celula: "P9" },
    { id: novoId(), campo: "latitude", celula: "C11" },
    { id: novoId(), campo: "longitude", celula: "J11" },
    { id: novoId(), campo: "endereco", celula: "C12" },
    { id: novoId(), campo: "endereco", celula: "D12" },
    { id: novoId(), campo: "bairro", celula: "B13" },
    { id: novoId(), campo: "cidade", celula: "I13" },
    { id: novoId(), campo: "cep", celula: "O13" },
    { id: novoId(), campo: "uf", celula: "S13" },
    { id: novoId(), campo: "altura_ev", celula: "C14" },
    { id: novoId(), campo: "altura_ev", celula: "D14" },
    { id: novoId(), campo: "", celula: "D15", valorFixo: "( X )" },
  ];
}

export const INSTRUCOES_PADRAO = `1. CARIMBO ("SITE:"):
   - Primeira linha (ex: MSRBS006_A) = "site_id_detentor".
   - Segunda linha (ex: SN-RRRSI4) = "site_id_cliente".
2. ALTURA DA EV: item 03 da legenda ou cota na elevação da torre (ex: "60"). Se não encontrar, use "60".
3. Extraia: ENDEREÇO COMPLETO, BAIRRO, CIDADE, CEP (somente dígitos), UF (sigla com 2 letras),
   COORDENADAS em graus decimais (ex: -22.906847, sem símbolos ° ou letras N/S/E/W) e DATA_RFI (formato dd/mm/aaaa).
4. TABELA DE EQUIPAMENTOS (Página 3): um objeto por equipamento, mantendo os valores de AEV
   EXATAMENTE como aparecem no relatório, com PONTO decimal (ex: 0.888 e 1.065).
5. ÁREA DE INSTALAÇÃO DO GABINETE (BASE DE CONCRETO):
   - Procure na LEGENDA da Planta Civil/Planta Baixo/Radier (Página 2), o item de "BASE DE CONCRETO PARA EQUIPAMENTO".
   - Extraia a QUANTIDADE de bases (ex: "2") → campo "nx_base"
   - Extraia as DIMENSÕES de cada base (ex: "1,00x1,00" ou "3,00x5,00") → campo "di_base"
   - IMPORTANTE: Extraia APENAS a quantidade e as dimensões individuais. O cálculo da área total será feito automaticamente.
   - Exemplos:
     * "2X BASE DE CONCRETO PARA EQUIPAMENTO TIM 1P (1,00X1,00m)" → nx_base="2", di_base="1,00x1,00"
     * "1X BASE DE CONCRETO PARA EQUIPAMENTO (3,00X5,00m)" → nx_base="1", di_base="3,00x5,00"
6. RASTREABILIDADE: indique em qual página/item cada grupo de dados foi encontrado.
7. Se um dado NÃO existir no documento, use string vazia "" — NUNCA invente valores.`;

export const CONFIG_PADRAO: ConfigAutomacao = {
  instrucoes: INSTRUCOES_PADRAO,
  mapeamento: mapeamentoPadrao(),
  linhaInicialEq: 23,
};

/* ------------------------------------------------------------------ */
/*  Persistência                                                       */
/* ------------------------------------------------------------------ */

export function carregarConfig(): ConfigAutomacao {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return CONFIG_PADRAO;
    const j = JSON.parse(raw);
    return {
      instrucoes: typeof j.instrucoes === "string" ? j.instrucoes : INSTRUCOES_PADRAO,
      mapeamento:
        Array.isArray(j.mapeamento) && j.mapeamento.length > 0
          ? j.mapeamento
              .filter((m: any) => m && typeof m.celula === "string")
              .map((m: any) => ({
                id: String(m.id ?? novoId()),
                campo: String(m.campo ?? "").trim(),
                celula: String(m.celula).trim().toUpperCase(),
                br: !!m.br,
                valorFixo: typeof m.valorFixo === "string" ? m.valorFixo : undefined,
              }))
          : mapeamentoPadrao(),
      linhaInicialEq: Number(j.linhaInicialEq) > 0 ? Number(j.linhaInicialEq) : 23,
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
  };
  salvarConfig(c);
  return c;
}

/* ------------------------------------------------------------------ */
/*  Montagem do prompt final                                           */
/* ------------------------------------------------------------------ */

/**
 * Monta o prompt completo enviado ao Gemini a partir da configuração do
 * usuário. O mapa de células e o schema JSON são GERADOS daqui — assim o
 * prompt nunca fica dessincronizado do que será gravado na planilha.
 */
export function montarPromptFinal(cfg: ConfigAutomacao): string {
  const linhasMapa: string[] = [];
  const camposDoSchema: string[] = [];

  cfg.mapeamento.forEach((m) => {
    const celula = m.celula.trim().toUpperCase();
    if (!CELULA_RE.test(celula)) return;
    const campo = m.campo.trim();

    if (m.valorFixo !== undefined && m.valorFixo !== "") {
      linhasMapa.push(`- (valor fixo "${m.valorFixo}") → célula ${celula} — gravado literal, sem extração`);
      return;
    }
    if (!campo) return;
    const desc = DESCRICOES_CAMPOS[campo] ?? "campo personalizado — descreva nas INSTRUÇÕES o que a IA deve extrair aqui";
    linhasMapa.push(`- "${campo}" → célula ${celula} — ${desc}`);
    if (!camposDoSchema.includes(campo)) camposDoSchema.push(campo);
  });

  // Garantir que nx_base e di_base estejam sempre no schema para cálculo de área
  if (!camposDoSchema.includes("nx_base")) {
    camposDoSchema.push("nx_base");
    linhasMapa.push(`- "nx_base" → (usado em transformação) — ${DESCRICOES_CAMPOS.nx_base}`);
  }
  if (!camposDoSchema.includes("di_base")) {
    camposDoSchema.push("di_base");
    linhasMapa.push(`- "di_base" → (usado em transformação) — ${DESCRICOES_CAMPOS.di_base}`);
  }

  const schemaCampos = camposDoSchema.map((c) => `  "${c}": "",`).join("\n");

  return `Você é um engenheiro de telecomunicações sênior analisando este Projeto Executivo (PPI) em PDF.
Extraia os dados técnicos com base no carimbo, desenhos, legendas e tabelas (foco nas páginas 1, 2 e 3).

INSTRUÇÕES DE EXTRAÇÃO:
${cfg.instrucoes.trim() || "(nenhuma instrução adicional)"}

MAPEAMENTO OBRIGATÓRIO — extraia exatamente estes campos (as células indicam onde cada valor será gravado na planilha):
${linhasMapa.join("\n") || "(mapa vazio)"}

TABELA DE EQUIPAMENTOS: extraia um objeto por equipamento (tabela de carregamento, normalmente na página 3).
Na planilha, essa tabela começa na linha ${cfg.linhaInicialEq}, colunas A→Q: OPERADORA, SITUAÇÃO, TIPO, FABRICANTE,
MODELO, BANDA, QTDE, AZIMUTE, ALTURA, LARGURA, PROFUNDIDADE, RAD CENTER, TILT MEC., TILT ELET., AEV S/ CA, CA, AEV C/ CA.
Mantenha os AEV com PONTO decimal (ex: 0.888 e 1.065), exatamente como no relatório.

REGRAS FINAIS:
1. Se um dado NÃO existir no documento, use string vazia "" — NUNCA invente valores.
2. Responda APENAS com o JSON abaixo. SEM crases, SEM bloco \`\`\`json, SEM texto antes ou depois.

FORMATO EXATO DA RESPOSTA:
{
${schemaCampos || '  "site_id_cliente": "",'}
  "rastreabilidade": {
    "origem_site_id": "Páginas 1, 2 e 3 — carimbo SITE",
    "origem_altura_torre": "Página 2 item 03 e Página 3 elevação",
    "origem_equipamentos": "Página 3 — tabela de carregamento"
  },
  "equipamentos": [
    {
      "tipo_equipamento": "",
      "fabricante": "",
      "modelo": "",
      "qtde": 1,
      "azimute": "",
      "altura": "",
      "largura": "",
      "profundidade": "",
      "rad_center": "",
      "aev_sem_ca": "0.888",
      "ca": "1.2",
      "aev_com_ca": "1.065"
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
    if (!temFixo && m.campo && !CAMPO_RE.test(m.campo)) {
      avisos.push(`Regra #${i + 1}: campo "${m.campo}" deve ser minúsculo com underline (ex: tipo_torre) para bater com o JSON.`);
    }
    if (!temFixo && !m.campo) avisos.push(`Regra #${i + 1}: sem campo e sem valor fixo — não grava nada em ${cel}.`);
  });
  if (!(cfg.linhaInicialEq >= 1)) avisos.push("Linha inicial da tabela de equipamentos deve ser ≥ 1.");
  return avisos;
}
