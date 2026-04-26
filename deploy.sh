#!/bin/bash
# =============================================
# E-Sukan — Deploy & Management Script
# Usage: bash deploy.sh [command]
# Commands: up | down | restart | logs | status | backup | update
# =============================================

set -euo pipefail

APP_DIR="/opt/esukan"
COMPOSE="docker compose --env-file .env"
DB_BACKUP_DIR="$APP_DIR/backups"

cd "$APP_DIR"

case "${1:-help}" in

  up)
    echo "🚀 Starting E-Sukan..."
    $COMPOSE up -d --remove-orphans
    echo "✅ All services started"
    $COMPOSE ps
    ;;

  down)
    echo "🛑 Stopping E-Sukan..."
    $COMPOSE down
    echo "✅ Stopped"
    ;;

  restart)
    echo "🔄 Restarting app (keeps DB and nginx running)..."
    $COMPOSE restart app
    echo "✅ App restarted"
    ;;

  logs)
    SERVICE=${2:-app}
    echo "📋 Logs for: $SERVICE"
    $COMPOSE logs -f --tail=100 "$SERVICE"
    ;;

  status)
    echo "📊 Service status:"
    $COMPOSE ps
    echo ""
    echo "💾 Disk usage:"
    df -h /
    echo ""
    echo "🧠 Memory:"
    free -h
    ;;

  update)
    echo "⬆️  Pulling latest images and restarting..."
    $COMPOSE pull
    $COMPOSE up -d --remove-orphans
    docker image prune -f
    echo "✅ Update complete"
    ;;

  backup)
    echo "💾 Backing up MySQL database..."
    mkdir -p "$DB_BACKUP_DIR"
    TIMESTAMP=$(date +%Y%m%d_%H%M%S)
    BACKUP_FILE="$DB_BACKUP_DIR/esukan_db_$TIMESTAMP.sql.gz"

    source .env
    docker exec esukan_db mysqldump \
      -u"$MYSQL_USER" -p"$MYSQL_PASSWORD" esukan_db \
      | gzip > "$BACKUP_FILE"

    echo "✅ Backup saved to: $BACKUP_FILE"

    # Keep only last 7 backups
    ls -t "$DB_BACKUP_DIR"/*.sql.gz 2>/dev/null | tail -n +8 | xargs rm -f
    echo "🧹 Old backups cleaned (keeping last 7)"
    ;;

  ssl-renew)
    echo "🔐 Renewing SSL certificate..."
    docker compose run --rm certbot renew
    $COMPOSE exec nginx nginx -s reload
    echo "✅ SSL renewed"
    ;;

  shell)
    SERVICE=${2:-app}
    echo "🔧 Opening shell in: $SERVICE"
    docker exec -it "esukan_${SERVICE}" sh
    ;;

  *)
    echo ""
    echo "E-Sukan Management Script"
    echo "========================="
    echo "Usage: bash deploy.sh <command>"
    echo ""
    echo "Commands:"
    echo "  up          Start all services"
    echo "  down        Stop all services"
    echo "  restart     Restart app (zero-downtime)"
    echo "  logs [svc]  Follow logs (default: app)"
    echo "  status      Show service and system status"
    echo "  update      Pull latest images and redeploy"
    echo "  backup      Backup MySQL database"
    echo "  ssl-renew   Manually renew SSL certificate"
    echo "  shell [svc] Open shell inside container"
    echo ""
    ;;
esac
