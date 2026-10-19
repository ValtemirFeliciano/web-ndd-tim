import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const raizProjeto = path.resolve(__dirname, "..");

// 1. Chave da API
const apiKey = process.argv[2] || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || "";

console.log("==========================================================================");
console.log("  CHAMADA AVULSA AO GEMINI 3.5-FLASH-LITE: CONSULTA DE PROMPT DEFINITIVO");
console.log("==========================================================================");

if (!apiKey) {
  console.error("\n❌ ERRO: Nenhuma chave da API Gemini fornecida.");
  console.log("👉 Como executar com sua chave:");
  console.log("   node scripts/perguntar-gemini-prompt.mjs SUA_CHAVE_GEMINI_AQUI\n");
  console.log("Ou defina a variável de ambiente:");
  console.log("   $env:GEMINI_API_KEY=\"SUA_CHAVE\"");
  console.log("   node scripts/perguntar-gemini-prompt.mjs\n");
  process.exit(1);
}

// 2. Arquivo PDF do PPI separado para teste
const caminhoPdf = path.join(raizProjeto, "scratch", "PPI_TESTE_MSRTD006_B.pdf");
if (!fs.existsSync(caminhoPdf)) {
  console.error(`❌ ERRO: O arquivo PPI de teste não foi encontrado em: ${caminhoPdf}`);
  process.exit(1);
}

console.log(`📄 Carregando PDF: ${path.basename(caminhoPdf)} (${(fs.statSync(caminhoPdf).size / 1024 / 1024).toFixed(2)} MB)...`);
const pdfBuffer = fs.readFileSync(caminhoPdf);
const pdfBase64 = pdfBuffer.toString("base64");

// 3. Montar o prompt de consulta para o Gemini
const promptConsulta = `Você é um dos principais pesquisadores do Google DeepMind e especialista em IA de Visão Computacional, Engenharia de Prompt e extração de dados estruturados a partir de projetos de engenharia civil/telecom (Projetos Executivos de PPI).

Em anexo está um documento técnico real (PPI em PDF do site MSRTD006_B / Santa Rita do Pardo) contendo carimbo na página 1, planta civil e base de concreto na página 2, e tabela de carregamento de equipamentos na página 3.

Nós temos uma aplicação em produção que utiliza a família Gemini Flash para extrair esses dados para uma planilha oficial (NDD TIM).

Abaixo está o PROMPT ATUAL que utilizamos em produção e o formato JSON esperado de resposta:

---
[INÍCIO DO NOSSO PROMPT ATUAL]
Você é um engenheiro de telecomunicações sênior analisando este Projeto Executivo (PPI) em PDF do tipo BTS (Site Novo / Greenfield).
Extraia os dados técnicos com base no carimbo, desenhos, legendas e tabelas (foco nas páginas 1, 2 e 3).

1. CARIMBO ("SITE:"):
   - Primeira linha (ex: MSRBS006_A) = "site_id_detentor".
   - Segunda linha (ex: SN-RRRSI4) = "site_id_cliente".
2. ALTURA DA EV: item 03 da legenda ou cota na elevação da torre.
3. LOCALIZAÇÃO E ENDEREÇO (Carimbo):
   - REGRA ANTI-ALUCINAÇÃO (LOCALIZAÇÃO): Copie OBRIGATORIAMENTE no campo "trecho_citado_localizacao" a linha literal completa de endereço e coordenadas impressa no carimbo do PDF e informe a "pagina_localizacao".
   - Isole no campo "endereco" APENAS o logradouro/rua/vicinal/estrada.
   - Extraia separadamente: "bairro" e "cidade". NUNCA coloque o nome da cidade dentro do campo bairro.
   - Extraia "uf", "cep" e COORDENADAS em graus decimais.
4. TABELA DE EQUIPAMENTOS (Página 3 - "CARREGAMENTO ANTENAS TIM A INSTALAR"):
   - Leia a tabela linha por linha com fidelidade óptica rigorosa.
   - A coluna "TIPO DE ANTENA": extraia EXATAMENTE o texto literal da célula (RF, RRU, ODU, MW, GPS, MODULO).
   - A coluna "AZIMUTE": copie o valor numérico que antecede o "°". Se estiver "-", use "-".
   - A coluna "DIMENSÕES (mm)":
     * Para equipamentos com 3 dimensões: preencha comprimento, largura e profundidade com cada medida.
     * Para equipamentos com apenas 2 dimensões no PDF (ex: GPS "146 x 78"): preencha comprimento e largura, deixando a profundidade OBRIGATORIAMENTE como "-". NUNCA deduza ou repita a medida para forçar uma 3ª dimensão.
     * Para antenas MW com diâmetro único: o diâmetro DEVE OBRIGATORIAMENTE ser gravado em "profundidade", mantendo comprimento e largura como "-".
5. ÁREA DE INSTALAÇÃO DO GABINETE (BASE DE CONCRETO):
   - Procure na LEGENDA da Planta Civil (Página 2), o item de base de concreto para equipamentos TIM.
   - Copie no campo "trecho_citado_base" a linha literal da legenda civil.
   - Extraia "nx_base" (quantidade) e "di_base" (dimensões exatas).

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
}
[FIM DO NOSSO PROMPT ATUAL]
---

PROBLEMAS REAIS QUE OCORREM NA PRÁTICA:
1. No Bairro: o modelo às vezes gera "Três Barras - Santa Rita do Pardo" em vez de apenas "Três Barras", misturando com a cidade.
2. Na Profundidade do GPS (célula K30): o modelo às vezes gera "0.078 x 0.146 x 0.146" para o GPS AYGE, repetindo o diâmetro como profundidade.
3. Em OCR de documentos escaneados: modelos confundem O com 0, Q com O, I com 1.

SUA MISSÃO:
1. ANALISE CRITICAMENTE o prompt atual e o PDF anexado: por que esses erros acontecem sob a ótica dos modelos Gemini Flash?
2. COMO SERIA O PROMPT DEFINITIVO E PERFEITO:
   - Monte e forneça o PROMPT COMPLETO, reescrito do zero com a melhor engenharia de prompt possível (Chain of Thought, ancoragem de citação, regras de OCR e instruções estruturadas).
   - Esse prompt deve instruir o Gemini a extrair 100% dos dados deste PPI (e de PPIs similares) sem alucinações, sem cortar quilômetros de rodovia, sem repetir medidas do GPS e sem misturar o bairro.

Forneça sua análise e em seguida o PROMPT PRONTO PARA USO.`;

// 4. Executar a chamada à API Gemini
async function chamarGemini(modelo) {
  console.log(`\n🚀 Enviando requisição para o modelo '${modelo}' com o PDF de ${path.basename(caminhoPdf)}...`);
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent?key=${apiKey}`;

  const payload = {
    contents: [
      {
        parts: [
          { text: promptConsulta },
          {
            inline_data: {
              mime_type: "application/pdf",
              data: pdfBase64,
            },
          },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: 8192,
    },
  };

  const inicio = Date.now();
  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const duracao = ((Date.now() - inicio) / 1000).toFixed(1);

  if (!resp.ok) {
    const erroTexto = await resp.text();
    throw new Error(`HTTP ${resp.status} em ${modelo} (${duracao}s): ${erroTexto}`);
  }

  const json = await resp.json();
  const texto = json?.candidates?.[0]?.content?.parts?.map((p) => p.text).join("") || "";
  return { texto, duracao };
}

async function main() {
  const modelos = ["gemini-3.5-flash-lite", "gemini-2.5-flash-lite", "gemini-2.5-flash", "gemini-1.5-flash"];
  let resultado = null;
  let modeloUsado = "";

  for (const mod of modelos) {
    try {
      resultado = await chamarGemini(mod);
      modeloUsado = mod;
      break;
    } catch (err) {
      console.warn(`⚠️ Falha ao consultar '${mod}': ${err.message.slice(0, 160)}...`);
      console.log("Tentando próximo modelo...");
    }
  }

  if (!resultado) {
    console.error("\n❌ Nenhum dos modelos Gemini conseguiu responder. Verifique sua chave da API ou cotas.");
    process.exit(1);
  }

  console.log(`\n✅ Resposta recebida com sucesso do '${modeloUsado}' em ${resultado.duracao}s!`);
  console.log("==========================================================================");
  console.log("RESPOSTA DO GEMINI (ANÁLISE E PROMPT SUGERIDO):");
  console.log("==========================================================================");
  console.log(resultado.texto);

  // Salvar no scratch
  const arquivoSaida = path.join(raizProjeto, "scratch", "RESPOSTA_GEMINI_PROMPT_IDEAL.md");
  fs.writeFileSync(arquivoSaida, `# Resposta do ${modeloUsado} sobre o Prompt Ideal de PPI\n\nData: ${new Date().toISOString()}\nPPI Analisado: MSRTD006_B_SN-SRRSI5_PROJETO EXECUTIVO_REV02.pdf\n\n---\n\n${resultado.texto}\n`, "utf-8");
  console.log(`\n💾 Análise e prompt gravados com sucesso em: ${arquivoSaida}`);
}

main().catch((err) => {
  console.error("Erro fatal:", err);
  process.exit(1);
});
