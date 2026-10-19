"""
Bot: baixa o PPI de um site no Sytex.

Uso:
    py baixar_ppi.py BABRR002
    py baixar_ppi.py BABRR002 --candidato C --destino "C:/fila/03_Pronto_para_Envio/minha_pasta" --extrair

Fluxo:
    1. Acha os sites (candidatos A, B, C...) com o código informado.
    2. Acha nesses sites a tarefa chamada "PPI".
    3. Na tarefa, pega o documento "PPI" e baixa o arquivo.
    4. (opcional) Extrai o .rar/.zip com o 7-Zip e lista os PDFs.

Saída: um JSON no stdout (para outro bot ler). Código de saída 0 = ao menos
um PPI baixado; 1 = nenhum PPI baixado; 2 = erro de uso/ambiente.

Requisitos: Python 3.8+, CLI `sytex` autenticado neste computador,
7-Zip (somente para --extrair).
"""

import argparse
import json
import os
import re
import shutil
import subprocess
import sys
import unicodedata

NOME_TAREFA = "PPI"
NOME_DOCUMENTO = "PPI"
SETE_ZIP_PADRAO = [
    r"C:\Program Files\7-Zip\7z.exe",
    r"C:\Program Files (x86)\7-Zip\7z.exe",
]
SYTEX_PADRAO = [
    os.path.expanduser(r"~\.local\bin\sytex.exe"),
    os.path.expanduser(r"~\.local\bin\sytex"),
    r"C:\Users\ValtemirJunior\.local\bin\sytex.exe",
]


class ErroSytex(Exception):
    pass


def normalizar(texto):
    """Minúsculas, sem acento e sem espaços nas pontas, para comparar nomes."""
    texto = unicodedata.normalize("NFKD", texto or "")
    return "".join(c for c in texto if not unicodedata.combining(c)).strip().lower()


def sytex(*args):
    """Executa o CLI do Sytex e devolve o JSON da resposta."""
    exe = shutil.which("sytex")
    if not exe:
        for caminho in SYTEX_PADRAO:
            if os.path.isfile(caminho):
                exe = caminho
                break
    if not exe:
        raise ErroSytex("CLI 'sytex' não encontrado no PATH nem em ~/.local/bin.")
    proc = subprocess.run(
        [exe, *args, "--output", "json"],
        capture_output=True, text=True, encoding="utf-8", errors="replace",
    )
    try:
        dados = json.loads(proc.stdout) if proc.stdout.strip() else {}
    except json.JSONDecodeError:
        raise ErroSytex(f"Resposta inválida do Sytex: {proc.stdout[:300]} {proc.stderr[:300]}")
    if proc.returncode != 0 or (isinstance(dados, dict) and "error" in dados):
        erro = dados.get("error", {}) if isinstance(dados, dict) else {}
        raise ErroSytex(erro.get("message") or proc.stderr.strip() or "Erro desconhecido no Sytex.")
    return dados


def buscar_sites(codigo):
    """Todos os sites (candidatos) cujo código é exatamente o informado."""
    dados = sytex("sites", "search", "--query", codigo)
    return [r for r in dados.get("results", []) if (r.get("code") or "").upper() == codigo.upper()]


def buscar_tarefas_ppi(ids_sites):
    # Lista as tarefas dos sites e filtra pelo nome aqui: a busca por texto
    # do Sytex (--query) às vezes não devolve a tarefa.
    filtros = ["tasks", "list", "--sites", ",".join(ids_sites), "--fields", "id,code,name,status.name,sites,_web_url"]
    dados = sytex(*filtros, "--limit", "100")
    tarefas = dados.get("results", [])
    if (dados.get("count") or 0) > len(tarefas):
        dados = sytex(*filtros, "--all")
        if isinstance(dados, dict) and dados.get("spilled_to"):
            with open(dados["spilled_to"], encoding="utf-8") as f:
                dados = json.load(f)
        tarefas = dados.get("results", []) if isinstance(dados, dict) else dados
    return [t for t in tarefas if normalizar(t.get("name")) == normalizar(NOME_TAREFA)]


def documento_ppi(id_tarefa):
    dados = sytex(
        "task-documents", "list", "--task", str(id_tarefa), "--limit", "100",
        "--fields", "_doc_req__name,document.id,document.code,document.name,document.status.name",
    )
    for td in dados.get("results", []):
        doc = td.get("document")
        nome = td.get("_doc_req__name") or (doc or {}).get("name")
        if doc and normalizar(nome) == normalizar(NOME_DOCUMENTO):
            return doc
    return None


def candidato_da_tarefa(tarefa, ids_sites):
    for s in tarefa.get("sites") or []:
        if isinstance(s, dict) and str(s.get("id")) in ids_sites:
            return s.get("code_suffix") or "", str(s.get("id"))
    return "", ""


def achar_7zip():
    exe = shutil.which("7z")
    if exe:
        return exe
    for caminho in SETE_ZIP_PADRAO:
        if os.path.isfile(caminho):
            return caminho
    return None


def extrair(arquivo, pasta_saida):
    """Extrai .rar/.zip/.7z com o 7-Zip e devolve a lista de PDFs extraídos."""
    exe = achar_7zip()
    if not exe:
        raise RuntimeError("7-Zip não encontrado; não foi possível extrair.")
    os.makedirs(pasta_saida, exist_ok=True)
    proc = subprocess.run(
        [exe, "x", "-y", f"-o{pasta_saida}", arquivo],
        capture_output=True, text=True, encoding="utf-8", errors="replace",
    )
    if proc.returncode != 0:
        raise RuntimeError(f"Falha ao extrair: {proc.stderr.strip() or proc.stdout.strip()[-300:]}")
    pdfs = []
    for raiz, _, arquivos in os.walk(pasta_saida):
        pdfs += [os.path.abspath(os.path.join(raiz, a)) for a in arquivos if a.lower().endswith(".pdf")]
    return sorted(pdfs)


def baixar_ppi(codigo_site, candidato=None, destino=None, extrair_arquivo=False):
    codigo_site = codigo_site.strip().upper()
    candidato = (candidato or "").strip().upper() or None
    destino = os.path.abspath(destino or os.path.join("ppi", codigo_site))
    resultado = {"ok": False, "site": codigo_site, "candidato_pedido": candidato, "ppis": [], "avisos": []}

    sites = buscar_sites(codigo_site)
    if not sites:
        resultado["erro"] = f"Site {codigo_site} não encontrado no Sytex."
        return resultado
    ids_sites = [str(s["id"]) for s in sites]
    resultado["nome_site"] = sites[0].get("name")

    tarefas = buscar_tarefas_ppi(ids_sites)
    if not tarefas:
        resultado["erro"] = f"Nenhuma tarefa '{NOME_TAREFA}' encontrada para o site {codigo_site}."
        return resultado

    for tarefa in tarefas:
        letra, id_site = candidato_da_tarefa(tarefa, ids_sites)
        if candidato and letra.upper() != candidato:
            continue
        item = {
            "candidato": letra,
            "site_id": id_site,
            "tarefa": tarefa.get("code"),
            "status_tarefa": (tarefa.get("status") or {}).get("name"),
            "link_tarefa": tarefa.get("_web_url"),
        }
        doc = documento_ppi(tarefa["id"])
        if not doc:
            resultado["avisos"].append(f"{tarefa.get('code')} (candidato {letra}): tarefa sem documento PPI.")
            continue
        item["documento"] = doc.get("code")
        item["status_documento"] = (doc.get("status") or {}).get("name")

        pasta = os.path.join(destino, letra) if not candidato and letra else destino
        os.makedirs(pasta, exist_ok=True)
        try:
            baixado = sytex("file-documents", "download", str(doc["id"]), "--to", pasta)
        except ErroSytex as e:
            resultado["avisos"].append(f"{tarefa.get('code')} (candidato {letra}): PPI sem arquivo ({e}).")
            continue
        item["arquivo"] = os.path.abspath(baixado.get("path") or os.path.join(pasta, baixado.get("filename", "")))
        item["tamanho_bytes"] = baixado.get("size_bytes")

        if extrair_arquivo:
            if item["arquivo"].lower().endswith(".pdf"):
                item["pdfs"] = [item["arquivo"]]
            else:
                try:
                    nome_base = os.path.splitext(os.path.basename(item["arquivo"]))[0]
                    item["pdfs"] = extrair(item["arquivo"], os.path.join(pasta, nome_base))
                except RuntimeError as e:
                    resultado["avisos"].append(str(e))
        resultado["ppis"].append(item)

    if not resultado["ppis"]:
        quem = f" (candidato {candidato})" if candidato else ""
        resultado["erro"] = f"Nenhum PPI com arquivo encontrado para {codigo_site}{quem}."
    resultado["ok"] = bool(resultado["ppis"])
    return resultado


def main():
    parser = argparse.ArgumentParser(description="Baixa o PPI de um site no Sytex.")
    parser.add_argument("site", help="Código do site no Sytex (ID Winity), ex.: BABRR002")
    parser.add_argument("--candidato", help="Letra do candidato (A, B, C...). Sem ela, baixa de todos.")
    parser.add_argument("--destino", help="Pasta onde salvar. Padrão: ./ppi/<SITE>")
    parser.add_argument("--extrair", action="store_true", help="Extrai .rar/.zip com 7-Zip e lista os PDFs.")
    args = parser.parse_args()

    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    try:
        resultado = baixar_ppi(args.site, args.candidato, args.destino, args.extrair)
    except ErroSytex as e:
        print(json.dumps({"ok": False, "site": args.site, "erro": str(e)}, ensure_ascii=False, indent=2))
        sys.exit(2)
    print(json.dumps(resultado, ensure_ascii=False, indent=2))
    sys.exit(0 if resultado["ok"] else 1)


if __name__ == "__main__":
    main()
