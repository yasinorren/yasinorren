@echo off
echo ====================================================
echo AI Analytics Pro - Windows EXE Build Script
echo ====================================================
echo.

REM Sanal ortam kur (isteğe bağlı)
REM python -m venv venv
REM call venv\Scripts\activate

echo [1/3] Bağımlılıklar yükleniyor...
pip install -r requirements.txt

echo.
echo [2/3] EXE derleniyor (PyInstaller)...
pyinstaller --clean build.spec

echo.
echo [3/3] Derleme tamamlandı!
echo Çıktı: dist\AIAnalyticsPro.exe
echo.
pause
