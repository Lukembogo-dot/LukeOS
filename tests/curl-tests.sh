#!/bin/bash

# LukeOS Brain API - Curl Tests
# Run all tests using curl commands

BASE_URL="http://localhost:8000"
USER_ID="1"

echo "========================================="
echo "LukeOS Brain API - Curl Tests"
echo "========================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Test function
test_endpoint() {
    local name=$1
    local command=$2
    
    echo -n "Testing: $name ... "
    if eval "$command" > /dev/null 2>&1; then
        echo -e "${GREEN}PASS${NC}"
    else
        echo -e "${RED}FAIL${NC}"
    fi
}

# ============================================
# Health & Status Tests
# ============================================
echo "--- Health & Status ---"

test_endpoint "Health Check" "curl -s $BASE_URL/health | grep -q 'ok'"

test_endpoint "Cron Status" "curl -s $BASE_URL/api/cron/status | grep -q 'status'"

# ============================================
# Chat Tests
# ============================================
echo ""
echo "--- Chat ---"

test_endpoint "Chat Message" "curl -s -X POST $BASE_URL/chat -H 'Content-Type: application/json' -d '{\"user_message\":\"Hello\",\"user_id\":\"$USER_ID\",\"mode\":\"chat\"}' | grep -q 'response'"

test_endpoint "Analyze Mode" "curl -s -X POST $BASE_URL/chat -H 'Content-Type: application/json' -d '{\"user_message\":\"Analyze\",\"user_id\":\"$USER_ID\",\"mode\":\"analyze\"}' | grep -q 'response'"

test_endpoint "Embed Mode" "curl -s -X POST $BASE_URL/chat -H 'Content-Type: application/json' -d '{\"user_message\":\"Test\",\"user_id\":\"$USER_ID\",\"mode\":\"embed\"}' | grep -q 'embedding'"

# ============================================
# Activities Tests
# ============================================
echo ""
echo "--- Activities ---"

test_endpoint "Log Activity" "curl -s -X POST $BASE_URL/api/activity -H 'Content-Type: application/json' -d '{\"user_id\":\"$USER_ID\",\"category_name\":\"coding\",\"duration_minutes\":60,\"date\":\"2026-03-03\"}' | grep -q 'success'"

test_endpoint "Get Activities" "curl -s '$BASE_URL/api/activities?user_id=$USER_ID&start_date=2026-02-24&end_date=2026-03-03' | grep -q 'activities'"

test_endpoint "Get Weekly Summary" "curl -s '$BASE_URL/api/activities/summary?user_id=$USER_ID&week_start=2026-02-24&week_end=2026-03-02' | grep -q 'summary'"

# ============================================
# Goals Tests
# ============================================
echo ""
echo "--- Goals ---"

test_endpoint "Create Goal" "curl -s -X POST $BASE_URL/api/goals -H 'Content-Type: application/json' -d '{\"user_id\":\"$USER_ID\",\"category_name\":\"coding\",\"target_value\":600,\"period\":\"weekly\"}' | grep -q 'success'"

test_endpoint "Get Goals" "curl -s '$BASE_URL/api/goals?user_id=$USER_ID' | grep -q 'goals'"

test_endpoint "Get Goal Progress" "curl -s '$BASE_URL/api/goals/progress?user_id=$USER_ID&week_start=2026-02-24&week_end=2026-03-02' | grep -q 'progress'"

# ============================================
# Metrics Tests
# ============================================
echo ""
echo "--- Metrics ---"

test_endpoint "Daily Metrics" "curl -s '$BASE_URL/api/metrics/daily/2026-03-03?user_id=$USER_ID' | grep -q 'score'"

test_endpoint "Weekly Metrics" "curl -s '$BASE_URL/api/metrics/weekly?user_id=$USER_ID&start_date=2026-02-24&end_date=2026-03-02' | grep -q 'weekMetrics'"

# ============================================
# Analysis Tests
# ============================================
echo ""
echo "--- Analysis ---"

test_endpoint "Weekly Analysis" "curl -s '$BASE_URL/api/analysis/weekly?user_id=$USER_ID&week_start=2026-02-24&week_end=2026-03-02' | grep -q 'analysis'"

# ============================================
# Cron Tests
# ============================================
echo ""
echo "--- Cron ---"

test_endpoint "Trigger Collection" "curl -s -X POST $BASE_URL/api/cron/collect -H 'Content-Type: application/json' -d '{\"telegramId\":1}' | grep -q 'success'"

# ============================================
# Webhook Tests
# ============================================
echo ""
echo "--- Webhooks ---"

test_endpoint "MacroDroid Screen Time" "curl -s -X POST $BASE_URL/webhook/macrodroid -H 'Content-Type: application/json' -d '{\"user_id\":\"123456789\",\"event_type\":\"screen_time\",\"data\":{\"total_minutes\":180}}' | grep -q 'success'"

test_endpoint "MacroDroid Steps" "curl -s -X POST $BASE_URL/webhook/macrodroid -H 'Content-Type: application/json' -d '{\"user_id\":\"123456789\",\"event_type\":\"steps\",\"data\":{\"steps\":8500}}' | grep -q 'success'"

test_endpoint "MacroDroid Custom" "curl -s -X POST $BASE_URL/webhook/macrodroid -H 'Content-Type: application/json' -d '{\"user_id\":\"123456789\",\"event_type\":\"custom\",\"data\":{\"event_name\":\"workout\",\"value\":45}}' | grep -q 'success'"

# ============================================
# Error Tests
# ============================================
echo ""
echo "--- Error Handling ---"

test_endpoint "Missing Fields" "curl -s -X POST $BASE_URL/chat -H 'Content-Type: application/json' -d '{\"user_message\":\"Test\"}' | grep -q 'error'"

echo ""
echo "========================================="
echo "Tests Complete!"
echo "========================================="
