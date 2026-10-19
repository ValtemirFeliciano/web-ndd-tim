# CLI do NDD Forge para o robô fly_automation: 09/10/2026

**Por quê:** o fly_automation tinha uma cópia do NDD Forge em Python. Num teste com o mesmo PPI, essa cópia errou 156 de 293 células; este projeto errou 8. Agora o robô roda **este** código, através de um CLI.

## O que foi adicionado (o app web não mudou)

| Arquivo | O quê |
|---|---|
| `src/cli/ndd-forge-cli.ts` | Ponto de entrada de linha de comando. Chama `extrairDoPdf`, `validarDados` e `gerarNddPreenchido` com a `CONFIG_PADRAO`. |
| `scripts/build-cli.mjs` | Empacota o CLI com esbuild em `dist-cli/ndd-forge-cli.mjs`, copia os templates e grava `VERSAO.json` (branch@commit). |
| `package.json` | Script `build:cli`. |
| `.gitignore` | `dist-cli/`. |
| `tsconfig.json` | `"exclude": ["src/cli"]`: o CLI usa APIs do Node (`node:fs`), e o typecheck do app só tem tipos de navegador. |
| `README.md` | Seção "CLI". |

## Cuidados ao mexer neste projeto daqui pra frente

- `gemini.ts`, `transformers.ts`, `excel.ts` e `mapping.ts` agora são usados também pelo robô. Depois de mudar, rode no robô o `atualizar_ndd_forge.bat`, e antes disso o teste em `Downloads\teste_integracao_ndd_forge\testar_integracao.bat`.
- Não use `window`, `document` ou `localStorage` no nível do módulo nesses arquivos: o CLI roda no Node. (`localStorage` tem um stub vazio no CLI.)
- O `fetch('/templates/...')` do `excel.ts` não é usado pelo CLI, que passa o template como buffer.

Nada foi commitado. Os arquivos novos estão como não rastreados na branch `v2`, junto com as alterações locais que já existiam.

## Atualização (17h40): `--modo livre|schema`

O CLI aceita `--modo schema`, que envia `montarSchemaResposta(cfg)` como `responseSchema`, com a mesma regra do `App.tsx`. O padrão continua `livre`. O robô usa `schema`.
O teste dos 8 PPIs deu a mesma precisão nos dois modos (98,1%). O SCHEMA eliminou as coordenadas em graus/minutos/segundos.

## Atualização (13/10): cascata de modelos em `gemini.ts`

- `MODELOS_FALLBACK_CASCATA` começava pelo `gemini-2.5-flash`. Esse modelo foi descontinuado (404 "no longer available to new users"), embora ainda apareça na listagem da API. A lista agora é `gemini-3.1-flash-lite`, `gemini-flash-lite-latest`, `gemini-3.5-flash`, `gemini-flash-latest`.
- No laço da cascata, um backup que der erro (ex.: 404) é pulado e o próximo é tentado. Antes, a extração abortava, também no app web.
- Testado com a API simulada (503 → 404 → 200) e numa extração real durante um 503.
- **Atenção ao prompt:** os exemplos `SN-RRRSI4` / `MSRBS006_A` em `mapping.ts` (linhas 13, 14, 118 e 119) são IDs reais e a IA às vezes os copia. Sugestão: trocar por IDs fictícios.

## Atualização (14/10): prompt BTS novo + conversão de coordenadas no código

**Prompt BTS** (`mapping.ts`, `INSTRUCOES_PADRAO` = `INSTRUCOES_BTS`): passa a ser o prompt "v1" do Valtemir, **completo**.
`montarPromptFinal` envia esse texto exatamente como está, sem os blocos antigos; campos personalizados do mapa entram no fim como "CAMPOS ADICIONAIS".

Diferenças em relação ao v1 testado:
- exemplos fictícios (`XXXXX000_A`, `SN-XXXXX0`, `BR-000 Km 000+000`, "Vila Exemplo"/"Cidade Exemplo"), porque IDs reais em exemplo eram copiados pela IA;
- campo SITE aceita os dois layouts do carimbo: duas linhas ou uma linha `DETENTORA_OPERADORA`. Sem isso, o SRRSI5 saía com ID TIM `MSRTD006_B_SN-SRRSI5` e ID Winity `Winity`;
- coordenadas copiadas como impressas, sem a IA converter. A conversão da IA errava (ex.: NDISH6 `-21.41` em vez de `-21.68`).

**Migração do localStorage:**
- prompt BTS salvo no formato antigo (sem o marcador `MÉTODO ANTI-ALUCINAÇÃO (CITAÇÃO OBRIGATÓRIA)`) é trocado pelo novo;
- prompt novo editado na tela é mantido. Antes, a migração descartaria qualquer edição.

**COLLO não mudou.** Exemplos reais também saíram das dicas dos campos (`DESCRICOES_CAMPOS`) e do JSON de exemplo da tela (`App.tsx`).

**Conversão no código** (`gemini.ts`):
- `normalizarCoordenada`: graus/min/seg, graus/min decimais ou decimal com símbolo solto (`"`, `°`, `'`) viram decimal com 6 casas. S, W e O dão sinal negativo. Longitude positiva sem letra vira negativa (Brasil). Latitude sem letra é mantida e gera aviso no log. Formato desconhecido é mantido como veio.
- `normalizarAltura`: `40,00m` → `40`.
- Testado com 29 casos, incluindo todos os formatos vistos nos testes.

**Validação** (8 PPIs × 2 execuções, SCHEMA, só erros de valor fora de ID):

| Prompt | Erros de valor |
|---|---|
| Anterior | 12 e 7 |
| Novo | 4 e 8 |
| Novo, coordenadas | 0 |

Detalhes em `Downloads\teste_prompt_gemini\README.md`. Backup dos arquivos anteriores: `backup_prompt_v1_2026-10-14\`.
