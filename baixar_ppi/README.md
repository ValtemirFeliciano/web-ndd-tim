# baixar_ppi

Baixa o PPI de um site no Sytex, pelo código do site (ID Winity, ex.: `BABRR002`).

## Uso

```bash
py baixar_ppi.py BABRR002
py baixar_ppi.py BABRR002 --candidato C --destino "C:/pasta/do/site" --extrair
```

| Opção | O que faz |
|---|---|
| `site` | Código do site no Sytex (obrigatório) |
| `--candidato` | Letra do candidato (A, B, C…). Sem ela, baixa o PPI de todos os candidatos, cada um numa subpasta `A/`, `B/`, `C/` |
| `--destino` | Pasta onde salvar. Padrão: `./ppi/<SITE>` |
| `--extrair` | Extrai `.rar`/`.zip` com o 7-Zip e devolve a lista de PDFs |

## Como ele acha o PPI

1. Sites com o código informado (cada candidato é um site com o mesmo código).
2. Tarefas desses sites chamadas exatamente **PPI**.
3. Na tarefa, o documento obrigatório **PPI**, cujo arquivo é baixado.

## Saída (stdout, JSON)

```json
{
  "ok": true,
  "site": "BABRR002",
  "nome_site": "BACTI",
  "candidato_pedido": null,
  "ppis": [
    {
      "candidato": "C",
      "site_id": "470829",
      "tarefa": "TA-26-86430",
      "status_tarefa": "Completed",
      "link_tarefa": "https://app.sytex.io/...",
      "documento": "FD-26-1070076",
      "status_documento": "Completed",
      "arquivo": "C:\\...\\BABRR002-C_BACTI_PPI_Rev02.rar",
      "tamanho_bytes": 10687218,
      "pdfs": ["C:\\...\\BABRR002-C_BACTI_PPI_Rev02.pdf"]
    }
  ],
  "avisos": ["TA-25-1248452 (candidato B): PPI sem arquivo (...)"]
}
```

Quando falha: `"ok": false` e o motivo em `"erro"`.

## Código de saída

| Código | Significado |
|---|---|
| 0 | Ao menos um PPI baixado |
| 1 | Nenhum PPI baixado (site inexistente, sem tarefa PPI, ou PPI ainda sem arquivo) |
| 2 | Erro de ambiente (CLI `sytex` ausente, sem acesso, falha de conexão) |

## Requisitos

- Python 3.8+ (só biblioteca padrão)
- CLI `sytex` instalado e autenticado neste computador (o bot usa esse acesso)
- 7-Zip em `C:\Program Files\7-Zip` (somente para `--extrair`)
