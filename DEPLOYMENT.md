# E-Sukan — Digital Ocean Deployment Guide

## Architecture

```
Internet
   │
   ▼
[Digital Ocean Droplet]
   │
   ├── Nginx (port 80/443)  ← SSL termination, reverse proxy
   │      │
   │      └──► Spring Boot App (port 8080, internal only)
   │                 │
   │                 └──► MySQL (port 3306, internal only)
   │
   └── Certbot (auto SSL renewal every 12h)
```

---

## Step 1 — Create Digital Ocean Droplet

1. Go to **digitalocean.com → Create → Droplet**
2. Choose:
   - **OS**: Ubuntu 22.04 LTS
   - **Plan**: Basic — **2 GB RAM / 1 vCPU / 50 GB SSD** (minimum recommended)
   - **Region**: Singapore (SGP1) — closest to Malaysia
   - **Authentication**: SSH Key (add your public key)
3. Enable **backups** (optional but recommended)
4. Note the **Droplet IP address**

---

## Step 2 — Point Your Domain to the Droplet

In your domain registrar or Digital Ocean DNS:

```
A    yourdomain.com      → <Droplet IP>
A    www.yourdomain.com  → <Droplet IP>
```

Wait for DNS propagation (5–30 minutes).

---

## Step 3 — Run Droplet Setup Script

SSH into your droplet:
```bash
ssh root@<your-droplet-ip>
```

Upload and run the setup script:
```bash
# From your local machine:
scp setup-droplet.sh root@<droplet-ip>:/root/
ssh root@<droplet-ip> "bash /root/setup-droplet.sh yourdomain.com you@email.com"
```

This script automatically:
- Installs Docker & Docker Compose
- Configures UFW firewall (SSH, HTTP, HTTPS only)
- Enables fail2ban (brute-force protection)
- Creates a 2GB swap file
- Obtains Let's Encrypt SSL certificate
- Sets up Docker log rotation
- Creates systemd service for auto-restart on reboot

---

## Step 4 — Upload Project Files

From your local machine:
```bash
# Copy the entire project
scp -r . root@<droplet-ip>:/opt/esukan/

# Or if using git:
ssh root@<droplet-ip>
cd /opt/esukan
git clone https://github.com/youruser/esukan.git .
```

---

## Step 5 — Configure .env

```bash
ssh root@<droplet-ip>
cat /opt/esukan/.env        # Generated passwords are already here
nano /opt/esukan/.env       # Edit if needed
```

Your `.env` should look like:
```
MYSQL_ROOT_PASSWORD=AbCdEf1234...
MYSQL_USER=esukan_user
MYSQL_PASSWORD=XyZ9876...
DOMAIN=yourdomain.com
CERTBOT_EMAIL=you@email.com
```

---

## Step 6 — Update Nginx Config with Your Domain

```bash
sed -i 's/${DOMAIN}/yourdomain.com/g' /opt/esukan/nginx/conf.d/esukan.conf
```

---

## Step 7 — Launch!

```bash
cd /opt/esukan
bash deploy.sh up
```

Check everything is running:
```bash
bash deploy.sh status
bash deploy.sh logs app
```

Visit: **https://yourdomain.com** 🎉

---

## Day-to-Day Management

```bash
bash deploy.sh logs          # Watch app logs
bash deploy.sh logs db       # Watch database logs
bash deploy.sh logs nginx    # Watch nginx logs

bash deploy.sh restart       # Restart app only (no downtime)
bash deploy.sh update        # Pull latest + redeploy

bash deploy.sh backup        # Backup MySQL → /opt/esukan/backups/
bash deploy.sh status        # Server health overview

bash deploy.sh shell app     # Open shell inside app container
bash deploy.sh shell db      # Open MySQL shell
```

---

## CI/CD via GitHub Actions (Optional)

Add these secrets to your GitHub repo (`Settings → Secrets → Actions`):

| Secret | Value |
|--------|-------|
| `DO_HOST` | Your droplet IP or domain |
| `DO_USER` | `root` |
| `DO_SSH_KEY` | Your private SSH key |

Every push to `main` will automatically:
1. Build & test with Maven
2. Build Docker image → push to GitHub Container Registry
3. SSH into droplet → pull new image → restart app

---

## Recommended Droplet Sizes (Digital Ocean)

| Traffic | Plan | RAM | Cost |
|---------|------|-----|------|
| Dev/small campus | Basic | 2 GB | ~$12/mo |
| Medium campus | Basic | 4 GB | ~$24/mo |
| Large / high traffic | General Purpose | 8 GB | ~$63/mo |

---

## Backup Strategy

Automated daily backups via cron:
```bash
# Add to root crontab: crontab -e
0 2 * * * cd /opt/esukan && bash deploy.sh backup >> /var/log/esukan-backup.log 2>&1
```

Also enable **Digital Ocean Backups** ($2/mo) for full droplet snapshots.

---

## Troubleshooting

**App won't start:**
```bash
docker compose logs app
```

**Database connection refused:**
```bash
docker compose logs db
# Check DB is healthy:
docker compose ps
```

**SSL certificate error:**
```bash
bash deploy.sh ssl-renew
```

**Out of memory:**
```bash
free -h         # Check memory
bash deploy.sh status
# Consider upgrading droplet plan
```
