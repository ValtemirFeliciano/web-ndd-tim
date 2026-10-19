# Mudanças no NDD Forge — 07/10/2026

Todas as mudanças feitas hoje no NDD Forge, em ordem, com o motivo de cada uma.
Nada foi commitado nem publicado — para publicar, use o seu fluxo normal (`subir_git.bat`).

| # | Mudança | Arquivos |
|---|---|---|
| 1 | Resposta do Gemini em JSON nativo | `src/lib/gemini.ts` |
| 2 | Resposta cortada (MAX_TOKENS) vira erro claro | `src/lib/gemini.ts` |
| 3 | "Rastreabilidade" sem texto pré-preenchido no prompt | `src/lib/mapping.ts` |
| 4 | Novo modo **SCHEMA** (campos fixos) com botão **LIVRE / SCHEMA** | `src/types.ts`, `src/lib/mapping.ts`, `src/lib/gemini.ts`, `src/App.tsx`, `src/components/Header.tsx`, `src/components/MassProcessingPage.tsx` |
| 5 | Regra de endereço em rodovia (não cortar o "Km") | `src/lib/mapping.ts` |

**Não foram tocados:** instruções BTS/COLLO, mapa de células, aliases, `normalizarDados`, QwenCloud (`qwen.ts`), geração do Excel, `vite.config.js`, `package.json`, `dist/`, git.

---

## 1. Resposta do Gemini em JSON nativo

**Antes:** o pedido ao Gemini não pedia JSON de forma nativa; a IA respondia texto livre e o código precisava limpar crases (```json), textos antes/depois e torcer para o JSON vir válido.

**Agora:** `generationConfig` leva `responseMimeType: "application/json"` — o Gemini devolve só JSON válido. A limpeza antiga (`limparJson`) continua como rede de segurança.

**Vale para os dois modos** (LIVRE e SCHEMA).

## 2. Resposta cortada no limite de tamanho (MAX_TOKENS)

**Antes:** quando a resposta batia no limite (`maxOutputTokens: 8192`), o Gemini avisava com `finishReason: "MAX_TOKENS"` e o código aceitava em silêncio — o JSON vinha pela metade (erro confuso de "JSON malformado" ou equipamentos faltando).

**Agora:** a extração para com a mensagem: *"A resposta da IA foi cortada no limite de tamanho (MAX_TOKENS) — o JSON veio incompleto e equipamentos poderiam ficar de fora. Tente novamente ou use outro modelo."*

O limite de 8192 **não** foi aumentado: alguns modelos da lista de reserva (ex.: `gemini-2.0-flash`) não aceitam mais que isso.

## 3. "Rastreabilidade" sem texto pré-preenchido

**Antes:** o modelo de JSON no prompt já vinha com a rastreabilidade escrita (ex.: `"origem_site_id": "Páginas 1, 2 e 3 — carimbo SITE"`). A IA tendia a só repetir o texto, então a rastreabilidade não comprovava nada sobre o PDF analisado.

**Agora:** os 4 campos vêm vazios no modelo, e as "REGRAS FINAIS" do prompt pedem: *escreva a página e o item/tabela onde VOCÊ encontrou cada grupo de dados NESTE PDF; se não encontrou, deixe "".* A regra fica na parte fixa do prompt, então vale também para quem tem instruções salvas no navegador.

## 4. Modo SCHEMA com botão LIVRE / SCHEMA

### O que é

Um segundo seletor no cabeçalho, ao lado de **BTS / COLLO**:

- **LIVRE** (padrão) — comportamento de antes: a IA devolve JSON sem schema.
- **SCHEMA** — o app envia ao Gemini um `responseSchema` com os campos fixos.

A escolha fica salva no navegador (junto da configuração, `usarSchema`) e vale para a **extração individual** e a **extração em massa** (lote e re-extração). O log de cada extração mostra o modo usado: *"Modo de resposta: SCHEMA…"* ou *"…LIVRE…"*. O QwenCloud ignora o schema (continua só com JSON simples).

### Por que

1. **Campos sempre com o nome e o tipo certos** — o Gemini só pode devolver as chaves declaradas.
2. **Ordem forçada: citação antes do valor** (`propertyOrdering`). A IA escreve primeiro a linha literal do PDF e só depois o valor:
   - `trecho_citado_localizacao` antes de endereço/coordenadas;
   - `trecho_citado_base` antes de `nx_base` / `di_base`;
   - `trecho_citado_do_pdf` antes de tipo, modelo, azimute, dimensões de cada equipamento.
   Copiando a linha primeiro, ela extrai a partir dela — menos alucinação.

### Como foi feito

- `src/types.ts`: `ConfigAutomacao` ganhou `usarSchema?: boolean`.
- `src/lib/mapping.ts`:
  - `camposExtraidos(cfg)` — a lista de campos a extrair (antes ficava dentro de `montarPromptFinal`); agora usada pelo prompt **e** pelo schema, então os dois nunca ficam diferentes. Se você adicionar um campo no "Mapeamento & Prompt", ele entra nos dois automaticamente.
  - `montarSchemaResposta(cfg)` — monta o schema. Tudo como texto (quantidade e azimute também, porque o PDF traz "-", "06", "125/230/315"); páginas como inteiro.
  - `carregarConfig` / `CONFIG_PADRAO` / `resetarConfig` passam a guardar `usarSchema` (padrão: desligado).
- `src/lib/gemini.ts`: `OpcoesFallbackIA` ganhou `responseSchema`; quando informado, vai no `generationConfig`.
- `src/App.tsx`: monta o schema, cria `aoMudarUsarSchema` (salva e registra no log) e só envia o schema com o modo SCHEMA ligado.
- `src/components/MassProcessingPage.tsx`: mesma regra nas duas chamadas.
- `src/components/Header.tsx`: o botão LIVRE / SCHEMA (mesmo estilo do BTS / COLLO).

### Teste que motivou a mudança

Feito numa cópia separada (`Downloads\teste_Schema`), com os 8 PPIs BTS de `Downloads\ppi massa`, 2 rodadas por versão (32 extrações), comparando campo a campo com um gabarito lido dos PDFs. Detalhes em `Downloads\teste_Schema\RESULTADO_TESTE_SCHEMA_2026-10-07.md`.

| | LIVRE | SCHEMA |
|---|---|---|
| Cabeçalho (IDs, endereço, coordenadas, altura, base) | 88,5% | **95,3%** |
| Campos de equipamento | 92,4% | **94,6%** |
| Erros na quantidade de bases | 11 | **0** |
| Erros no nome do modelo | 43 | **23** |
| Endereço com km cortado ("BR-267 Km 188+704" → "BR-267") | 0 | **4** ⚠️ |

A piora do endereço foi corrigida no item 5.

### Verificação no app (depois da mudança)

- `npx tsc --noEmit`: sem erros.
- No `localhost:3000`, botão LIVRE / SCHEMA aparece ao lado de BTS / COLLO e a escolha fica salva.
- Extração real do MSNVN007 em **SCHEMA**: requisição com `responseSchema`, HTTP 200, 7 equipamentos.
- Extração real do mesmo PPI em **LIVRE**: requisição **sem** `responseSchema`, HTTP 200.
- A extração em massa foi verificada só pelo código e pela checagem de tipos (não rodei um lote, para não gravar arquivos na sua pasta de destino).

## 5. Endereço em rodovia: não cortar o "Km"

**Antes:** no teste, o modo SCHEMA cortou o endereço de 4 sites de rodovia ("BR-267 Km 188+704" → "BR-267"). A instrução de endereço dizia para isolar "APENAS o logradouro", e a IA passou a entender o km como algo à parte.

**Agora:** nova regra nas "REGRAS FINAIS" do prompt:
> *3. ENDEREÇO EM RODOVIA/ESTRADA: o quilômetro faz parte do logradouro. Copie em "endereco" a rodovia COM o km e o complemento exatamente como no carimbo (ex: "BR-000 Km 00+000", "SP-000 Km 00,5"). NUNCA corte o "Km" deixando só o nome da rodovia.*

A antiga regra 3 ("Responda APENAS com o JSON…") virou a 4.

**Por que nessa parte do prompt:** as "REGRAS FINAIS" são fixas — valem para LIVRE e SCHEMA, para BTS e COLLO, e também para quem tem instruções BTS/COLLO salvas no navegador (as instruções editáveis não foram alteradas).

**Por que exemplos fictícios:** usar endereços reais dos PPIs de teste como exemplo poderia fazer a IA "copiar o exemplo" quando a imagem estiver ruim — e deixaria o teste viciado.

**Verificação no app (localhost:3000):**

| Site | Modo | Endereço extraído | Gabarito |
|---|---|---|---|
| MSNVL007_A | SCHEMA | BR-267 Km 188+704 | ✅ |
| MSRBS014_A | SCHEMA | BR-262 Km 186+784 | ✅ |
| MSRTD006_B | SCHEMA | MS-338 Km 338+249 | ✅ |
| MSRTD007_A | SCHEMA | MS-338 Km 326+162 | ✅ |
| MSRBS014_A | LIVRE | BR-262 Km 186+784 | ✅ |

Antes da correção, os 4 primeiros (em SCHEMA) tinham saído sem o km. `npx tsc --noEmit` sem erros.

Observação (não relacionada a esta mudança): no MSRTD006 o carimbo traz o SITE numa linha só, e a IA devolveu o ID do detentor como "MSRTD006_B_SN-SRRSI5" — vale conferir esse site manualmente.

---

## Backups e como desfazer

Os arquivos já tinham alterações suas **sem commit**, então os backups são do estado de hoje, não do último commit.

| Para desfazer | Copie de volta |
|---|---|
| Só a regra de endereço (item 5) | `backup_endereco_2026-10-07\src\lib\mapping.ts` → `src\lib\` |
| O modo SCHEMA e a regra de endereço (itens 4 e 5) | `backup_schema_switch_2026-10-07\src\…` (6 arquivos) → `src\` |
| Tudo de hoje (itens 1 a 5) | primeiro o passo acima; depois `backup_prompt_2026-10-07\src\lib\gemini.ts` e `mapping.ts` → `src\lib\` |

O detalhamento original dos itens 1–3 também está em `MUDANCAS_PROMPT_2026-10-07.md`.

## Pasta de teste

`Downloads\teste_Schema` é uma cópia do projeto (sem `.git`) usada só no teste, com a porta trocada para 3001. Pode ser apagada quando não precisar mais — ela não publica nada (não tem `.git`).
