@echo off
rem Abre Paso a Paso con Chrome o Edge (no hay que instalar nada mas)
cd /d "%~dp0"
set "NAV="
if exist "%ProgramFiles%\Google\Chrome\Application\chrome.exe" set "NAV=%ProgramFiles%\Google\Chrome\Application\chrome.exe"
if not defined NAV if exist "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" set "NAV=%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
if not defined NAV if exist "%LocalAppData%\Google\Chrome\Application\chrome.exe" set "NAV=%LocalAppData%\Google\Chrome\Application\chrome.exe"
if not defined NAV if exist "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" set "NAV=%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"
if not defined NAV if exist "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe" set "NAV=%ProgramFiles%\Microsoft\Edge\Application\msedge.exe"
if not defined NAV goto sinnavegador
set "PAGINA=%~dp0index.html"
start "" "%NAV%" --allow-file-access-from-files --user-data-dir="%TEMP%\PasoAPaso-perfil" --no-first-run --no-default-browser-check "file:///%PAGINA:\=/%"
exit /b 0
:sinnavegador
echo No se encontro Google Chrome ni Microsoft Edge en este computador.
echo Instala uno de los dos y vuelve a abrir este archivo.
pause
