#!/bin/bash

# ============================================
# CDN Worker Health Monitor
# ============================================
# Checks worker health and sends alerts if down
# Can be run via cron: */5 * * * * /path/to/health-monitor.sh

set -e

# Configuration
WORKER_URL="https://iptvlink-cdn-router-production.workers.dev/health"
ALERT_WEBHOOK="" # Add your webhook URL (Slack, Discord, etc.)
MAX_LATENCY_MS=500
LOG_FILE="/var/log/cdn-worker-health.log"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# ============================================
# Function: Log message
# ============================================
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# ============================================
# Function: Send alert
# ============================================
send_alert() {
    local message="$1"
    local severity="$2"
    
    log "${RED}🚨 ALERT: $message${NC}"
    
    if [ -n "$ALERT_WEBHOOK" ]; then
        curl -X POST "$ALERT_WEBHOOK" \
            -H "Content-Type: application/json" \
            -d "{\"text\":\"🚨 CDN Worker Alert\",\"attachments\":[{\"color\":\"danger\",\"text\":\"$message\",\"fields\":[{\"title\":\"Severity\",\"value\":\"$severity\",\"short\":true},{\"title\":\"Time\",\"value\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\",\"short\":true}]}]}" \
            --silent --output /dev/null
    fi
}

# ============================================
# Health check
# ============================================
log "Checking worker health: $WORKER_URL"

START_TIME=$(date +%s%3N)
HTTP_CODE=$(curl -s -o /tmp/health-response.json -w "%{http_code}" "$WORKER_URL" --max-time 10)
END_TIME=$(date +%s%3N)
LATENCY=$((END_TIME - START_TIME))

if [ "$HTTP_CODE" != "200" ]; then
    send_alert "Worker returned HTTP $HTTP_CODE" "critical"
    exit 1
fi

if [ $LATENCY -gt $MAX_LATENCY_MS ]; then
    send_alert "High latency detected: ${LATENCY}ms (threshold: ${MAX_LATENCY_MS}ms)" "warning"
fi

# Parse response
if command -v jq &> /dev/null; then
    STATUS=$(jq -r '.status' /tmp/health-response.json 2>/dev/null || echo "unknown")
    
    if [ "$STATUS" != "healthy" ]; then
        send_alert "Worker status is '$STATUS' (expected 'healthy')" "critical"
        exit 1
    fi
    
    log "${GREEN}✅ Worker healthy (${LATENCY}ms)${NC}"
    jq '.' /tmp/health-response.json | tee -a "$LOG_FILE"
else
    log "${GREEN}✅ Worker responding (${LATENCY}ms)${NC}"
    cat /tmp/health-response.json | tee -a "$LOG_FILE"
fi

# Cleanup
rm -f /tmp/health-response.json

exit 0
