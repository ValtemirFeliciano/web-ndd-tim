# Templates do NDD Forge

Esta pasta contém os modelos de planilha usados pelo sistema.

## Arquivos

- **`NDD-padrao.xlsx`** — Template padrão do NDD (Nova Demanda de Disponibilidade)
  - Usado automaticamente quando nenhum template é enviado no passo 02
  - Contém o layout completo: cabeçalho, tabela de equipamentos, formatação
  - Você pode **editar este arquivo diretamente no Excel** e salvar aqui
  - O sistema recarrega automaticamente na próxima execução

## Como personalizar

1. Abra `NDD-padrao.xlsx` no Excel
2. Ajuste formatação, cores, bordas, fórmulas conforme necessário
3. Salve mantendo o mesmo nome (`NDD-padrao.xlsx`)
4. Recarregue o NDD Forge no navegador — o novo template será usado

## Notas

- A aba deve se chamar **"NDD"** (ou o sistema usa a primeira aba encontrada)
- Fórmulas compartilhadas são reparadas automaticamente (evita erros do ExcelJS)
- Se o template tiver gráficos/macros/proteção, o sistema ativa o modo de segurança automaticamente
- Para usar um template diferente sem substituir este, envie-o no passo 02 da interface
