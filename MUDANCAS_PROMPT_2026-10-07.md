# Mudanças no prompt / chamada da IA — 07/10/2026

Aplicados **somente os itens 1 e 4** da avaliação do prompt, a pedido do Valtemir.
Nenhum outro arquivo ou comportamento foi alterado. Nada foi commitado nem publicado.

## Arquivos alterados

| Arquivo | Item |
|---|---|
| `src/lib/gemini.ts` | Item 1 |
| `src/lib/mapping.ts` | Item 4 |

**Não foram tocados:** instruções BTS/COLLO (`INSTRUCOES_BTS` / `INSTRUCOES_COLLO`), mapa de células, aliases, `normalizarDados`, QwenCloud (`qwen.ts`), Excel, telas, `package.json`, `dist/`, git.

## Backup e como desfazer

O projeto já tinha alterações suas **sem commit** nesses dois arquivos, então o backup é do estado de hoje (antes das minhas mudanças), não do último commit:

`backup_prompt_2026-10-07\src\lib\gemini.ts` e `backup_prompt_2026-10-07\src\lib\mapping.ts`

Para desfazer, copie os dois de volta para `src\lib\`.

---

## Item 1 — Resposta em JSON nativo e resposta cortada tratada como erro

### 1a. JSON nativo do Gemini (`responseMimeType`)

**Problema:** o pedido ao Gemini não pedia JSON de forma nativa. A IA respondia texto livre e o código precisava limpar crases (```json), texto antes/depois e torcer para o JSON vir válido ("A IA devolveu um JSON malformado").

**O que mudei:** em `generationConfig` da chamada ao Gemini, acrescentei `responseMimeType: "application/json"`. Com isso o Gemini devolve **somente JSON válido**. A limpeza antiga (`limparJson`) continua lá como rede de segurança — não foi removida.

**O que não fiz (e por quê):** não adicionei `responseSchema` (o contrato rígido de campos). Os campos do JSON vêm do mapa configurável da tela "Mapeamento & Prompt" e de campos extras do usuário; um schema fixo poderia rejeitar esses campos. Fazer direito exigiria mexer na chamada em `App.tsx` e `MassProcessingPage.tsx`, o que estava fora do pedido.

### 1b. Resposta cortada no limite de tamanho (`MAX_TOKENS`)

**Problema:** quando a resposta da IA batia no limite de tamanho (`maxOutputTokens: 8192`), o Gemini avisava com `finishReason: "MAX_TOKENS"`, mas o código **aceitava em silêncio**. Num PPI com muitos equipamentos (cada um com sua citação), o JSON vinha pela metade: ou dava erro confuso de "JSON malformado", ou — pior — podia ser lido parcialmente com equipamentos faltando.

**O que mudei:** se `finishReason` for `MAX_TOKENS`, agora a extração para com a mensagem clara:
> "A resposta da IA foi cortada no limite de tamanho (MAX_TOKENS) — o JSON veio incompleto e equipamentos poderiam ficar de fora. Tente novamente ou use outro modelo."

Também ajustei a linha que repassa os erros para essa mensagem não ser trocada por "Não foi possível ler o envelope da resposta".

**O que não fiz:** não aumentei o limite de 8192. Alguns modelos da sua lista de reserva (ex.: `gemini-2.0-flash`) só aceitam até 8192 e dariam erro 400 com um valor maior. Se o erro de MAX_TOKENS começar a aparecer com frequência, vale ajustar o limite por modelo.

**Observação:** o caminho do QwenCloud (`qwen.ts`) já pede JSON (`response_format: json_object`) e não foi alterado.

## Item 4 — "Rastreabilidade" vinha pré-preenchida no modelo de resposta

**Problema:** o modelo de JSON enviado no prompt já trazia a rastreabilidade preenchida, por exemplo:
```
"origem_site_id": "Páginas 1, 2 e 3 — carimbo SITE",
"base_em_concreto": "Página 2 e 9 — LEGENDA da Planta Civil/Planta Baixo/Radier"
```
A IA tende a só repetir esse texto. Ou seja, a rastreabilidade exibida no painel não comprovava nada sobre o PDF analisado.

**O que mudei** (em `montarPromptFinal`, `src/lib/mapping.ts`):
- Os 4 campos de `rastreabilidade` no modelo de resposta agora vêm **vazios** (`""`).
- Nas "REGRAS FINAIS" do prompt entrou a regra: *"Em 'rastreabilidade', escreva a página e o item/tabela onde VOCÊ encontrou cada grupo de dados NESTE PDF (ex: "Pág. 1 — carimbo SITE"). Se não encontrou, deixe ""."* A regra seguinte foi renumerada de 2 para 3.

Essa regra foi colocada na parte fixa do prompt (e não nas instruções BTS/COLLO editáveis), para valer também para quem já tem instruções salvas no navegador.

---

## Testes realizados

- `npx tsc --noEmit` (verificação de tipos): sem erros antes e depois das mudanças.
- **Não** testei uma extração real com o Gemini: a chave da API fica salva no seu navegador e eu não tenho acesso a ela.

## Como validar

1. Rode o app (`npm run dev`) e processe 2 ou 3 PPIs que você já conhece (um BTS, um COLLO).
2. Na aba de depuração, confira em "Resposta bruta" que veio JSON puro, sem crases.
3. Confira no painel que a rastreabilidade agora mostra páginas/itens diferentes conforme o PDF.
4. Se algo piorar, restaure pelo backup (seção acima).
5. Para publicar, siga seu fluxo normal (`subir_git.bat`).
