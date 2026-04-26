#!/bin/bash
# =============================================
# E-Sukan — Digital Ocean Droplet Setup Script
# Run ONCE on a fresh Ubuntu 22.04 droplet
# Usage: bash setup-droplet.sh yourdomain.com you@email.com
# =============================================

set -euo pipefail

DOMAIN=${1:?"Usage: $0 <domain> <email>"}
EMAIL=${2:?"Usage: $0 <domain> <email>"}
APP_DIR="/opt/esukan"

echo "🚀 Setting up E-Sukan on Digital Ocean"
echo "   Domain : $DOMAIN"
echo "   Email  : $EMAIL"
echo ""

# ---- System update ----
echo "📦 Updating system packages..."
apt-get update -q && apt-get upgrade -y -q

# ---- Install Docker ----
echo "🐳 Installing Docker..."
apt-get install -y -q ca-certificates curl gnupg

install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | \
  gpg --dearmor -o /etc/apt/keyrings/docker.gpg
chmod a+r /etc/apt/keyrings/docker.gpg

echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
  https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  tee /etc/apt/sources.list.d/docker.list > /dev/null

apt-get update -q
apt-get install -y -q docker-ce docker-ce-cli containerd.io docker-compose-plugin

# Enable and start Docker
systemctl enable docker
systemctl start docker

echo "✅ Docker $(docker --version) installed"

# ---- Install useful tools ----
apt-get install -y -q ufw fail2ban unzip git curl wget

# ---- Firewall (UFW) ----
echo "🔒 Configuring firewall..."
ufw --force reset
ufw default deny incoming
ufw default allow outgoing
ufw allow ssh        # Port 22
ufw allow http       # Port 80
ufw allow https      # Port 443
ufw --force enable
echo "✅ Firewall configured"

# ---- Fail2ban ----
echo "🛡️  Enabling fail2ban..."
systemctl enable fail2ban
systemctl start fail2ban

# ---- Create app directory ----
echo "📁 Creating app directory at $APP_DIR..."
mkdir -p "$APP_DIR"/{nginx/conf.d,sql}
cd "$APP_DIR"

# ---- Create .env file ----
echo "🔐 Creating .env file (edit passwords after setup)..."
cat > "$APP_DIR/.env" <<EOF
MYSQL_ROOT_PASSWORD=$(openssl rand -base64 24 | tr -dc 'A-Za-z0-9' | head -c 32)
MYSQL_USER=esukan_user
MYSQL_PASSWORD=$(openssl rand -base64 24 | tr -dc 'A-Za-z0-9' | head -c 32)
DOMAIN=$DOMAIN
CERTBOT_EMAIL=$EMAIL
EOF

chmod 600 "$APP_DIR/.env"
echo "✅ .env created with random passwords (saved to $APP_DIR/.env)"

# ---- Set up SSL (initial Certbot) ----
echo "🔐 Obtaining SSL certificate for $DOMAIN..."

# Temporarily run nginx on port 80 to verify domain
docker run --rm -d --name temp_nginx \
  -p 80:80 \
  -v /var/www/certbot:/var/www/certbot \
  nginx:alpine sh -c 'mkdir -p /var/www/certbot && nginx -g "daemon off;"' || true

sleep 3

docker run --rm \
  -v /etc/letsencrypt:/etc/letsencrypt \
  -v /var/www/certbot:/var/www/certbot \
  certbot/certbot certonly \
  --webroot -w /var/www/certbot \
  -d "$DOMAIN" -d "www.$DOMAIN" \
  --email "$EMAIL" \
  --agree-tos --non-interactive

docker stop temp_nginx 2>/dev/null || true

echo "✅ SSL certificate obtained"

# ---- Swap file (important for 1GB droplets) ----
echo "💾 Creating 2GB swap..."
if [ ! -f /swapfile ]; then
  fallocate -l 2G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi
echo "✅ Swap enabled"

# ---- Docker log rotation ----
cat > /etc/docker/daemon.json <<EOF
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  }
}
EOF
systemctl restart docker

# ---- Auto-restart on reboot ----
cat > /etc/systemd/system/esukan.service <<EOF
[Unit]
Description=E-Sukan Docker Compose
Requires=docker.service
After=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=$APP_DIR
ExecStart=/usr/bin/docker compose --env-file .env up -d --remove-orphans
ExecStop=/usr/bin/docker compose down
TimeoutStartSec=300

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable esukan

echo ""
echo "============================================="
echo "✅ Digital Ocean droplet setup COMPLETE!"
echo "============================================="
echo ""
echo "Next steps:"
echo "  1. Copy your project files to: $APP_DIR"
echo "     scp -r . root@$DOMAIN:$APP_DIR/"
echo ""
echo "  2. Start the app:"
echo "     cd $APP_DIR && docker compose --env-file .env up -d"
echo ""
echo "  3. Check logs:"
echo "     docker compose logs -f app"
echo ""
echo "  4. Your .env passwords are in: $APP_DIR/.env"
echo "     cat $APP_DIR/.env"
echo ""
echo "  🌐 App will be live at: https://$DOMAIN"
echo "============================================="
