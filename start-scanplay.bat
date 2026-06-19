@echo off
setlocal enabledelayedexpansion
chcp 65001 >nul
title ScanPlay - Dev Server
cd /d "%~dp0"

echo.
echo  ========================================
echo   ScanPlay - Installation et demarrage
echo  ========================================
echo.

where node >nul 2>&1
if errorlevel 1 (
    echo [ERREUR] Node.js n'est pas installe ou pas dans le PATH.
    echo.
    echo Telechargez Node.js LTS : https://nodejs.org/
    echo Puis redemarrez Visual Studio et relancez ce script.
    echo.
    pause
    exit /b 1
)

where npm >nul 2>&1
if errorlevel 1 (
    echo [ERREUR] npm introuvable. Reinstallez Node.js depuis https://nodejs.org/
    pause
    exit /b 1
)

echo Node: 
node -v
echo npm:  
npm -v
echo.
echo Dossier: %CD%
echo.

if not exist ".env" (
    echo [INFO] Fichier .env introuvable — creation depuis scanplay.env.example...
    copy /Y "scanplay.env.example" ".env" >nul
)

echo Configuration Supabase ^(.env^) :
if exist ".env" (
    echo   Fichier : %CD%\.env
    findstr /C:"VITE_SUPABASE_ANON_KEY=" ".env" | findstr /V "colle_ta_cle" >nul
    if errorlevel 1 (
        echo   [ATTENTION] Ajoute ta cle anon Supabase dans .env
        echo   Ouvre le fichier, colle la cle, enregistre, puis relance.
        echo.
        echo   Ouverture de .env dans Notepad...
        start "" notepad "%CD%\.env"
        echo.
        pause
    ) else (
        echo   Cle anon detectee — OK
    )
) else (
    echo   [ERREUR] Impossible de creer .env
)
echo.

echo Installation des dependances...
call npm install
if errorlevel 1 (
    echo.
    echo [ERREUR] npm install a echoue.
    pause
    exit /b 1
)

echo.
echo Demarrage du serveur (Ctrl+C pour arreter)...
echo PC : http://localhost:5173
echo.
echo  Sur ton telephone (meme Wi-Fi) :
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /c:"IPv4"') do (
    set "IP=%%a"
    set "IP=!IP:~1!"
    echo  http://!IP!:5173
)
echo.
echo Si ca ne marche pas : autorisez Node.js dans le pare-feu Windows.
echo.

start "" cmd /c "timeout /t 2 /nobreak >nul & start http://localhost:5173/"

call npm run dev

pause
