@echo off
echo Iniciando Sistema RU - UNIFESP...

echo Subindo Hardhat Node...
start "Hardhat Node" cmd /k "cd hardhat && npx hardhat node"

timeout /t 3 /nobreak > nul

echo Fazendo deploy do contrato...
start "Deploy" cmd /k "cd hardhat && npx hardhat run scripts/deploy-credito-ru.ts --network localhost && echo Deploy concluido! && pause"

timeout /t 8 /nobreak > nul

echo Subindo servidores (com auto-reload)...
start "Portal UNIFESP" cmd /k "npx tsx watch src/issuer-agent/server.ts"
start "Carteira Aluno" cmd /k "npx tsx watch src/holder-agent/server.ts"
start "Terminal RU" cmd /k "npx tsx watch src/verifier/server.ts"

echo Subindo ngrok...
start "ngrok" cmd /k "%LOCALAPPDATA%\Microsoft\WinGet\Packages\Ngrok.Ngrok_Microsoft.Winget.Source_8wekyb3d8bbwe\ngrok.exe http 3002"

echo Aguardando ngrok iniciar...
timeout /t 5 /nobreak > nul

echo.
echo ================================
echo   SISTEMA RU - UNIFESP ATIVO
echo ================================
echo Portal UNIFESP:  http://localhost:3000
echo Carteira Aluno:  http://localhost:3001/aluno/[RA]
echo Terminal RU:     http://localhost:3002
echo.

REM Busca URL do ngrok via API local
curl -s http://127.0.0.1:4040/api/tunnels > %TEMP%\ngrok.json 2>nul
for /f "tokens=*" %%a in ('node -e "const f=require('fs');try{const d=JSON.parse(f.readFileSync('%TEMP%\\ngrok.json','utf8'));const t=d.tunnels.find(x=>x.proto==='https');console.log('Terminal RU (celular): '+t.public_url);}catch(e){console.log('ngrok: aguarde e acesse http://127.0.0.1:4040');}"') do echo %%a

echo.
pause