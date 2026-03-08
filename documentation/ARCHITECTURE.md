# LukeOS Brain - Complete Technical Architecture Documentation

**Version:** 2.0  
**Date:** March 7, 2026  
**Author:** LukeOS Development Team  
**Status:** Production Ready

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [System Architecture Overview](#2-system-architecture-overview)
3. [Technology Stack](#3-technology-stack)
4. [Core Components](#4-core-components)
5. [Data Flow Architecture](#5-data-flow-architecture)
6. [API Endpoints Reference](#6-api-endpoints-reference)
7. [Database Schema](#7-database-schema)
8. [External Integrations](#8-external-integrations)
9. [Cron Jobs & Automation](#9-cron-jobs--automation)
10. [Security Considerations](#10-security-considerations)
11. [Deployment Guide](#11-deployment-guide)
12. [Environment Variables](#12-environment-variables)
13. [Troubleshooting Guide](#13-troubleshooting-guide)
14. [File Structure](#14-file-structure)
15. [API Quick Reference](#15-api-quick-reference)

---

## 1. Executive Summary

### 1.1 What is LukeOS Brain?

LukeOS Brain is an intelligent productivity tracking system that combines artificial intelligence with multi-source data aggregation to provide personalized productivity insights. The system acts as a personal AI assistant that understands your coding habits, exercise patterns, calendar events, and more.

### 1.2 Core Capabilities

| Capability | Description |
|------------|-------------|
| **AI Chat Assistant** | Conversational AI using Groq (Llama 3.3) for general queries |
| **Deep Analysis** | Gemini-powered analysis with full context awareness |
| **Activity Tracking** | Log and track coding, exercise, reading, and custom activities |
| **Goal Management** | Set and monitor daily/weekly/monthly productivity goals |
| **Productivity Scoring** | AI-calculated scores with grades (A+ to F) |
| **Vector Memory** | Semantic search using Cohere embeddings (1024-dim) |
| **Persistent Storage** | Supabase (PostgreSQL + pgvector) for all user data |
| **Automated Collection** | Daily cron jobs to fetch GitHub and Strava data |
| **Historical Backfill** | Import past GitHub commits for complete history |

### 1.3 Key Features (v2.0 Update)

The v2.0 update includes:
- ✅ **Daily Cron Jobs** - Data collection runs daily at midnight (previously weekly)
- ✅ **Intelligent Date Parsing** - Natural language queries like "last week", "yesterday", "this month"
- ✅ **GitHub Historical Sync** - Backfill all commits from any year
- ✅ **Duplicate Prevention** - No more duplicate entries in database
- ✅ **Rate Limiting** - Respects GitHub API limits with proper delays
- ✅ **Production-Ready** - Fixed dotenv override issue for proper env var handling

---

## 2. System Architecture Overview

### 2.1 High-Level Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              CLIENTS                                            │
├─────────────┬──────────────┬──────────────┬─────────────┬─────────────────────┤
│   Telegram  │     n8n      │  MacroDroid  │   Web Apps  │       CLI           │
│     Bot     │  Workflows   │   (Android)  │             │    (curl)           │
└──────┬──────┴──────┬───────┴──────┬───────┴──────┬─────┴──────────┬────────┘
       │              │              │              │                │
       ▼              ▼              ▼              ▼                ▼
┌──────────────────────────────────────────────────────────────────────────────────┐
│                     LUKEOS BRAIN API (Port 8000)                                │
├──────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  ┌────────────────────────────────────────────────────────────────────────────┐  │
│  │                         ROUTING LAYER                                      │  │
│  ├─────────────┬──────────────┬──────────────┬─────────────┬─────────────────┤  │
│  │  /chat      │   /api/*     │ /webhook/*   │ /auth/*     │   /health       │
│  │  Routes     │   Routes     │   Routes     │   Routes    │   Endpoint      │
│  └──────┬──────┴──────┬───────┴──────┬───────┴──────┬─────┴───────┬────────┘  │
│         │              │              │              │             │           │
│         ▼              ▼              ▼              ▼             ▼           │
│  ┌────────────────────────────────────────────────────────────────────────────┐  │
│  │                    MAIN CONTROLLER (main.ts)                                │  │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────┐         │  │
│  │  │   Groq     │  │  Gemini    │  │ Embeddings │  │  Scoring   │         │  │
│  │  │  Service   │  │  Service   │  │  Service   │  │  Service   │         │  │
│  │  └────────────┘  └────────────┘  └────────────┘  └────────────┘         │  │
│  └────────────────────────────────────────────────────────────────────────────┘  │
│                                     │                                            │
│         ┌───────────────────────────┼───────────────────────────────────────┐   │
│         ▼                           ▼                                        ▼   │
│  ┌─────────────┐            ┌─────────────┐                         ┌──────────┐│
│  │   GitHub    │            │   Strava    │                         │ Calendar ││
│  │  Service    │            │  Service     ││
 │                         │ Service│  └─────────────┘            └─────────────┘                         └──────────┘│
│         │                           │                                        │   │
│         └───────────────────────────┼────────────────────────────────────────┘   │
│                                     ▼                                            │
│  ┌────────────────────────────────────────────────────────────────────────────┐  │
│  │                   SUPABASE (PostgreSQL + pgvector)                         │  │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────┐  │  │
│  │  │User      │  │Conversa- │  │Activities│  │  Goals   │  │Productivity  │  │  │
│  │  │Profiles  │  │  tions   │  │          │  │          │  │   Events     │  │  │
│  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘  └──────────────┘  │  │
│  │  ┌──────────────┐  ┌────────────────┐                                     │  │
│  │  │GitHub Activity│  │Daily Metrics   │                                     │  │
│  │  └──────────────┘  └────────────────┘                                     │  │
│  └────────────────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────────────────┘
                                     │
                                     ▼
┌──────────────────────────────────────────────────────────────────────────────────┐
│                          EXTERNAL APIS                                           │
├─────────────────┬─────────────────┬─────────────────┬─────────────────────────────┤
│   Groq API      │  Gemini API     │  Cohere API     │      GitHub API            │
│   (LLM Chat)    │  (Analysis)     │  (Embeddings)   │      (Activity)            │
└─────────────────┴─────────────────┴─────────────────┴─────────────────────────────┘
         │                  │                  │                  │
         ▼                  ▼                  ▼                  ▼
┌─────────────────┬─────────────────┬─────────────────┬─────────────────────────────┐
│   Strava API    │      Google     │   MacroDroid    │                             │
│   (Exercise)    │  Calendar API   │     (Android)   │                             │
│                 │   (Meetings)    │    (Sensors)    │                             │
└─────────────────┴─────────────────┴─────────────────┴─────────────────────────────┘
```

### 2.2 System Flow

```
User Request
    │
    ▼
┌─────────────────┐
│  Express.js    │ ─── Route to appropriate handler
│  (Port 8000)   │
└────────┬────────┘
         │
    ┌────┴────┐
    │         │
    ▼         ▼
┌───────┐ ┌────────┐
│ Chat  │ │ Analyze│
│ Mode  │ │  Mode  │
└───┬───┘ └───┬────┘
    │         │
    ▼         ▼
┌─────────────────────────────┐
│  Fetch User Context        │
│  - Conversation History    │
│  - Activities (DB)          │
│  - Goals (DB)               │
└─────────────┬───────────────┘
              │
              ▼
┌─────────────────────────────┐
│  Fetch External Data        │
│  - GitHub (real-time)       │
│  - Strava (real-time)       │
│  - Calendar (real-time)     │
└─────────────┬───────────────┘
              │
              ▼
┌─────────────────────────────┐
│  Generate AI Response       │
│  - Groq (chat)              │
│  - Gemini (analysis)         │
└─────────────┬───────────────┘
              │
              ▼
┌─────────────────────────────┐
│  Store & Return             │
│  - Save to Supabase         │
│  - Generate Embeddings      │
│  - Return Response         │
└─────────────────────────────┘
```

---

## 3. Technology Stack

### 3.1 Core Technologies

| Layer | Technology | Version | Purpose |
|-------|------------|---------|---------|
| **Runtime** | Node.js | 18+ | JavaScript runtime |
| **Language** | TypeScript | 5.9 | Type safety |
| **Web Framework** | Express.js | 5.2 | REST API server |
| **LLM - Chat** | Groq | - | Fast chat responses (Llama 3.3 70B) |
| **LLM - Analysis** | Gemini | 2.5 | Deep analysis & thinking |
| **Embeddings** | Cohere | v3.0 | Semantic search (1024-dim vectors) |
| **Database** | Supabase | - | PostgreSQL + pgvector |
| **Automation** | node-cron | 4.2 | Scheduled tasks |

### 3.2 External APIs

| Service | API | Purpose |
|---------|-----|---------|
| **GitHub** | REST API v3 | Commit history, PRs |
| **Strava** | OAuth2 + REST API v3 | Activity tracking |
| **Google Calendar** | Google Calendar API | Meeting & focus time |
| **MacroDroid** | Webhooks | Android sensor data |

### 3.3 Dependencies

```json
{
  "dependencies": {
    "@supabase/supabase-js": "^2.97.0",
    "axios": "^1.13.5",
    "cors": "^2.8.6",
    "dotenv": "^17.3.1",
    "express": "^5.2.1",
    "node-cron": "^4.2.1"
  }
}
```

---

## 4. Core Components

### 4.1 Main Controller (`src/main.ts`)

The main controller is the brain of the application. It handles all incoming requests and orchestrates the flow between services.

#### Responsibilities:
- Route requests based on `mode` parameter
- Coordinate between LLM providers and memory services
- Generate embeddings asynchronously
- Handle error cases and fallbacks
- Parse natural language date queries

#### Request Modes:

| Mode | Provider | Model | Use Case |
|------|----------|-------|----------|
| `chat` | Groq | llama-3.3-70b-versatile | General conversation |
| `analyze` | Gemini | gemini-2.5-flash | Deep analysis with context |
| `embed` | Cohere | embed-english-v3.0 | Generate embeddings only |

#### Key Functions:

```typescript
// Main entry point
handleBrainRequest(payload: ChatRequest): Promise<ChatResponse>

// Date parsing for natural language queries
// Supports: yesterday, today, last week, this week, last month, 
//            this month, last 2 weeks, last 3 days, last 7 days
```

### 4.2 Supabase Service (`src/services/supabase.ts`)

Handles all database operations with Supabase.

#### Key Functions:

```typescript
// === User Management ===
getOrCreateUser(telegramId: number, timezone?: string): Promise<string | null>
getUserByTelegramId(telegramId: number): Promise<string | null>

// === Conversations ===
saveConversation(userId, role, messageText, embedding?): Promise<boolean>
getConversationHistory(userId: string, limit?: number): Promise<Array<{role, content}>>
storeUserMessage(telegramId, messageText, embedding?): Promise<boolean>
storeAssistantMessage(telegramId, messageText, embedding?): Promise<boolean>

// === Activities ===
logActivity(telegramId, categoryName, durationMinutes, notes?, date?, embedding?): Promise<boolean>
getActivities(telegramId, startDate, endDate, categoryName?): Promise<Activity[]>
getWeeklySummary(telegramId, weekStartDate, weekEndDate): Promise<WeeklySummary[]>

// === Goals ===
createGoal(tName, targetValueelegramId, category, period, startDate?, endDate?): Promise<string | null>
getActiveGoals(telegramId: number): Promise<Goal[]>
updateGoal(goalId: string, updates: Partial<Goal>): Promise<boolean>
getGoalProgress(telegramId, categoryName, periodStart, periodEnd): Promise<GoalProgress[]>

// === GitHub Sync ===
syncGitHubActivity(telegramId, commitData): Promise<boolean>
syncAllGitHubActivity(telegramId, commits, pullRequests): Promise<{synced, errors}>

// === Strava Sync ===
syncStravaActivity(telegramId, activityData): Promise<boolean>
syncAllStravaActivities(telegramId, activities): Promise<{synced, errors}>
```

### 4.3 Embeddings Service (`src/services/embeddings.ts`)

Generates semantic embeddings using Cohere v3.0 with automatic fallback.

```typescript
// Generate embeddings
generateEmbedding(text: string, apiKey?: string, inputType?: 'search_query' | 'search_document'): Promise<{
  embedding: number[];
  provider: 'cohere' | 'local';
  model: string;
}>
```

### 4.4 GitHub Service (`src/services/github.ts`)

Fetches GitHub activity with rate limiting and pagination.

```typescript
// Get commits and PRs for a date range
getGitHubActivity(username: string, startDate: string, endDate: string, token?: string): Promise<{
  commits: GitHubCommit[];
  pullRequests: GitHubPullRequest[];
  totalContributions: number;
}>
```

### 4.5 Strava Service (`src/services/strava.ts`)

Fetches Strava activities with automatic token refresh.

```typescript
// Get all activities in date range
getAllStravaActivities(accessToken: string, startDate: string, endDate: string): Promise<StravaActivity[]>

// Summarize activities
summarizeStravaActivities(activities: StravaActivity[]): ActivitySummary

// Get exercise minutes
getExerciseMinutes(activities: StravaActivity[]): number

// Calculate workout streak
getWorkoutStreak(activities: StravaActivity[]): number
```

### 4.6 Cron Service (`src/services/cron.ts`)

Handles scheduled data collection with daily execution.

```typescript
// Run all cron collections (GitHub + Strava)
runWeeklyCollection(telegramId?: number): Promise<{
  github: { success, commits, codingMinutes, error? };
  strava: { success, activities, exerciseMinutes, workoutStreak, error? };
}>

// Schedule cron jobs (runs daily at midnight)
scheduleCronJobs(): Promise<void>

// Historical GitHub sync (for backfilling past data)
syncGitHubHistoryForYear(telegramId: number, year: number): Promise<{synced, errors}>
```

---

## 5. Data Flow Architecture

### 5.1 Chat Request Flow

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Client    │────▶│  Express    │────▶│   Main      │────▶│   Groq      │
│ (Telegram)  │     │   Router    │     │ Controller  │     │   Service   │
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
                                                  │                   │
                                                  ▼                   │
                                           ┌─────────────┐          │
                                           │  Supabase   │◀─────────┘
                                           │ (History)   │
                                           └─────────────┘
                                                  │
                    ┌──────────────────────────────┼──────────────────────┐
                    ▼                              ▼                      ▼
             ┌─────────────┐              ┌─────────────┐       ┌─────────────┐
             │  Cohere    │              │  Supabase   │       │   Client    │
             │(Embeddings)│              │ (Store)     │       │  (Response)│
             └─────────────┘              └─────────────┘       └─────────────┘
```

### 5.2 Daily Cron Collection Flow

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  node-cron │────▶│   Cron     │────▶│   GitHub    │────▶│  GitHub API │
│ (Midnight)  │     │   Route    │     │   Service   │     │             │
└─────────────┘     └─────────────┘     └─────────────┘    ─┘
                         └──────────── │                   │
                         ▼                   ▼
                   ┌─────────────┐     ┌─────────────┐
                   │   Strava    │────▶│  Strava API │
                   │   Service   │     │             │
                   └─────────────┘     └─────────────┘
                         │
                         ▼
                   ┌─────────────┐     ┌─────────────┐
                   │  Supabase   │────▶│   Store     │
                   │   Service   │     │  Activities │
                   └─────────────┘     └─────────────┘
```

### 5.3 AI Context Building Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    BUILD USER CONTEXT                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. Conversation History ──▶ getConversationHistory()          │
│     - Fetches last 30 messages from Supabase                    │
│     - Provides conversation context                             │
│                                                                  │
│  2. Activities ───────────▶ getWeeklySummary()                  │
│     - Parses natural language date (yesterday, last week...)    │
│     - Default: 90 days for comprehensive context                │
│     - Returns: category_name, total_minutes, entry_count        │
│                                                                  │
│  3. Goals ───────────────▶ getActiveGoals()                     │
│     - Fetches all active goals                                  │
│     - Shows targets for productivity scoring                    │
│                                                                  │
│  4. GitHub (real-time) ──▶ getGitHubActivity()                 │
│     - Only fetches when user asks about commits                │
│     - Auto-syncs to database after fetch                       │
│     - Date parsing: "yesterday", "last week", etc.             │
│                                                                  │
│  5. Strava (real-time) ──▶ getAllStravaActivities()            │
│     - Only fetches when user asks about exercise               │
│     - Last 180 days of activities                               │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 6. API Endpoints Reference

### 6.1 Core Endpoints

#### GET /health
Health check endpoint.

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2026-03-07T12:00:00.000Z"
}
```

#### POST /chat
Send a message to the AI assistant.

**Request:**
```json
{
  "user_message": "What did I work on this week?",
  "user_id": "123456789",
  "mode": "chat"
}
```

**Response:**
```json
{
  "response": "Based on your data...",
  "embedding": [...],
  "metadata": {
    "mode": "chat",
    "provider": "groq",
    "model": "llama-3.3-70b-versatile",
    "memory_used": true,
    "retrieved_messages": 30,
    "timestamp": "2026-03-07T12:00:00.000Z"
  }
}
```

### 6.2 Activity Endpoints

#### POST /api/activity
Log a new activity.

```bash
curl -X POST "http://localhost:8000/api/activity" \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "1",
    "category_name": "coding",
    "duration_minutes": 60,
    "notes": "Working on LukeOS",
    "date": "2026-03-07"
  }'
```

#### GET /api/activities
Get activities for a date range.

```bash
curl "http://localhost:8000/api/activities?user_id=1&start_date=2026-02-01&end_date=2026-03-07"
```

### 6.3 Goals Endpoints

#### POST /api/goals
Create a new goal.

```bash
curl -X POST "http://localhost:8000/api/goals" \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "1",
    "category_name": "coding",
    "target_value": 600,
    "period": "weekly"
  }'
```

#### GET /api/goals
Get active goals.

```bash
curl "http://localhost:8000/api/goals?user_id=1"
```

### 6.4 Metrics Endpoints

#### GET /api/metrics/daily/:date
Get daily metrics with productivity score.

```bash
curl "http://localhost:8000/api/metrics/daily/2026-03-07?user_id=1"
```

**Response:**
```json
{
  "date": "2026-03-07",
  "metrics": {
    "github_commits": 5,
    "github_prs": 2,
    "exercise_minutes": 44,
    "productive_app_minutes": 120,
    "meetings_minutes": 60,
    "focus_time_minutes": 90
  },
  "score": 78,
  "grade": "B",
  "description": "Good progress 👍"
}
```

#### GET /api/metrics/weekly
Get weekly metrics with patterns.

```bash
curl "http://localhost:8000/api/metrics/weekly?user_id=1&start_date=2026-02-01&end_date=2026-03-07"
```

### 6.5 Cron Endpoints

#### POST /api/cron/collect
Trigger manual data collection.

```bash
curl -X POST "http://localhost:8000/api/cron/collect"
```

**Response:**
```json
{
  "success": true,
  "github": {
    "success": true,
    "commits": 5,
    "codingMinutes": 150
  },
  "strava": {
    "success": true,
    "activities": 3,
    "exerciseMinutes": 120,
    "workoutStreak": 2
  }
}
```

#### GET /api/cron/status
Get cron status.

```bash
curl "http://localhost:8000/api/cron/status"
```

**Response:**
```json
{
  "status": "ready",
  "schedule": "Daily at midnight",
  "manual_trigger": "POST /api/cron/collect",
  "services": {
    "github": true,
    "strava": true
  }
}
```

### 6.6 Sync Endpoints

#### POST /api/github/sync
Sync GitHub commits to database.

```bash
curl -X POST "http://localhost:8000/api/github/sync" \
  -H "Content-Type: application/json" \
  -d '{
    "telegramId": 1966734159,
    "days": 30
  }'
```

#### POST /api/github/sync-history
Backfill historical GitHub data for a specific year.

```bash
curl -X POST "http://localhost:8000/api/github/sync-history" \
  -H "Content-Type: application/json" \
  -d '{
    "telegramId": 1966734159,
    "year": 2025
  }'
```

#### POST /api/strava/sync
Sync Strava activities to database.

```bash
curl -X POST "http://localhost:8000/api/strava/sync" \
  -H "Content-Type: application/json" \
  -d '{
    "telegramId": 1966734159,
    "days": 180
  }'
```

### 6.7 Authentication Endpoints

#### GET /auth/strava
Get Strava OAuth URL.

```bash
curl "http://localhost:8000/auth/strava"
```

#### POST /auth/strava/token
Exchange authorization code for access token.

```bash
curl -X POST "http://localhost:8000/auth/strava/token" \
  -H "Content-Type: application/json" \
  -d '{"code": "authorization_code_from_strava"}'
```

---

## 7. Database Schema

### 7.1 Table: user_profile

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK | Unique identifier |
| telegram_id | BIGINT | UNIQUE, NOT NULL | Telegram user ID |
| timezone | VARCHAR | DEFAULT 'Africa/Nairobi' | User timezone |
| created_at | TIMESTAMP | DEFAULT NOW() | Creation timestamp |
| updated_at | TIMESTAMP | | Last update timestamp |

### 7.2 Table: conversations

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK | Unique identifier |
| user_id | UUID | FK → user_profile.id | User reference |
| role | VARCHAR | 'user' or 'assistant' | Message role |
| message_text | TEXT | NOT NULL | Message content |
| embedding | vector(1024) | | Cohere embedding |
| created_at | TIMESTAMP | DEFAULT NOW() | Creation timestamp |

### 7.3 Table: activities

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK | Unique identifier |
| user_id | UUID | FK → user_profile.id | User reference |
| category_name | VARCHAR | NOT NULL | Activity category |
| duration_minutes | INTEGER | NOT NULL | Duration in minutes |
| notes | TEXT | | Optional notes |
| activity_date | DATE | | Activity date |
| embedding | vector(1024) | | Optional embedding |
| created_at | TIMESTAMP | DEFAULT NOW() | Creation timestamp |

### 7.4 Table: goals

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK | Unique identifier |
| user_id | UUID | FK → user_profile.id | User reference |
| category_name | VARCHAR | NOT NULL | Goal category |
| target_value | INTEGER | NOT NULL | Target value |
| period | VARCHAR | 'daily', 'weekly', 'monthly' | Goal period |
| start_date | DATE | NOT NULL | Start date |
| end_date | DATE | | End date (optional) |
| is_active | BOOLEAN | DEFAULT TRUE | Active status |
| created_at | TIMESTAMP | DEFAULT NOW() | Creation timestamp |

### 7.5 Table: productivity_events

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK | Unique identifier |
| user_id | UUID | FK → user_profile.id | User reference |
| timestamp | TIMESTAMP | NOT NULL | Event timestamp |
| source | VARCHAR | 'github', 'strava', 'macrodroid' | Data source |
| event_type | VARCHAR | 'push', 'workout', etc. | Event type |
| data | JSONB | | Event data |
| category | VARCHAR | 'coding', 'physical', etc. | Category |
| created_at | TIMESTAMP | DEFAULT NOW() | Creation timestamp |

### 7.6 Table: github_activity

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK | Unique identifier |
| user_id | UUID | FK → user_profile.id | User reference |
| timestamp | TIMESTAMP | NOT NULL | Commit timestamp |
| repo_name | VARCHAR | NOT NULL | Repository name |
| commits_count | INTEGER | DEFAULT 1 | Number of commits |
| commit_message | TEXT | | Commit message |
| event_type | VARCHAR | 'push', 'pr', etc. | Event type |
| raw_data | JSONB | | Raw event data |
| created_at | TIMESTAMP | DEFAULT NOW() | Creation timestamp |

### 7.7 Table: daily_metrics

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK | Unique identifier |
| user_id | UUID | FK → user_profile.id | User reference |
| date | DATE | NOT NULL | Metric date |
| commits_count | INTEGER | | GitHub commits |
| lines_added | INTEGER | | Lines added |
| lines_deleted | INTEGER | | Lines deleted |
| coding_hours | DECIMAL | | Estimated coding hours |
| workout_done | BOOLEAN | | Workout completed |
| workout_type | VARCHAR | | Workout type |
| workout_duration_minutes | INTEGER | | Workout duration |
| distance_km | DECIMAL | | Distance in km |
| calories_burned | INTEGER | | Calories burned |
| created_at | TIMESTAMP | DEFAULT NOW() | Creation timestamp |

### 7.8 SQL Setup

Run the following in Supabase SQL Editor:

```sql
-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Create tables (see supabase-schema.sql for full schema)
```

---

## 8. External Integrations

### 8.1 GitHub Integration

**Required Environment Variables:**
```bash
GITHUB_USERNAME=your_username
GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxx
```

**Features:**
- Fetch commits and PRs for any date range
- Calculate coding minutes (30 min/commit estimate)
- Rate limit: 60 requests/hour (unauthenticated), 5000/hour (authenticated)
- **NEW:** Pagination support for fetching all commits
- **NEW:** Rate limiting with 50ms delay between API calls
- **NEW:** Duplicate prevention when syncing to database

**API Endpoints Used:**
- `GET /user/repos` - List user repositories
- `GET /repos/{owner}/{repo}/commits` - Get commits

### 8.2 Strava Integration

**Required Environment Variables:**
```bash
STRAVA_CLIENT_ID=xxxxx
STRAVA_CLIENT_SECRET=xxxxxxxxxxxxxxxxxxxx
STRAVA_ACCESS_TOKEN=xxxxxxxxxxxxxxxxxxxx
STRAVA_REFRESH_TOKEN=xxxxxxxxxxxxxxxxxxxx
```

**Features:**
- Automatic token refresh
- Fetch activities (runs, rides, swims, etc.)
- Calculate exercise minutes and streaks
- Sync to productivity_events table

**API Endpoints Used:**
- `POST /oauth/token` - Token refresh
- `GET /api/v3/athlete/activities` - Activity list

### 8.3 Google Calendar Integration

**Required Environment Variables:**
```bash
GOOGLE_CALENDAR_TOKEN=xxxxx
```

**Features:**
- Fetch calendar events
- Classify events (focus, meeting, personal)
- Calculate meeting and focus time

### 8.4 MacroDroid Integration

**Setup:**
1. Install MacroDroid on Android
2. Create web request macro
3. Point to `http://YOUR_SERVER/webhook/macrodroid`

**Event Types:**
- `screen_time` - Total screen time
- `app_usage` - Per-app usage
- `steps` - Step count
- `location` - Location updates
- `custom` - Custom events

---

## 9. Cron Jobs & Automation

### 9.1 Daily Collection Schedule

The cron service runs **daily at midnight UTC** to collect the latest data.

**Schedule:** `0 0 * * *` (every day at midnight)

**What gets collected:**
| Source | Data | Storage Location |
|--------|------|-----------------|
| GitHub | Commits, PRs | `github_activity` table |
| Strava | Activities | `productivity_events` table |

### 9.2 How to Trigger Collection

**Manual Trigger:**
```bash
curl -X POST "http://localhost:8000/api/cron/collect"
```

**With specific user:**
```bash
curl -X POST "http://localhost:8000/api/cron/collect" \
  -H "Content-Type: application/json" \
  -d '{"telegramId": 1966734159}'
```

### 9.3 Historical Data Backfill

To import historical GitHub data:

```bash
curl -X POST "http://localhost:8000/api/github/sync-history" \
  -H "Content-Type: application/json" \
  -d '{"year": 2025}'
```

This will:
1. Fetch all repositories
2. Paginate through all commits for each repo
3. Store all commits in the `github_activity` table

---

## 10. Security Considerations

### 10.1 Environment Variables

- Never commit `.env` file to version control
- Use Render dashboard for production environment variables
- The `dotenv.config()` call now respects existing `process.env` values

### 10.2 API Key Protection

| Key | Sensitivity | Best Practice |
|-----|-------------|---------------|
| GROQ_API_KEY | High | Rotate monthly |
| GEMINI_API_KEY | High | Rotate monthly |
| COHERE_API_KEY | High | Rotate monthly |
| SUPABASE_ANON_KEY | Medium | Use row-level security |
| GITHUB_TOKEN | High | Use fine-grained tokens |
| STRAVA_ACCESS_TOKEN | High | Auto-refresh regularly |

### 10.3 Rate Limiting

The system implements rate limiting:
- GitHub API: 50ms delay between requests
- Prevents hitting rate limits during bulk operations

### 10.4 Input Validation

All user inputs are validated:
- Telegram ID must be a valid integer
- Dates must be in ISO format
- Activity durations must be positive integers

---

## 11. Deployment Guide

### 11.1 Render Deployment

**Step 1: Prepare for Deployment**

1. Ensure all changes are committed:
```bash
git add .
git commit -m "Production ready"
```

2. Push to GitHub:
```bash
git push origin main
```

**Step 2: Create Render Service**

1. Go to https://dashboard.render.com
2. Create a new **Web Service**
3. Connect your GitHub repository
4. Configure:

| Setting | Value |
|---------|-------|
| Name | lukeos-brain |
| Environment | Node |
| Build Command | `npm install` |
| Start Command | `npm start` |

**Step 3: Environment Variables**

Add the following in Render dashboard:

```bash
# Required
PORT=8000
GROQ_API_KEY=your_groq_key
GEMINI_API_KEY=your_gemini_key
COHERE_API_KEY=your_cohere_key
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_anon_key

# Optional (for features)
GITHUB_USERNAME=your_username
GITHUB_TOKEN=your_github_token
STRAVA_CLIENT_ID=your_client_id
STRAVA_CLIENT_SECRET=your_client_secret
STRAVA_ACCESS_TOKEN=your_access_token
STRAVA_REFRESH_TOKEN=your_refresh_token
```

**Step 4: Deploy**

1. Click "Create Web Service"
2. Wait for build to complete
3. Your app will be available at `https://lukeos-brain.onrender.com`

### 11.2 Cron Jobs on Render

**Important:** Render's free tier puts services to sleep after 15 minutes. For reliable cron jobs:

1. **Option A:** Upgrade to a paid plan ($7 **Option B:**/month)
2. Use Render's built-in cron
3. **Option C:** Use an external cron service (e.g., cron-job.org)

### 11.3 Testing Deployment

```bash
# Health check
curl https://your-app.onrender.com/health

# Test chat
curl -X POST https://your-app.onrender.com/chat \
  -H "Content-Type: application/json" \
  -d '{"user_message": "Hello", "user_id": "1"}'
```

---

## 12. Environment Variables

### 12.1 Required Variables

```bash
# Server
PORT=8000

# LLM Providers
GROQ_API_KEY=your_groq_api_key
GEMINI_API_KEY=your_gemini_api_key
COHERE_API_KEY=your_cohere_api_key

# Database
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_anon_key
```

### 12.2 Optional Variables

```bash
# GitHub
GITHUB_USERNAME=your_username
GITHUB_TOKEN=your_personal_access_token

# Strava
STRAVA_CLIENT_ID=your_client_id
STRAVA_CLIENT_SECRET=your_client_secret
STRAVA_ACCESS_TOKEN=your_access_token
STRAVA_REFRESH_TOKEN=your_refresh_token

# Google Calendar
GOOGLE_CALENDAR_TOKEN=your_oauth_token
```

### 12.3 Getting API Keys

| Service | URL |
|---------|-----|
| Groq | https://console.groq.com/ |
| Gemini | https://aistudio.google.com/app/apikey |
| Cohere | https://dashboard.cohere.com/api-keys |
| Supabase | https://app.supabase.com/project/_/settings/api |
| Strava | https://www.strava.com/settings/api |
| GitHub | https://github.com/settings/tokens |

---

## 13. Troubleshooting Guide

### 13.1 Common Issues

| Issue | Solution |
|-------|----------|
| Supabase connection failed | Check SUPABASE_URL and SUPABASE_ANON_KEY |
| GitHub rate limited | Wait 1 hour or add GITHUB_TOKEN |
| Strava token expired | Refresh token or re-authenticate |
| Google Calendar 401 | Need proper OAuth 2.0 token |
| Embedding dimension mismatch | Ensure Cohere v3.0 is used (1024 dims) |
| Cron not running on Render | Upgrade to paid plan or use external cron |
| Duplicate commits in DB | Fixed in v2.0 with duplicate prevention |
| Missing historical data | Use `/api/github/sync-history` endpoint |

### 13.2 API Response Codes

| Code | Meaning |
|------|---------|
| 200 | Success |
| 400 | Bad request (missing params) |
| 401 | Unauthorized (invalid API key) |
| 500 | Server error |

### 13.3 Debug Mode

Enable debug logging by checking console output:

```bash
# Development
npm run dev

# Production - check logs in Render dashboard
```

---

## 14. File Structure

```
lukeOS-brain/
├── src/
│   ├── index.ts              # Express app entry point (Port 8000)
│   ├── main.ts               # Main controller & request handler
│   ├── types/
│   │   └── index.ts         # TypeScript interfaces
│   ├── routes/
│   │   ├── chat.ts          # /chat endpoint
│   │   └── productivity.ts  # Productivity API endpoints
│   └── services/
│       ├── supabase.ts      # Database service (all DB operations)
│       ├── groq.ts          # Groq LLM integration
│       ├── gemini.ts        # Gemini LLM integration
│       ├── embeddings.ts    # Cohere embeddings
│       ├── github.ts        # GitHub API integration
│       ├── strava.ts        # Strava API integration
│       ├── calendar.ts      # Google Calendar integration
│       ├── scoring.ts       # Productivity scoring
│       ├── cron.ts          # Scheduled data collection
│       ├── macrodroid.ts    # Webhook receiver
│       └── memory.ts        # In-memory fallback
├── documentation/
│   ├── ARCHITECTURE.md     # This file
│   ├── n8n-cron-jobs.json  # n8n workflows
│   └── n8n-daily-metrics.json
├── tests/
│   ├── curl-tests.sh       # REST API tests
│   └── run-tests.bat       # Windows test runner
├── db/
│   └── supabase-schema.sql # Database schema
├── .env                    # Environment variables (NOT committed)
├── package.json
├── tsconfig.json
└── README.md
```

---

## 15. API Quick Reference

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check |
| `/chat` | POST | AI chat (Groq) |
| `/api/activity` | POST | Log activity |
| `/api/activities` | GET | Get activities |
| `/api/goals` | POST/GET | Create/get goals |
| `/api/metrics/daily/:date` | GET | Daily metrics |
| `/api/metrics/weekly` | GET | Weekly metrics |
| `/api/cron/collect` | POST | Trigger collection |
| `/api/cron/status` | GET | Cron status |
| `/api/github/sync` | POST | Sync GitHub data |
| `/api/github/sync-history` | POST | Backfill historical GitHub |
| `/api/strava/sync` | POST | Sync Strava data |
| `/webhook/macrodroid` | POST | Receive webhook |
| `/auth/strava` | GET | Get OAuth URL |
| `/auth/strava/token` | POST | Exchange OAuth code |

---

## Appendix A: Productivity Scoring

### Scoring Weights

| Category | Max Points | Criteria |
|----------|------------|----------|
| Coding | 30 | Commits (10), PRs (10), Coding time (10) |
| Exercise | 25 | Minutes (15), Streak (5), Today bonus (5) |
| Focus | 25 | Focus time (15), Deep work (5), Meetings penalty (5) |
| Health | 10 | Sleep (5), Steps (5) |

### Grade Scale

| Score | Grade |
|-------|-------|
| 90-100 | A+ |
| 80-89 | A |
| 70-79 | B |
| 60-69 | C |
| 50-59 | D |
| 0-49 | F |

---

## Appendix B: Natural Language Date Parsing

The system understands natural language date queries:

| Query | Date Range | Example |
|-------|------------|---------|
| `today` | Current day | "show me today's commits" |
| `yesterday` | Previous day | "what did I do yesterday" |
| `this week` | Last 7 days | "my activity this week" |
| `last week` | Last 7 days | "commits from last week" |
| `this month` | Last 30 days | "exercise this month" |
| `last month` | Last 30 days | "productivity last month" |
| `last 2 weeks` | 14 days | "show last 2 weeks" |
| `last 3 days` | 3 days | "what in last 3 days" |
| `last 7 days` | 7 days | "last 7 days commits" |
| (default) | 90 days | Comprehensive context |

---

*Document generated on March 7, 2026 - LukeOS v2.0*
