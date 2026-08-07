@echo off
REM ============================================================
REM Integra Escolar - Iniciar servidor
REM Duplo clique neste arquivo liga o sistema, sem precisar abrir
REM terminal nem digitar comando nenhum.
REM ============================================================

cd /d "%~dp0"

if not exist venv\Scripts\activate.bat (
    echo [ERRO] Ambiente virtual "venv" nao encontrado nesta pasta.
    echo Rode a configuracao inicial primeiro ^(python -m venv venv...^).
    pause
    exit /b 1
)

call venv\Scripts\activate.bat

echo.
echo Iniciando o servidor... deixe esta janela aberta durante a apresentacao.
echo Depois de aparecer "Running on http://127.0.0.1:5000", abra essa URL no navegador.
echo.

python app.py

echo.
echo O servidor foi encerrado.
pause
