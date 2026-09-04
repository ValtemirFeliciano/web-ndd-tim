/** Contrato de dados — espelha o JSON que o prompt do Gemini devolve
 *  (o mesmo formato usado no seu Apps Script original). */

export interface Equipamento {
  tipo_equipamento: string;
  fabricante: string;
  modelo: string;
  qtde: number | string;
  azimute: string;
  altura: string;
  largura: string;
  profundidade: string;
  rad_center: string;
  aev_sem_ca: string;
  ca: string;
  aev_com_ca: string;
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
  altura: "-",
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
