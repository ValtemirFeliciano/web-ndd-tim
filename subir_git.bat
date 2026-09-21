@echo off
cd /d "%~dp0"
echo =======================================================
echo    ATUALIZANDO REPOSITORIO GITHUB (branch v2)
echo =======================================================
echo.
echo [1/4] Adicionando todos os arquivos alterados...
git add -A
git status
echo.
echo [2/4] Criando commit (se houver novas alteracoes)...
git diff --cached --quiet || git commit -m "feat: suporte BTS/COLLO e expansao do layout widescreen com tabela espacosa"
echo.
echo [3/4] Sincronizando com o GitHub (git pull --rebase --autostash)...
git pull --rebase --autostash origin v2
echo.
echo [4/4] Enviando para o GitHub (origin v2)...
git push origin v2
echo.
if %errorlevel% equ 0 (
    echo =======================================================
    echo    ATUALIZACAO ENVIADA COM SUCESSO PARA O GITHUB!
    echo =======================================================
) else (
    echo =======================================================
    echo    Ocorreu um erro ao enviar para o GitHub.
    echo    Verifique suas credenciais de acesso ou conexao.
    echo =======================================================
)
echo.
pause
