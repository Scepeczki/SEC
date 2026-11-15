@echo off
chcp 65001 >nul
title Park Wymarlych
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo Brak Node.js. Zainstaluj go ze strony https://nodejs.org i uruchom ponownie.
  pause
  exit /b 1
)

netstat -ano | findstr /R /C:":47321 .*LISTENING" >nul
if not errorlevel 1 (
  echo Gra juz dziala - otwieram przegladarke.
  start "" http://localhost:47321
  timeout /t 3 >nul
  exit /b 0
)

if not exist node_modules (
  echo Pierwsze uruchomienie - instaluje potrzebne pakiety, chwilke...
  call npm install --no-fund --no-audit
)

echo.
echo  Park Wymarlych startuje - gra otworzy sie w przegladarce.
echo  Adres: http://localhost:47321
echo  NIE zamykaj tego okna podczas gry. Aby wylaczyc gre, zamknij to okno.
echo.
call npx vite --open
pause
