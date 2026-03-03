@echo off
REM LukeOS Brain API - Windows Test Script
REM Run tests using curl

set BASE_URL=http://localhost:8000
set USER_ID=1

echo =========================================
echo LukeOS Brain API - Windows Tests
echo =========================================
echo.

REM Test Health
echo Testing: Health Check
curl -s %BASE_URL%/health | findstr /C:"ok" >nul
if %errorlevel%==0 (echo [PASS] Health Check) else (echo [FAIL] Health Check)

echo.
echo Testing: Cron Status
curl -s %BASE_URL%/api/cron/status | findstr /C:"status" >nul
if %errorlevel%==0 (echo [PASS] Cron Status) else (echo [FAIL] Cron Status)

echo.
echo --- Chat ---
echo Testing: Chat Message
curl -s -X POST %BASE_URL%/chat -H "Content-Type: application/json" -d "{\"user_message\":\"Hello\",\"user_id\":\"%USER_ID%\",\"mode\":\"chat\"}" | findstr /C:"response" >nul
if %errorlevel%==0 (echo [PASS] Chat Message) else (echo [FAIL] Chat Message)

echo Testing: Analyze Mode
curl -s -X POST %BASE_URL%/chat -H "Content-Type: application/json" -d "{\"user_message\":\"Analyze\",\"user_id\":\"%USER_ID%\",\"mode\":\"analyze\"}" | findstr /C:"response" >nul
if %errorlevel%==0 (echo [PASS] Analyze Mode) else (echo [FAIL] Analyze Mode)

echo Testing: Embed Mode
curl -s -X POST %BASE_URL%/chat -H "Content-Type: application/json" -d "{\"user_message\":\"Test\",\"user_id\":\"%USER_ID%\",\"mode\":\"embed\"}" | findstr /C:"embedding" >nul
if %errorlevel%==0 (echo [PASS] Embed Mode) else (echo [FAIL] Embed Mode)

echo.
echo --- Activities ---
echo Testing: Log Activity
curl -s -X POST %BASE_URL%/api/activity -H "Content-Type: application/json" -d "{\"user_id\":\"%USER_ID%\",\"category_name\":\"coding\",\"duration_minutes\":60,\"date\":\"2026-03-03\"}" | findstr /C:"success" >nul
if %errorlevel%==0 (echo [PASS] Log Activity) else (echo [FAIL] Log Activity)

echo Testing: Get Activities
curl -s "%BASE_URL%/api/activities?user_id=%USER_ID%&start_date=2026-02-24&end_date=2026-03-03" | findstr /C:"activities" >nul
if %errorlevel%==0 (echo [PASS] Get Activities) else (echo [FAIL] Get Activities)

echo Testing: Weekly Summary
curl -s "%BASE_URL%/api/activities/summary?user_id=%USER_ID%&week_start=2026-02-24&week_end=2026-03-02" | findstr /C:"summary" >nul
if %errorlevel%==0 (echo [PASS] Weekly Summary) else (echo [FAIL] Weekly Summary)

echo.
echo --- Goals ---
echo Testing: Create Goal
curl -s -X POST %BASE_URL%/api/goals -H "Content-Type: application/json" -d "{\"user_id\":\"%USER_ID%\",\"category_name\":\"coding\",\"target_value\":600,\"period\":\"weekly\"}" | findstr /C:"success" >nul
if %errorlevel%==0 (echo [PASS] Create Goal) else (echo [FAIL] Create Goal)

echo Testing: Get Goals
curl -s "%BASE_URL%/api/goals?user_id=%USER_ID%" | findstr /C:"goals" >nul
if %errorlevel%==0 (echo [PASS] Get Goals) else (echo [FAIL] Get Goals)

echo Testing: Get Goal Progress
curl -s "%BASE_URL%/api/goals/progress?user_id=%USER_ID%&week_start=2026-02-24&week_end=2026-03-02" | findstr /C:"progress" >nul
if %errorlevel%==0 (echo [PASS] Get Goal Progress) else (echo [FAIL] Get Goal Progress)

echo.
echo --- Metrics ---
echo Testing: Daily Metrics
curl -s "%BASE_URL%/api/metrics/daily/2026-03-03?user_id=%USER_ID%" | findstr /C:"score" >nul
if %errorlevel%==0 (echo [PASS] Daily Metrics) else (echo [FAIL] Daily Metrics)

echo Testing: Weekly Metrics
curl -s "%BASE_URL%/api/metrics/weekly?user_id=%USER_ID%&start_date=2026-02-24&end_date=2026-03-02" | findstr /C:"weekMetrics" >nul
if %errorlevel%==0 (echo [PASS] Weekly Metrics) else (echo [FAIL] Weekly Metrics)

echo.
echo --- Analysis ---
echo Testing: Weekly Analysis
curl -s "%BASE_URL%/api/analysis/weekly?user_id=%USER_ID%&week_start=2026-02-24&week_end=2026-03-02" | findstr /C:"analysis" >nul
if %errorlevel%==0 (echo [PASS] Weekly Analysis) else (echo [FAIL] Weekly Analysis)

echo.
echo --- Cron ---
echo Testing: Trigger Collection
curl -s -X POST %BASE_URL%/api/cron/collect -H "Content-Type: application/json" -d "{\"telegramId\":1}" | findstr /C:"success" >nul
if %errorlevel%==0 (echo [PASS] Trigger Collection) else (echo [FAIL] Trigger Collection)

echo.
echo --- Webhooks ---
echo Testing: MacroDroid Screen Time
curl -s -X POST %BASE_URL%/webhook/macrodroid -H "Content-Type: application/json" -d "{\"user_id\":\"123456789\",\"event_type\":\"screen_time\",\"data\":{\"total_minutes\":180}}" | findstr /C:"success" >nul
if %errorlevel%==0 (echo [PASS] MacroDroid Screen Time) else (echo [FAIL] MacroDroid Screen Time)

echo Testing: MacroDroid Steps
curl -s -X POST %BASE_URL%/webhook/macrodroid -H "Content-Type: application/json" -d "{\"user_id\":\"123456789\",\"event_type\":\"steps\",\"data\":{\"steps\":8500}}" | findstr /C:"success" >nul
if %errorlevel%==0 (echo [PASS] MacroDroid Steps) else (echo [FAIL] MacroDroid Steps)

echo Testing: MacroDroid Custom
curl -s -X POST %BASE_URL%/webhook/macrodroid -H "Content-Type: application/json" -d "{\"user_id\":\"123456789\",\"event_type\":\"custom\",\"data\":{\"event_name\":\"workout\",\"value\":45}}" | findstr /C:"success" >nul
if %errorlevel%==0 (echo [PASS] MacroDroid Custom) else (echo [FAIL] MacroDroid Custom)

echo.
echo --- Error Handling ---
echo Testing: Missing Fields
curl -s -X POST %BASE_URL%/chat -H "Content-Type: application/json" -d "{\"user_message\":\"Test\"}" | findstr /C:"error" >nul
if %errorlevel%==0 (echo [PASS] Missing Fields) else (echo [FAIL] Missing Fields)

echo.
echo =========================================
echo Tests Complete!
echo =========================================
pause
