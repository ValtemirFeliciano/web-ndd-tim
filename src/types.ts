/** Contrato de dados — espelha o JSON que o prompt do Gemini devolve
 *  (o mesmo formato usado no seu Apps Script original). */

export interface Equipamento {
  tipo_equipamento: string;
  fabricante: string;
  modelo: string;
  qtde: number | string;
  azimute: string;
  comprimento: string;
  largura: string;
  profundidade: string;
  rad_center: string;
  aev_sem_ca: string;
  ca: string;
  aev_com_ca: string;
}

/** Mapeamento de aliases para colunas da tabela de equipamentos */
export interface AliasColuna {
  id: string;
  /** Nome da coluna no sistema (ex: "altura") */
  campoSistema: string;
  /** Nome alternativo que pode aparecer no PDF (ex: "L", "Length", "H") */
  aliasPdf: string;
}

export interface Rastreabilidade {
  origem_site_id: string;
  origem_altura_torre: string;
  origem_equipamentos: string;
  [chave: string]: string;
}

export interface DadosPPI {
  site_id_cliente: string;
  site_id_detentor: string;
  endereco: string;
  bairro: string;
  cidade: string;
  cep: string;
  uf: string;
  latitude: string;
  longitude: string;
  altura_ev: string;
  data_rfi: string;
  rastreabilidade: Rastreabilidade;
  equipamentos: Equipamento[];
  /** Quantidade de bases de concreto (ex: "2") */
  nx_base?: string;
  /** Dimensões da base (ex: "1,00x1,00") */
  di_base?: string;
  /** Campos personalizados adicionados pelo usuário na página de Configuração */
  extras?: Record<string, string>;
}

/** Uma regra do mapa de células: campo do JSON → célula da planilha. */
export interface CampoMapeamento {
  id: string;
  /** nome do campo no JSON devolvido pela IA (ex.: "site_id_cliente"); vazio se for valor fixo */
  campo: string;
  /** referência da célula de destino (ex.: "C9") */
  celula: string;
  /** converte ponto decimal em vírgula antes de gravar (formato pt-BR) */
  br?: boolean;
  /** se preenchido, grava este texto literal na célula (ignora o campo) */
  valorFixo?: string;
  /** nome da função de transformação (ex.: "area_base") */
  transformacao?: string;
}

/** Tudo o que o usuário personaliza na página de Configuração. */
export interface ConfigAutomacao {
  /** instruções de domínio injetadas no prompt da IA */
  instrucoes: string;
  mapeamento: CampoMapeamento[];
  /** linha da planilha onde começa a tabela de equipamentos */
  linhaInicialEq: number;
  /** aliases para mapear nomes de colunas do PDF para o sistema */
  aliasesColunas: AliasColuna[];
}

export type LogLevel = "info" | "ok" | "warn" | "error";

export interface LogEntry {
  id: number;
  hora: string;
  level: LogLevel;
  msg: string;
  detalhe?: string;
}

export type StepId = "arquivo" | "gemini" | "parse" | "validacao";
export type StepStatus = "idle" | "running" | "done" | "error";

export interface ArquivoInfo {
  nome: string;
  tamanho: number;
  mime: string;
  base64: string; // sem o prefixo data:...
}

export interface TemplateInfo {
  nome: string;
  tamanho: number;
  buffer: ArrayBuffer;
}

export interface ResultadoExtracao {
  dados: DadosPPI;
  em: string; // timestamp ISO
  arquivo: string;
  modelo: string;
  duracaoMs: number;
  avisos: string[];
}

export const EQUIPAMENTO_VAZIO: Equipamento = {
  tipo_equipamento: "",
  fabricante: "",
  modelo: "",
  qtde: 1,
  azimute: "-",
  comprimento: "-",
  largura: "-",
  profundidade: "-",
  rad_center: "",
  aev_sem_ca: "",
  ca: "1,2",
  aev_com_ca: "",
};

export const DADOS_VAZIOS: DadosPPI = {
  site_id_cliente: "",
  site_id_detentor: "",
  endereco: "",
  bairro: "",
  cidade: "",
  cep: "",
  uf: "",
  latitude: "",
  longitude: "",
  altura_ev: "60",
  data_rfi: "",
  rastreabilidade: {
    origem_site_id: "",
    origem_altura_torre: "",
    origem_equipamentos: "",
  },
  equipamentos: [],
};

/** Campos principais usados no medidor de preenchimento */
export const CAMPOS_PRINCIPAIS: { chave: keyof DadosPPI; rotulo: string }[] = [
  { chave: "site_id_cliente", rotulo: "Site ID Cliente" },
  { chave: "site_id_detentor", rotulo: "Site ID Detentor" },
  { chave: "endereco", rotulo: "Endereço" },
  { chave: "bairro", rotulo: "Bairro" },
  { chave: "cidade", rotulo: "Cidade" },
  { chave: "cep", rotulo: "CEP" },
  { chave: "uf", rotulo: "UF" },
  { chave: "latitude", rotulo: "Latitude" },
  { chave: "longitude", rotulo: "Longitude" },
  { chave: "altura_ev", rotulo: "Altura EV" },
  { chave: "data_rfi", rotulo: "Data RFI" },
];
