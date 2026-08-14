#!/bin/bash
set -e

# Mock pm2
pm2() {
    echo "[MOCK PM2] Executed: pm2 $@"
    return 0
}
export -f pm2

# Mock curl to fail first time (health check), then succeed (rollback health check)
export CURL_CALL_COUNT=0
curl() {
    export CURL_CALL_COUNT=$((CURL_CALL_COUNT + 1))
    echo "[MOCK CURL] Call #$CURL_CALL_COUNT to $@"
    if [ $CURL_CALL_COUNT -eq 1 ]; then
        echo "[MOCK CURL] Failing intentionally!"
        return 1
    else
        echo "[MOCK CURL] Succeeding!"
        return 0
    fi
}
export -f curl

# Setup dummy directories
rm -rf mock_next mock_next.new mock_next.rollback mock_next.failed_health
mkdir mock_next mock_next.new
echo "OLD_BUILD" > mock_next/BUILD_ID
echo "NEW_BUILD" > mock_next.new/BUILD_ID

echo "=== ACTIVATION ==="
mv mock_next mock_next.rollback
mv mock_next.new mock_next

echo "=== PM2 RELOAD ==="
pm2 reload kamna --update-env

echo "=== HEALTH CHECK ==="
if ! curl -f http://localhost:3000/api/health; then
    echo "❌ Health check failed! Initiating automatic rollback..."
    mv mock_next mock_next.failed_health || true
    mv mock_next.rollback mock_next || true
    
    echo "   - Reloading PM2 with restored build..."
    if ! pm2 reload kamna --update-env; then
        echo "💥 CRITICAL DEPLOYMENT FAILURE: Rollback PM2 reload also failed!"
        exit 1
    fi
    
    if curl -f http://localhost:3000/api/health; then
        echo "✓ Production successfully restored to previous known-good state."
        echo "❌ Deployment FAILED. (Rolled back safely)."
        exit 1
    else
        echo "💥 CRITICAL DEPLOYMENT FAILURE: Rollback health check also failed!"
        exit 1
    fi
fi
