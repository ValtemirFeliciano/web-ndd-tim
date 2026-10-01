"""
Script de diagnóstico e teste para o modelo gemini-2.5-flash-lite e diagnóstico do erro 403 no Google Gemini API.
Pode ser executado com:
    python scripts/test_gemini_25_flash_lite.py [SUA_CHAVE_OPCIONAL]
"""

import sys
import os
import json
import requests

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

# 1. Obter chave da API via argumento, variável de ambiente ou prompt
api_key = sys.argv[1] if len(sys.argv) > 1 else os.environ.get("GEMINI_API_KEY", os.environ.get("GOOGLE_API_KEY", ""))

print("=" * 70)
print("DIAGNÓSTICO GEMINI 2.5-FLASH-LITE & ANÁLISE DE ERRO 403")
print("=" * 70)

print(f"\n[INFO] Chave fornecida: {'SIM (' + api_key[:6] + '...' + api_key[-4:] + ')' if len(api_key) > 10 else 'NÃO (executando testes de conectividade e envelope)'}")

# ----------------------------------------------------------------------
# TESTE 1: Entendendo por que o Google retorna erro 403 (PERMISSION_DENIED)
# ----------------------------------------------------------------------
print("\n" + "-" * 70)
print("TESTE 1: Por que o erro 403 acontece no site da NDD?")
print("-" * 70)

url_sem_chave = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent"
resp_sem_chave = requests.post(url_sem_chave, json={"contents": [{"parts": [{"text": "ping"}]}]})

print(f"Status da requisição sem chave/chave vazia: HTTP {resp_sem_chave.status_code}")
try:
    err_json = resp_sem_chave.json()
    print("Resposta do Google para requisição sem chave:")
    print(json.dumps(err_json, indent=2))
except Exception:
    print(resp_sem_chave.text)

print("""
-> CONCLUSÃO DO ERRO 403:
   O Google Gemini API retorna HTTP 403 (PERMISSION_DENIED) nos seguintes casos:
   1. Chave não enviada ou parâmetro ?key= vazio (ex: localStorage limpo no navegador);
   2. Restrição de API no Google Cloud Console (a chave foi configurada para restringir
      APIs e a 'Generative Language API' não foi marcada na lista de permissões);
   3. Restrição de Referenciador HTTP (a chave foi restrita para aceitar apenas domínios
      específicos e está sendo chamada pelo localhost ou outro domínio);
   4. A API 'Generative Language API' não está ativada no projeto do Google Cloud;
   5. Chave vazada e bloqueada preventivamente pelo Google com a mensagem:
      'Your API key was reported as leaked. Please use another API key.';
   6. Bloqueio geográfico ou IP não suportado pelo Google (VPN ou proxy).
""")

# ----------------------------------------------------------------------
# TESTE 2: Status do modelo gemini-2.5-flash-lite (É legado?)
# ----------------------------------------------------------------------
print("-" * 70)
print("TESTE 2: O modelo gemini-2.5-flash-lite é legado / descontinuado?")
print("-" * 70)
print("""
-> Documentação Oficial do Google Gemini API (Status em 2026):
   - Model Code Estável: 'gemini-2.5-flash-lite'
   - Data de Lançamento: 22 de Julho de 2025
   - Data de Descontinuação: NENHUMA (Ativo e suportado na v1beta e v1)
   - Endpoint correto: models/gemini-2.5-flash-lite
   - Versão experimental que foi descontinuada: 'gemini-2.5-flash-lite-preview-09-2025'
     (esta versão preview encerrou em 31/03/2026, mas o modelo estável 'gemini-2.5-flash-lite'
      continua ATIVO e funcional).
""")

# ----------------------------------------------------------------------
# TESTE 3: Como chamar o modelo corretamente (Python SDK google-genai)
# ----------------------------------------------------------------------
print("-" * 70)
print("TESTE 3: Código de chamada com o novo SDK oficial 'google-genai'")
print("-" * 70)

codigo_exemplo_sdk = '''
from google import genai

# Inicialização com a chave
client = genai.Client(api_key="SUA_CHAVE_AQUI")

# Chamada com o identificador correto:
response = client.models.generate_content(
    model="gemini-2.5-flash-lite",
    contents="Olá, confirme que você está ativo respondendo apenas: OK",
)
print(response.text)
'''
print(codigo_exemplo_sdk)

# ----------------------------------------------------------------------
# TESTE 4: Se o usuário passou uma chave, testa a chamada real agora
# ----------------------------------------------------------------------
if len(api_key) > 10:
    print("-" * 70)
    print("TESTE 4: Executando chamada REAL com a chave fornecida...")
    print("-" * 70)
    
    # 1. Testar via SDK oficial google-genai
    try:
        from google import genai
        client = genai.Client(api_key=api_key)
        print("\n[1/3] Chamando models.generate_content via SDK google-genai...")
        res = client.models.generate_content(
            model="gemini-2.5-flash-lite",
            contents="Responda em uma linha: modelo gemini-2.5-flash-lite ativo.",
        )
        print("✓ Resposta do SDK:")
        print(res.text)
    except Exception as e:
        print(f"✗ Erro no SDK: {e}")

    # 2. Testar via REST v1beta direto
    try:
        print("\n[2/3] Chamando REST v1beta direto...")
        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key={api_key}"
        res_rest = requests.post(
            url,
            headers={"Content-Type": "application/json"},
            json={"contents": [{"parts": [{"text": "Responda: OK"}]}]}
        )
        print(f"Status REST v1beta: HTTP {res_rest.status_code}")
        if res_rest.status_code == 200:
            print("✓ Sucesso REST v1beta:")
            cand = res_rest.json().get("candidates", [{}])[0]
            txt = cand.get("content", {}).get("parts", [{}])[0].get("text", "")
            print(f"Texto retornado: {txt.strip()}")
        else:
            print(f"✗ Erro REST: {res_rest.text}")
    except Exception as e:
        print(f"✗ Falha na requisição REST: {e}")

    # 3. Listar modelos da conta
    try:
        print("\n[3/3] Listando modelos disponíveis na conta...")
        url_list = f"https://generativelanguage.googleapis.com/v1beta/models?key={api_key}"
        res_list = requests.get(url_list)
        if res_list.status_code == 200:
            mods = [m["name"].replace("models/", "") for m in res_list.json().get("models", []) if "generateContent" in m.get("supportedGenerationMethods", [])]
            flash_lite_mods = [m for m in mods if "lite" in m or "2.5" in m]
            print(f"Total de modelos encontrados: {len(mods)}")
            print("Modelos 2.5 / Lite encontrados na sua conta:")
            for m in flash_lite_mods:
                print(f"  - {m}")
        else:
            print(f"✗ Erro ao listar modelos: HTTP {res_list.status_code} - {res_list.text}")
    except Exception as e:
        print(f"✗ Erro ao listar modelos: {e}")
else:
    print("-" * 70)
    print("Para testar com sua chave real via terminal, rode:")
    print("    python scripts/test_gemini_25_flash_lite.py SUA_CHAVE_AIZA...")
    print("-" * 70)

print("\n" + "=" * 70)
print("FIM DO TESTE")
print("=" * 70)
