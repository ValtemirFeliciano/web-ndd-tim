# 📡 NDD Forge — PPI → Excel com IA

> Automação de engenharia para telecom: envie o **Relatório de Projeto Executivo (PPI)** em PDF e receba a planilha **NDD** preenchida automaticamente, com extração de dados via **Google Gemini**.

---

## ✨ O que o projeto faz

Você sobe o PDF do **PPI** (relatório de engenharia de um site de telecom). A IA lê o documento — carimbo, coordenadas, tabela de equipamentos — e preenche uma planilha **NDD** nas **mesmas células** que o fluxo original em Google Apps Script usava (D7, C9, P9, C11, linha 23…). Ao final, o arquivo `.xlsx` é gerado **100% no navegador** e disponibilizado para download.

Nenhum backend é necessário: tudo roda no browser do usuário. O PDF vai direto do navegador para a API do Google.

---

## 🔄 Fluxo completo

```
PPI.pdf ──► Gemini (visão + prompt) ──► JSON estruturado ──► NDD.xlsx preenchido
   │              │                        │                      │
   └─ base64      └─ rastreabilidade       └─ validação           └─ download
                     (página/item)            + edição manual         direto
```

1. **Upload** do PPI (PDF, PNG ou JPG — até 18 MB).
2. O arquivo vira **base64** e é enviado ao **Gemini** com um prompt técnico específico.
3. A IA devolve um **JSON** com os dados do site + a rastreabilidade de onde cada campo veio.
4. O JSON é **validado e exibido editável** (Raio-X) — você confere e corrige antes de gerar.
5. O **ExcelJS** preenche o modelo NDD (template embutido ou o seu próprio `.xlsx`) e baixa o arquivo.

---

## 🚀 Como rodar

### Pré-requisitos
- [Node.js](https://nodejs.org) 18+
- Uma **chave da API Gemini** → [Google AI Studio](https://aistudio.google.com/app/apikey)

### Instalação

```bash
git clone <seu-repositorio>
cd <pasta-do-projeto>
npm install
npm run dev        # ambiente de desenvolvimento (http://localhost:5173)
```

Para build de produção:

```bash
npm run build      # gera a pasta dist/
npm run preview    # serve o build localmente
```

### Configurar a chave

1. Abra o app e clique em **"Configurar API"** (topo da página).
2. Cole sua chave do AI Studio e escolha o modelo (padrão: `gemini-2.0-flash`).
3. Clique em **"Testar conexão"** para validar.

> 🔐 A chave é salva **apenas no `localStorage` do seu navegador**. Ela nunca sai da sua máquina, exceto para chamar a própria API do Google.

---

## 🧩 Funcionalidades

- ✅ Upload do PPI por **drag & drop** ou seletor de arquivo.
- ✅ Template `.xlsx` opcional (passo 02) — usa a aba `NDD` automaticamente; sem template, aplica o **modelo padrão embutido**.
- ✅ **Página Mapeamento & Prompt**: edite em qual célula cada campo cai, adicione campos novos, valores fixos, formatação BR (ponto → vírgula) e as instruções da IA — com preview do prompt final montado automaticamente.
- ✅ Extração com **rastreabilidade** (página/item de origem de cada campo).
- ✅ **Raio-X editável**: todos os campos podem ser corrigidos antes de gerar o Excel.
- ✅ **Console de debug completo**: pipeline em etapas, linha do tempo, prompt, requisição, resposta bruta e JSON.
- ✅ **Relatório de diagnóstico** copiável (logs + erros + ambiente, sem a chave).
- ✅ Reparo automático de **fórmulas compartilhadas** do template (evita o erro `Shared Formula master...` do ExcelJS).
- ✅ Download do `.xlsx` preenchido + export do JSON da extração.
- ✅ Persistência da última extração e das configurações no navegador.

---

## 🗺️ Mapa de células (igual ao Apps Script original)

| Célula     | Campo                          |
|------------|--------------------------------|
| `D7`       | `data_rfi`                     |
| `C9`       | `site_id_cliente`              |
| `P9`       | `site_id_detentor`             |
| `C11`/`J11`| `latitude` / `longitude`       |
| `C12`      | `endereco`                     |
| `B13`·`I13`| `bairro` · `cidade`            |
| `O13`·`S13`| `cep` · `uf`                   |
| `C14`      | `altura_ev`                    |
| `D15`      | `( X )` (nova disponibilidade) |
| `A23:Q…`   | Tabela de equipamentos         |

> ✏️ Este mapa é o **padrão de fábrica** — ele pode ser alterado na página abaixo.

---

## ⚙️ Página Mapeamento & Prompt

Acesse pela aba **"Mapeamento & Prompt"** no topo. É aqui que você adapta a automação ao seu template real:

**1. Mapa de células** — uma regra por linha:
- **Campo**: o nome do campo no JSON que a IA devolve (ex: `site_id_cliente`). Campos novos podem ser criados livremente (ex: `tipo_torre`) — basta descrever nas instruções o que a IA deve procurar;
- **Célula**: onde o valor será gravado (ex: `B2`). Validação de formato (`A1`, `AA12`…) com alerta visual;
- **Valor fixo**: grava um texto literal na célula, sem extração (ex: `( X )` em `D15`);
- **BR**: converte ponto → vírgula para números no formato brasileiro;
- O mesmo campo pode alimentar várias células (o padrão já faz `endereco → C12 e D12`);
- A **linha inicial da tabela de equipamentos** também é configurável (padrão: 23).

**2. Instruções de extração** — as regras de domínio que vão no prompt (como ler o carimbo `SITE:`, onde fica a altura da EV etc.).

**3. Prompt final** — montado **automaticamente** em tempo real: instruções + mapa de células + schema JSON dos campos usados. Nunca fica dessincronizado do que será gravado na planilha. Tem botão de copiar para testar direto no AI Studio.

Tudo é salvo automaticamente no navegador (auto-save). Os **campos personalizados** que a IA devolver aparecem no Raio-X, editáveis, antes de gerar o Excel.

---

## 🛠️ Stack

| Camada     | Tecnologia                          |
|------------|-------------------------------------|
| Frontend   | React 18 + TypeScript + Vite        |
| Estilização| Tailwind CSS 4                      |
| Excel      | ExcelJS (geração de `.xlsx` no browser) |
| IA         | Google Gemini API (REST)            |
| Ícones     | lucide-react                        |

---

## 📁 Estrutura

```
src/
├── App.tsx                    # orquestra upload → extração → edição → download
├── components/
│   ├── Header.tsx             # topo, chave API, modelo, abas Extração/Config
│   ├── UploadZones.tsx        # drag & drop do PPI e do template
│   ├── ExtractionPanel.tsx    # Raio-X editável dos dados (+ campos personalizados)
│   ├── ConfigPage.tsx         # página Mapeamento & Prompt
│   └── DebugConsole.tsx       # pipeline + console de debug em abas
├── lib/
│   ├── gemini.ts              # chamada à API, retry (503), limpeza do JSON
│   ├── mapping.ts             # mapa de células configurável + montagem do prompt
│   └── excel.ts               # ExcelJS: template, reparo de fórmulas, preenchimento
└── types.ts                   # contrato de dados (JSON da IA + automação)
```

---

## 🐞 Debug de erros

Quando algo falha, o app **não fica mudo**:

- O **cartão de erro** aparece na tela com o motivo em português.
- A **stack trace completa** fica expandível na aba *Linha do tempo*.
- Um **contador de erros** em vermelho marca a aba de logs.
- O botão **"diagnóstico"** copia um relatório completo (sem a chave) para colar em issues.

> 💡 **Dica:** se o seu template NDD contém gráficos, macros ou proteção, remova-o no passo 02 e gere com o modelo embutido.

---

## 📜 Licença

Uso interno / livre. Ajuste conforme a política da sua empresa.

---

Feito com ⚡ por quem cansou de preencher NDD na mão.
