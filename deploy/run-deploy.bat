@echo off
setlocal EnableDelayedExpansion
chcp 65001 > nul
title ModoSabor → Oracle Cloud Deploy

set "KEY=D:\Proyectos\modosabor1\deploy\oci.key"
set "VM=ubuntu@136.248.108.127"
set "PROJECT=D:\Proyectos\modosabor1"
set "ZIP=%PROJECT%\deploy\modosabor-deploy.zip"
set "SSH=C:\Program Files\Git\usr\bin\ssh.exe"
set "SCP=C:\Program Files\Git\usr\bin\scp.exe"

echo.
echo ================================================
echo   ModoSabor - Deploy a Oracle Cloud
echo ================================================
echo.

:: Verificar que existe la clave SSH
if not exist "%KEY%" (
  echo [ERROR] No se encontro la clave SSH.
  echo Ruta esperada: %KEY%
  pause
  exit /b 1
)
echo [1/4] Clave SSH encontrada OK

:: Crear ZIP del proyecto sin node_modules ni dist
echo [2/4] Creando ZIP del proyecto...
del /f /q "%ZIP%" 2>nul
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$src = '%PROJECT%'.Replace('\','\\');" ^
  "$out = '%ZIP%'.Replace('\','\\');" ^
  "Add-Type -Assembly System.IO.Compression.FileSystem;" ^
  "$zip = [IO.Compression.ZipFile]::Open($out, 'Create');" ^
  "Get-ChildItem $src -Recurse -File | Where-Object {" ^
  "  $_.FullName -notmatch '\\\\node_modules\\\\' -and" ^
  "  $_.FullName -notmatch '\\\\dist\\\\' -and" ^
  "  $_.FullName -notmatch '\\\\.git\\\\' -and" ^
  "  $_.FullName -notmatch '\\\\template_base\\\\' -and" ^
  "  $_.Name -ne 'modosabor-deploy.zip'" ^
  "} | ForEach-Object {" ^
  "  $rel = $_.FullName.Substring($src.Length + 1);" ^
  "  [IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, $_.FullName, $rel) | Out-Null" ^
  "};" ^
  "$zip.Dispose();" ^
  "Write-Host 'ZIP listo:' $out"

if not exist "%ZIP%" (
  echo [ERROR] Fallo la creacion del ZIP.
  pause
  exit /b 1
)
echo [2/4] ZIP creado OK

:: Subir ZIP a la VM
echo [3/4] Subiendo a Oracle Cloud ^(puede tardar 1-2 min^)...
"%SCP%" -i "%KEY%" -o StrictHostKeyChecking=no -o UserKnownHostsFile=nul "%ZIP%" "%VM%:/tmp/modosabor-deploy.zip"
if errorlevel 1 (
  echo [ERROR] Fallo la subida. Verifica que el puerto 22 este abierto en OCI.
  pause
  exit /b 1
)
echo [3/4] Proyecto subido OK

:: Configurar e instalar todo en la VM
echo [4/4] Instalando y configurando el servidor...
"%SSH%" -i "%KEY%" -o StrictHostKeyChecking=no -o UserKnownHostsFile=nul "%VM%" "bash -s" << HEREDOC
set -e
echo '==> Preparando directorios...'
sudo mkdir -p /var/www/modosabor /opt/modosabor/data/uploads /opt/modosabor/data/backups /opt/modosabor/data/logs
sudo chown -R $USER:$USER /var/www/modosabor /opt/modosabor

echo '==> Extrayendo proyecto...'
sudo apt-get install -y unzip -qq 2>/dev/null
mkdir -p /tmp/modosabor
unzip -o /tmp/modosabor-deploy.zip -d /tmp/modosabor -q

echo '==> Instalando Node.js 22...'
if ! node --version 2>/dev/null | grep -q 'v22'; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash - -q
  sudo apt-get install -y nodejs -qq
fi
echo "Node $(node -v)"

echo '==> Instalando nginx y PM2...'
sudo apt-get install -y nginx -qq
sudo npm install -g pm2 -q

echo '==> Copiando archivos del servidor...'
cp -r /tmp/modosabor/server/* /var/www/modosabor/server/ 2>/dev/null || true
cp -r /tmp/modosabor/server /var/www/modosabor/ 2>/dev/null || true
cp /tmp/modosabor/deploy/.env.production /var/www/modosabor/server/.env

echo '==> Instalando dependencias del servidor...'
cd /var/www/modosabor/server
npm install --omit=dev -q

echo '==> Compilando frontend React...'
cp -r /tmp/modosabor/client /var/www/modosabor/
cd /var/www/modosabor/client
npm install -q
VITE_API_URL="" npm run build -q

echo '==> Configurando nginx...'
sudo cp /tmp/modosabor/deploy/nginx.conf /etc/nginx/sites-available/modosabor
sudo ln -sf /etc/nginx/sites-available/modosabor /etc/nginx/sites-enabled/modosabor
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl restart nginx && sudo systemctl enable nginx

echo '==> Iniciando servidor con PM2...'
cp /tmp/modosabor/deploy/ecosystem.config.js /var/www/modosabor/server/
cd /var/www/modosabor/server
pm2 delete modosabor-server 2>/dev/null || true
pm2 start ecosystem.config.js --env production
pm2 save
sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u $USER --hp $HOME 2>/dev/null || true

echo ''
echo '============================================'
echo '  LISTO! ModoSabor corriendo en produccion'
echo '  http://136.248.108.127'
echo '============================================'
HEREDOC

if errorlevel 1 (
  echo [ERROR] Fallo la instalacion remota.
  pause
  exit /b 1
)

echo.
echo ================================================
echo  DEPLOY COMPLETADO!
echo  Tu app esta en: http://136.248.108.127
echo  Login: exuz27@gmail.com / ModoSabor2026!
echo ================================================
echo.
pause
