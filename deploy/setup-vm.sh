#!/bin/bash
# ============================================================
# setup-vm.sh — Configura la VM de Oracle Cloud para ModoSabor
# Ejecutar como usuario ubuntu (o opc en Oracle Linux):
#   bash setup-vm.sh
# ============================================================
set -e

APP_DIR="/var/www/modosabor"
DATA_DIR="/opt/modosabor/data"
CURRENT_USER=$(whoami)

echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║        ModoSabor — Setup Oracle Cloud VM             ║"
echo "╚══════════════════════════════════════════════════════╝"
echo ""

# ── 1. Actualizar paquetes ────────────────────────────────
echo "[1/8] Actualizando paquetes del sistema..."
sudo apt-get update -y && sudo apt-get upgrade -y

# ── 2. Instalar Node.js 22 ────────────────────────────────
echo "[2/8] Instalando Node.js 22..."
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs

echo "  Node $(node -v)  |  npm $(npm -v)"

# ── 3. Instalar nginx ─────────────────────────────────────
echo "[3/8] Instalando nginx..."
sudo apt-get install -y nginx
sudo systemctl enable nginx

# ── 4. Instalar PM2 ──────────────────────────────────────
echo "[4/8] Instalando PM2..."
sudo npm install -g pm2

# ── 5. Crear directorios ──────────────────────────────────
echo "[5/8] Creando directorios de la aplicación..."
sudo mkdir -p "$APP_DIR"
sudo mkdir -p "$DATA_DIR/uploads"
sudo mkdir -p "$DATA_DIR/backups"
sudo mkdir -p "$DATA_DIR/logs"
sudo chown -R "$CURRENT_USER:$CURRENT_USER" "$APP_DIR"
sudo chown -R "$CURRENT_USER:$CURRENT_USER" "$DATA_DIR"

echo "  Directorios creados:"
echo "    App:  $APP_DIR"
echo "    Data: $DATA_DIR"

# ── 6. Copiar archivos de la aplicación ──────────────────
echo "[6/8] Copiando archivos de la aplicación..."
# Se asume que el script se ejecuta desde la raíz del proyecto
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

cp -r "$PROJECT_ROOT/server/" "$APP_DIR/server/"
cp -r "$PROJECT_ROOT/client/" "$APP_DIR/client/"

# Excluir node_modules y dist de la copia
rm -rf "$APP_DIR/server/node_modules"
rm -rf "$APP_DIR/client/node_modules"
rm -rf "$APP_DIR/client/dist"

echo "  Archivos copiados a $APP_DIR"

# ── 7. Instalar dependencias y compilar ───────────────────
echo "[7/8] Instalando dependencias y compilando..."

echo "  → Instalando dependencias del servidor..."
cd "$APP_DIR/server"
npm install --omit=dev

echo "  → Copiando .env de producción..."
cp "$SCRIPT_DIR/.env.production" "$APP_DIR/server/.env"
echo ""
echo "  ⚠️  IMPORTANTE: Edita $APP_DIR/server/.env antes de continuar."
echo "      Rellena JWT_SECRET, credenciales de admin, y TU_IP_PUBLICA_OCI."
echo ""
read -p "  ¿Ya editaste el archivo .env? (s/n): " confirm
if [[ "$confirm" != "s" && "$confirm" != "S" ]]; then
    echo ""
    echo "  Por favor edita el archivo primero:"
    echo "    nano $APP_DIR/server/.env"
    echo ""
    echo "  Luego vuelve a ejecutar solo la parte de inicio (pasos 7 y 8)."
    exit 1
fi

# Leer CORS_ORIGINS del .env para pasarlo al build del frontend
source "$APP_DIR/server/.env" 2>/dev/null || true
PUBLIC_URL="${PUBLIC_APP_URL:-http://localhost}"

echo "  → Instalando dependencias del cliente..."
cd "$APP_DIR/client"
npm install

echo "  → Compilando React (VITE_API_URL vacío = mismo origen vía nginx)..."
VITE_API_URL="" npm run build

echo "  Build completado en $APP_DIR/client/dist"

# ── 8. Configurar nginx ───────────────────────────────────
echo "[8/8] Configurando nginx..."
sudo cp "$SCRIPT_DIR/nginx.conf" /etc/nginx/sites-available/modosabor
sudo ln -sf /etc/nginx/sites-available/modosabor /etc/nginx/sites-enabled/modosabor
sudo rm -f /etc/nginx/sites-enabled/default

sudo nginx -t && sudo systemctl reload nginx

# ── Iniciar servidor con PM2 ──────────────────────────────
echo ""
echo "Iniciando servidor con PM2..."
cp "$SCRIPT_DIR/ecosystem.config.js" "$APP_DIR/server/"
cd "$APP_DIR/server"
pm2 start ecosystem.config.js --env production
pm2 save

# Configurar PM2 para arrancar con el sistema
sudo env PATH=$PATH:/usr/bin /usr/lib/node_modules/pm2/bin/pm2 startup systemd \
  -u "$CURRENT_USER" --hp "/home/$CURRENT_USER"

# ── Resultado ─────────────────────────────────────────────
PUBLIC_IP=$(curl -s --max-time 5 ifconfig.me || echo "IP no disponible")

echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║              ✅ ¡Instalación completa!               ║"
echo "╚══════════════════════════════════════════════════════╝"
echo ""
echo "  🌐 Tu aplicación está en: http://$PUBLIC_IP"
echo ""
echo "  Comandos útiles:"
echo "    pm2 status               → ver estado del servidor"
echo "    pm2 logs modosabor-server → ver logs en tiempo real"
echo "    pm2 restart modosabor-server → reiniciar servidor"
echo "    sudo nginx -t && sudo systemctl reload nginx → recargar nginx"
echo ""
echo "  ⚠️  Recuerda abrir el puerto 80 en tu Security List de OCI."
echo ""
