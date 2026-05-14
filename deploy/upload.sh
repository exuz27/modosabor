#!/bin/bash
# ============================================================
# upload.sh — Sube ModoSabor a Oracle Cloud y lo instala
# Ejecutar desde Git Bash en Windows:
#   bash "D:/Proyectos/modosabor1/deploy/upload.sh"
# ============================================================

set -e

KEY="$USERPROFILE/Downloads/ssh-key-2026-05-14.key"
VM="ubuntu@136.248.108.127"
PROJECT="D:/Proyectos/modosabor1"
ZIP="$PROJECT/deploy/modosabor-deploy.zip"

echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║        ModoSabor → Oracle Cloud Upload              ║"
echo "╚══════════════════════════════════════════════════════╝"
echo ""

# Verificar que existe la clave SSH
if [ ! -f "$KEY" ]; then
  echo "❌ No se encontró la clave SSH en: $KEY"
  echo "   Ponla en tu carpeta Descargas y vuelve a ejecutar."
  exit 1
fi
chmod 600 "$KEY"
echo "✅ Clave SSH encontrada"

# Crear ZIP del proyecto (sin node_modules ni dist)
echo ""
echo "📦 Creando archivo ZIP del proyecto..."
powershell.exe -NoProfile -Command "
  \$src = 'D:\\Proyectos\\modosabor1'
  \$out = 'D:\\Proyectos\\modosabor1\\deploy\\modosabor-deploy.zip'
  Remove-Item \$out -ErrorAction SilentlyContinue
  Add-Type -Assembly System.IO.Compression.FileSystem
  \$zip = [System.IO.Compression.ZipFile]::Open(\$out, 'Create')
  Get-ChildItem \$src -Recurse -File |
    Where-Object {
      \$_.FullName -notmatch '\\\\node_modules\\\\' -and
      \$_.FullName -notmatch '\\\\dist\\\\' -and
      \$_.FullName -notmatch '\\\\.git\\\\' -and
      \$_.FullName -notmatch '\\\\template_base\\\\' -and
      \$_.Name -ne 'modosabor-deploy.zip'
    } | ForEach-Object {
      \$rel = \$_.FullName.Substring(\$src.Length + 1)
      [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile(\$zip, \$_.FullName, \$rel) | Out-Null
    }
  \$zip.Dispose()
  Write-Host 'ZIP creado correctamente'
"
echo "✅ ZIP creado: $ZIP"

# Subir ZIP a la VM
echo ""
echo "⬆️  Subiendo proyecto a Oracle Cloud (puede tardar 1-2 min)..."
scp -i "$KEY" -o StrictHostKeyChecking=no "$ZIP" "$VM:/tmp/modosabor-deploy.zip"
echo "✅ Proyecto subido"

# Extraer y ejecutar setup en la VM
echo ""
echo "🚀 Instalando en el servidor..."
ssh -i "$KEY" -o StrictHostKeyChecking=no "$VM" bash << 'REMOTE'
  set -e
  echo "→ Extrayendo archivos..."
  sudo apt-get install -y unzip -qq 2>/dev/null
  mkdir -p /tmp/modosabor
  unzip -o /tmp/modosabor-deploy.zip -d /tmp/modosabor -q
  echo "→ Lanzando instalador..."
  cd /tmp/modosabor
  bash deploy/setup-vm.sh
REMOTE

echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║  ✅ ¡Listo! ModoSabor está en http://136.248.108.127 ║"
echo "╚══════════════════════════════════════════════════════╝"
