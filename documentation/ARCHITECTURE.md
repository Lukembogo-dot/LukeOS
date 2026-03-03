# LukeOS Brain - Technical Architecture Documentation

**Version:** 1.0  
**Date:** March 3, 2026  
**Author:** LukeOS Development Team

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [High-Level Architecture](#2-high-level-architecture)
3. [Component Architecture](#3-component-architecture)
4. [Data Flow Diagrams](#4-data-flow-diagrams)
5. [API Endpoints](#5-api-endpoints)
6. [Database Schema](#6-database-schema)
7. [External Integrations](#7-external-integrations)
8. [n8n Integration](#8-n8n-integration)
9. [Cron Jobs & Automation](#9-cron-jobs--automation)
10. [Environment Variables](#10-environment-variables)
11. [Setup Instructions](#11-setup-instructions)
12. [Troubleshooting](#12-troubleshooting)

---

## 1. System Overview

### 1.1 Purpose

LukeOS Brain is an intelligent productivity tracking system that combines:
- **AI-powered chat assistant** using Groq (LLM) and Gemini (analysis)
- **Vector-based memory** using Cohere embeddings for semantic search
- **Multi-source data aggregation** from GitHub, Strava, Google Calendar, and MacroDroid
- **Productivity scoring** with pattern detection and insights
- **Persistent storage** via Supabase (PostgreSQL with pgvector)

### 1.2 Technology Stack

| Layer | Technology |
|-------|------------|
| **Runtime** | Node.js + TypeScript |
| **Web Framework** | Express.js |
| **LLM Providers** | Groq (chat), Gemini (analysis) |
| **Embeddings** | Cohere v3.0 (1024-dim vectors) |
| **Database** | Supabase (PostgreSQL + pgvector) |
| **External APIs** | GitHub, Strava, Google Calendar |
| **Automation** | n8n (workflows), node-cron (scheduled tasks) |
| **Mobile Input** | MacroDroid (Android automation) |

### 1.3 Core Features

1. **Chat Mode**: Conversational AI assistant with conversation history
2. **Analyze Mode**: Deep analysis using Gemini with memory context
3. **Embed Mode**: Generate semantic embeddings for RAG
4. **Activity Tracking**: Log coding, exercise, screen time, etc.
5. **Goal Management**: Set and track daily/weekly/monthly goals
6. **Productivity Scoring**: AI-calculated scores with grades (A+ to F)
7. **Weekly Analysis**: AI-generated productivity reports
8. **Pattern Detection**: Identify trends and correlations
9. **Cron Collection**: Automated weekly data collection

---

## 2. High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           CLIENTS                                        │
├─────────────┬──────────────┬──────────────┬─────────────┬─────────────┤
│   Telegram   │    n8n       │  MacroDroid  │  Web Apps   │   CLI       │
│   Bot        │  Workflows   │   (Android)  │             │  (curl)     │
└──────┬───────┴──────┬───────┴──────┬───────┴──────┬─────┴──────┬────┘
       │              │              │              │            │
       ▼              ▼              ▼              ▼            ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                        LUKEOS BRAIN API (Port 8000)                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐    │
│  │  /chat      │  │  /api/*     │  │  /webhook/* │  │  /health    │    │
│  │  Routes     │  │  Routes     │  │  Routes     │  │  Endpoint   │    │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └─────────────┘    │
│         │                │                │                               │
│         ▼                ▼                ▼                               │
│  ┌──────────────────────────────────────────────────────────────────┐    │
│  │                      MAIN CONTROLLER (main.ts)                   │    │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌──────────┐  │    │
│  │  │ Groq       │  │ Gemini     │  │ Embeddings │  │ Scoring  │  │    │
│  │  │ Service    │  │ Service    │  │ Service    │  │ Service  │  │    │
│  │  └────────────┘  └────────────┘  └────────────┘  └──────────┘  │    │
│  └──────────────────────────────────────────────────────────────────┘    │
│                                    │                                      │
│         ┌──────────────────────────┼──────────────────────────┐           │
│         ▼                          ▼                          ▼           │
│  ┌─────────────┐          ┌─────────────┐          ┌─────────────┐      │
│  │  GitHub     │          │  Strava     │          │  Calendar   │      │
│  │  Service    │          │  Service    │          │  Service    │      │
│  └─────────────┘          └─────────────┘          └─────────────┘      │
│                                    │                                      │
│                                    ▼                                      │
│  ┌──────────────────────────────────────────────────────────────────┐    │
│  │                   SUPABASE (PostgreSQL + pgvector)                 │    │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────┐    │    │
│  │  │User      │  │Conversa- │  │Activities│  │Goals         │    │    │
│  │  │Profiles  │  │tions     │  │          │  │              │    │    │
│  │  └──────────┘  └──────────┘  └──────────┘  └──────────────┘    │    │
│  └──────────────────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                         EXTERNAL APIS                                     │
├─────────────────┬─────────────────┬─────────────────┬─────────────────────┤
│   Groq API      │  Gemini API     │  Cohere API     │  GitHub API         │
│   (LLM Chat)   │  (Analysis)    │  (Embeddings)   │  (Activity)         │
└─────────────────┴─────────────────┴─────────────────┴─────────────────────┘
         │                  │                  │                  │
         ▼                  ▼                  ▼                  ▼
┌─────────────────┬─────────────────┬─────────────────┬─────────────────────┐
│  Strava API     │  Google         │  MacroDroid     │                     │
│  (Exercise)     │  Calendar API   │  (Android)      │                     │
│                 │  (Meetings)     │  (Sensors)      │                     │
└─────────────────┴─────────────────┴─────────────────┴─────────────────────┘
```

---

## 3. Component Architecture

### 3.1 Core Services

#### 3.1.1 Main Controller (`src/main.ts`)

**Responsibilities:**
- Route requests to appropriate handlers based on `mode`
- Coordinate between LLM providers and memory services
- Generate embeddings asynchronously
- Handle error cases and fallbacks

**Modes:**
| Mode | Provider | Use Case |
|------|----------|----------|
| `chat` | Groq (Llama 3.3) | General conversation |
| `analyze` | Gemini | Deep analysis with context |
| `embed` | Cohere | Generate embeddings only |

#### 3.1.2 Supabase Service (`src/services/supabase.ts`)

**Responsibilities:**
- Initialize Supabase client
- User profile management (upsert for race condition safety)
- Conversation storage with embeddings
- Activity logging and retrieval
- Goal management

**Key Functions:**
```typescript
// User Management
getOrCreateUser(telegramId, timezone) → user_id
getUserByTelegramId(telegramId) → user_id

// Conversations
saveConversation(userId, role, messageText, embedding)
getConversationHistory(userId, limit)
storeUserMessage(telegramId, messageText, embedding)
storeAssistantMessage(telegramId, messageText, embedding)

// Activities
logActivity(telegramId, categoryName, durationMinutes, notes, date, embedding)
getActivities(telegramId, startDate, endDate, categoryName?)
getWeeklySummary(telegramId, weekStartDate, weekEndDate)

// Goals
createGoal(telegramId, categoryName, targetValue, period, startDate?, endDate?)
getActiveGoals(telegramId)
updateGoal(goalId, updates)
getGoalProgress(telegramId, categoryName, periodStart, periodEnd)
```

#### 3.1.3 Embeddings Service (`src/services/embeddings.ts`)

**Responsibilities:**
- Generate embeddings using Cohere v3.0
- Fallback to local hash-based embeddings if API fails
- Support different input types (`search_query`, `search_document`)

**Configuration:**
- Model: `embed-english-v3.0`
- Vector Size: 1024 dimensions
- Input Types: `search_query` (queries), `search_document` (documents)

#### 3.1.4 Groq Service (`src/services/groq.ts`)

**Responsibilities:**
- Chat completion using Groq API
- Model: `llama-3.3-70b-versatile`

#### 3.1.5 Gemini Service (`src/services/gemini.ts`)

**Responsibilities:**
- Analysis and deep thinking using Gemini
- Automatic model fallback (tries multiple models)
- Models tried in order: `gemini-2.5-flash`, `gemini-2.5-pro`, `gemini-2.0-flash`

#### 3.1.6 Scoring Service (`src/services/scoring.ts`)

**Responsibilities:**
- Calculate productivity scores (0-100)
- Detect patterns in weekly data
- Generate insights and recommendations

**Scoring Weights:**
| Category | Max Points | Criteria |
|----------|------------|----------|
| Coding | 30 | Commits (10), PRs (10), Coding time (10) |
| Exercise | 25 | Minutes (15), Streak (5), Today bonus (5) |
| Focus | 25 | Focus time (15), Deep work (5), Meetings penalty (5) |
| Health | 10 | Sleep (5), Steps (5) |

### 3.2 External Integration Services

#### 3.2.1 GitHub Service (`src/services/github.ts`)

**Features:**
- Fetch commits and PRs for date range
- Filter events by date
- Calculate coding minutes (30 min/commit estimate)
- Support authenticated requests for higher rate limits

**API Endpoints Used:**
- `GET /users/{username}` - User info
- `GET /users/{username}/events` - Activity events

#### 3.2.2 Strava Service (`src/services/strava.ts`)

**Features:**
- Automatic token refresh
- Paginated activity retrieval
- Activity summarization
- Workout streak calculation

**API Endpoints Used:**
- `POST /oauth/token` - Token refresh
- `GET /api/v3/athlete/activities` - Activity list

#### 3.2.3 Calendar Service (`src/services/calendar.ts`)

**Features:**
- Fetch calendar events
- Event classification (focus, meeting, personal, work)
- Meeting and focus time calculation

**API Endpoints Used:**
- `GET /calendars/primary/events` - Event list

#### 3.2.4 MacroDroid Service (`src/services/macrodroid.ts`)

**Features:**
- Webhook receiver for Android automations
- Process screen time, app usage, steps, location
- Map custom events to activity categories

### 3.3 Automation Services

#### 3.3.1 Cron Service (`src/services/cron.ts`)

**Features:**
- Weekly data collection from GitHub and Strava
- Manual trigger endpoint
- Automatic scheduling (Sundays midnight)
- Stores collected data as activities in Supabase

---

## 4. Data Flow Diagrams

### 4.1 Chat Request Flow

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
             │  Cohere     │              │  Supabase   │       │   Client    │
             │ (Embeddings)│              │ (Store)     │       │  (Response) │
             └─────────────┘              └─────────────┘       └─────────────┘
```

### 4.2 Productivity Metrics Flow

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Client    │────▶│  Metrics    │────▶│   GitHub    │────▶│  GitHub API │
│ (Request)   │     │   Route     │     │   Service   │     │             │
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
                         │                   │
                         ▼                   ▼
                   ┌─────────────┐     ┌─────────────┐
                   │   Strava    │────▶│  Strava API │
                   │   Service   │     │             │
                   └─────────────┘     └─────────────┘
                         │
                         ▼
                   ┌─────────────┐     ┌─────────────┐
                   │  Calendar   │────▶│  Google     │
                   │   Service   │     │  Calendar   │
                   └─────────────┘     └─────────────┘
                         │
                         ▼
                   ┌─────────────┐     ┌─────────────┐
                   │  Scoring    │────▶│ Calculate   │
                   │   Service   │     │   Score     │
                   └─────────────┘     └─────────────┘
                         │
                         ▼
                   ┌─────────────┐
                   │   Client    │
                   │ (Response)  │
                   └─────────────┘
```

### 4.3 Cron Collection Flow

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   n8n or    │     │   Cron     │     │   GitHub    │     │  GitHub API │
│  Manual     │────▶│   Route    │────▶│   Service   │────▶│             │
│  Trigger    │     └─────────────┘     └─────────────┘     └─────────────┘
└─────────────┘           │                   │
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

---

## 5. API Endpoints

### 5.1 Chat Endpoints

#### POST /chat
Send a message to the AI assistant.

**Request:**
```json
{
  "user_message": "Hello, how are you?",
  "user_id": "123456789",
  "mode": "chat"  // "chat" | "analyze" | "embed"
}
```

**Response:**
```json
{
  "response": "Hello! I'm doing well...",
  "embedding": [...],
  "metadata": {
    "mode": "chat",
    "provider": "groq",
    "model": "llama-3.3-70b-versatile",
    "memory_used": true,
    "retrieved_messages": 5,
    "timestamp": "2026-03-03T12:00:00Z"
  }
}
```

### 5.2 Activity Endpoints

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
    "date": "2026-03-03"
  }'
```

#### GET /api/activities
Get activities for a date range.

```bash
curl "http://localhost:8000/api/activities?user_id=1&start_date=2026-02-24&end_date=2026-03-03"
```

### 5.3 Goals Endpoints

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

### 5.4 Metrics Endpoints

#### GET /api/metrics/daily/:date
Get daily metrics with productivity score.

```bash
curl "http://localhost:8000/api/metrics/daily/2026-03-03?user_id=1"
```

**Response:**
```json
{
  "date": "2026-03-03",
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
curl "http://localhost:8000/api/metrics/weekly?user_id=1&start_date=2026-02-24&end_date=2026-03-02"
```

### 5.5 Analysis Endpoints

#### GET /api/analysis/weekly
Get AI-generated weekly analysis.

```bash
curl "http://localhost:8000/api/analysis/weekly?user_id=1&week_start=2026-02-24&week_end=2026-03-02"
```

### 5.6 Cron Endpoints

#### POST /api/cron/collect
Trigger manual data collection.

```bash
curl -X POST "http://localhost:8000/api/cron/collect"
```

#### GET /api/cron/status
Get cron status.

```bash
curl "http://localhost:8000/api/cron/status"
```

### 5.7 Webhook Endpoints

#### POST /webhook/macrodroid
Receive data from MacroDroid.

```bash
curl -X POST "http://localhost:8000/webhook/macrodroid" \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "123456789",
    "event_type": "screen_time",
    "data": {
      "total_minutes": 180,
      "apps": [
        {"name": "VS Code", "minutes": 120},
        {"name": "Chrome", "minutes": 60}
      ]
    }
  }'
```

---

## 6. Database Schema

### 6.1 Tables

#### user_profile
| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| telegram_id | BIGINT | Unique Telegram ID |
| timezone | VARCHAR | User timezone |
| created_at | TIMESTAMP | Creation timestamp |
| updated_at | TIMESTAMP | Last update |

#### conversations
| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| user_id | UUID | FK to user_profile |
| role | VARCHAR | 'user' or 'assistant' |
| message_text | TEXT | Message content |
| embedding | vector(1024) | Cohere embedding |
| created_at | TIMESTAMP | Creation timestamp |

#### activities
| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| user_id | UUID | FK to user_profile |
| category_name | VARCHAR | Activity category |
| duration_minutes | INTEGER | Duration in minutes |
| notes | TEXT | Optional notes |
| activity_date | DATE | Activity date |
| embedding | vector(1024) | Optional embedding |
| created_at | TIMESTAMP | Creation timestamp |

#### goals
| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| user_id | UUID | FK to user_profile |
| category_name | VARCHAR | Goal category |
| target_value | INTEGER | Target value |
| period | VARCHAR | 'daily', 'weekly', 'monthly' |
| start_date | DATE | Start date |
| end_date | DATE | End date (optional) |
| is_active | BOOLEAN | Active status |
| created_at | TIMESTAMP | Creation timestamp |

### 6.2 SQL Setup

The database setup is in `db/setup-tables.sql`. Run this in Supabase SQL Editor:

```sql
-- Run the contents of db/setup-tables.sql in Supabase SQL Editor
```

---

## 7. External Integrations

### 7.1 GitHub Integration

**Required Environment Variables:**
```
GITHUB_USERNAME=Lukembogo-dot
GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxx
```

**Features:**
- Fetch commits and PRs
- Calculate coding minutes (30 min/commit)
- Rate limit: 60 requests/hour (unauthenticated), 5000/hour (authenticated)

### 7.2 Strava Integration

**Required Environment Variables:**
```
STRAVA_CLIENT_ID=xxxxx
STRAVA_CLIENT_SECRET=xxxxxxxxxxxxxxxxxxxx
STRAVA_ACCESS_TOKEN=xxxxxxxxxxxxxxxxxxxx
STRAVA_REFRESH_TOKEN=xxxxxxxxxxxxxxxxxxxx
```

**Features:**
- Automatic token refresh
- Fetch activities (runs, rides, swims, etc.)
- Calculate exercise minutes and streaks

### 7.3 Google Calendar Integration

**Required Environment Variables:**
```
GOOGLE_CALENDAR_TOKEN=xxxxx  # OAuth 2.0 access token
```

**Features:**
- Fetch calendar events
- Classify events (focus, meeting, personal)
- Calculate meeting and focus time

### 7.4 MacroDroid Integration

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

## 8. n8n Integration

### 8.1 Setup n8n

1. **Start n8n:**
   ```bash
   n8n start
   # or with custom port
   n8n start --port 5678
   ```

2. **Access n8n UI:**
   Open http://localhost:5678 in browser

### 8.2 Workflow Examples

#### 8.2.1 Weekly Data Collection Workflow

```json
{
  "name": "LukeOS Weekly Collection",
  "nodes": [
    {
      "parameters": {
        "rule": {
          "interval": [
            {
              "field": "weeks",
              "weeksInterval": 1
            }
          ]
        }
      },
      "id": "schedule",
      "name": "Weekly Trigger",
      "type": "n8n-nodes-base.scheduleTrigger",
      "typeVersion": 1,
      "position": [250, 300]
    },
    {
      "parameters": {
        "url": "http://localhost:8000/api/cron/collect",
        "method": "POST"
      },
      "id": "httpRequest",
      "name": "Trigger Collection",
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4,
      "position": [500, 300]
    },
    {
      "parameters": {
        "webhook": "telegram",
        "text": "✅ Weekly data collected!\n\nGitHub: {{ $json.github.commits }} commits\nStrava: {{ $json.strava.activities }} activities, {{ $json.strava.exerciseMinutes }} min"
      },
      "id": "telegram",
      "name": "Notify Telegram",
      "type": "n8n-nodes-base.telegram",
      "typeVersion": 1,
      "position": [750, 300]
    }
  ],
  "connections": {
    "Weekly Trigger": {
      "main": [[{"node": "Trigger Collection", "type": "main", "index": 0}]]
    },
    "Trigger Collection": {
      "main": [[{"node": "Notify Telegram", "type": "main", "index": 0}]]
    }
  }
}
```

#### 8.2.2 Daily Metrics to Telegram

```json
{
  "name": "Daily Productivity Alert",
  "nodes": [
    {
      "parameters": {
        "rule": {
          "interval": [
            {
              "field": "hours",
              "hoursInterval": 1
            }
          ]
        }
      },
      "id": "schedule",
      "name": "Daily Trigger",
      "type": "n8n-nodes-base.scheduleTrigger",
      "typeVersion": 1,
      "position": [250, 300]
    },
    {
      "parameters": {
        "url": "http://localhost:8000/api/metrics/daily/{{ $now.format('YYYY-MM-DD') }}?user_id=1",
        "method": "GET"
      },
      "id": "getMetrics",
      "name": "Get Daily Metrics",
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4,
      "position": [500, 300]
    },
    {
      "parameters": {
        "webhook": "telegram",
        "text": "📊 Daily Productivity Report\n\nScore: {{ $json.score }}/100 ({{ $json.grade }})\n{{ $json.description }}\n\nCoding: {{ $json.metrics.productive_app_minutes }} min\nExercise: {{ $json.metrics.exercise_minutes }} min\nMeetings: {{ $json.metrics.meetings_minutes }} min"
      },
      "id": "telegram",
      "name": "Send to Telegram",
      "type": "n8n-nodes-base.telegram",
      "typeVersion": 1,
      "position": [750, 300]
    }
  ],
  "connections": {
    "Daily Trigger": {
      "main": [[{"node": "Get Daily Metrics", "type": "main", "index": 0}]]
    },
    "Get Daily Metrics": {
      "main": [[{"node": "Send to Telegram", "type": "main", "index": 0}]]
    }
  }
}
```

#### 8.2.3 Weekly Analysis to Slack

```json
{
  "name": "Weekly Analysis Report",
  "nodes": [
    {
      "parameters": {
        "rule": {
          "interval": [
            {
              "field": "cronExpression",
              "cronExpression": "0 9 * * 0"
            }
          ]
        }
      },
      "id": "schedule",
      "name": "Sunday Morning",
      "type": "n8n-nodes-base.scheduleTrigger",
      "typeVersion": 1,
      "position": [250, 300]
    },
    {
      "parameters": {
        "url": "http://localhost:8000/api/analysis/weekly?user_id=1&week_start={{ $now.minus(7, 'days').format('YYYY-MM-DD') }}&week_end={{ $now.format('YYYY-MM-DD') }}",
        "method": "GET"
      },
      "id": "getAnalysis",
      "name": "Get Weekly Analysis",
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4,
      "position": [500, 300]
    },
    {
      "parameters": {
        "channel": "#productivity",
        "text": "📈 *Weekly Productivity Report*\n\n{{ $json.analysis }}",
        "additionalFields": {}
      },
      "id": "slack",
      "name": "Post to Slack",
      "type": "n8n-nodes-base.slack",
      "typeVersion": 3,
      "position": [750, 300]
    }
  ],
  "connections": {
    "Sunday Morning": {
      "main": [[{"node": "Get Weekly Analysis", "type": "main", "index": 0}]]
    },
    "Get Weekly Analysis": {
      "main": [[{"node": "Post to Slack", "type": "main", "index": 0}]]
    }
  }
}
```

---

## 9. Cron Jobs & Automation

### 9.1 Weekly Collection

The cron service automatically collects data every Sunday at midnight.

**Manual Trigger:**
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

### 9.2 Data Collected

| Source | Data | Storage |
|--------|------|---------|
| GitHub | Commits, PRs | `coding` activity |
| Strava | Activities | `exercise` activity |

---

## 10. Environment Variables

### 10.1 Required Variables

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

### 10.2 Optional Variables

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

### 10.3 Getting API Keys

| Service | URL |
|---------|-----|
| Groq | https://console.groq.com/ |
| Gemini | https://aistudio.google.com/app/apikey |
| Cohere | https://dashboard.cohere.com/api-keys |
| Supabase | https://app.supabase.com/project/_/settings/api |
| Strava | https://www.strava.com/settings/api |
| GitHub | https://github.com/settings/tokens |

---

## 11. Setup Instructions

### 11.1 Prerequisites

- Node.js 18+
- npm or yarn
- Supabase account
- API keys for integrated services

### 11.2 Installation

```bash
# Clone or navigate to project
cd lukeOS-brain

# Install dependencies
npm install

# Install node-cron for scheduled jobs
npm install node-cron @types/node-cron
```

### 11.3 Database Setup

1. Create Supabase project
2. Run `db/setup-tables.sql` in SQL Editor
3. Copy URL and anon key to `.env`

### 11.4 Running the Server

```bash
# Development
npm run dev

# Production
npm run build
npm start
```

### 11.5 Testing

```bash
# Health check
curl http://localhost:8000/health

# Chat
curl -X POST http://localhost:8000/chat \
  -H "Content-Type: application/json" \
  -d '{"user_message": "Hello", "user_id": "1"}'

# Log activity
curl -X POST http://localhost:8000/api/activity \
  -H "Content-Type: application/json" \
  -d '{"user_id": "1", "category_name": "coding", "duration_minutes": 60}'

# Get metrics
curl "http://localhost:8000/api/metrics/daily/2026-03-03?user_id=1"
```

---

## 12. Troubleshooting

### 12.1 Common Issues

| Issue | Solution |
|-------|----------|
| Supabase connection failed | Check SUPABASE_URL and SUPABASE_ANON_KEY |
| GitHub rate limited | Wait 1 hour or add GITHUB_TOKEN |
| Strava token expired | Refresh token at https://www.strava.com/settings/api |
| Google Calendar 401 | Need proper OAuth 2.0 token |
| Embedding dimension mismatch | Ensure Cohere v3.0 is used (1024 dims) |

### 12.2 API Response Codes

| Code | Meaning |
|------|---------|
| 200 | Success |
| 400 | Bad request (missing params) |
| 401 | Unauthorized (invalid API key) |
| 500 | Server error |

---

## Appendix A: File Structure

```
lukeOS-brain/
├── src/
│   ├── index.ts              # Express app entry point
│   ├── main.ts               # Main controller
│   ├── types/
│   │   └── index.ts         # TypeScript types
│   ├── routes/
│   │   ├── chat.ts          # Chat endpoint
│   │   └── productivity.ts  # Productivity endpoints
│   └── services/
│       ├── supabase.ts      # Database service
│       ├── groq.ts          # Groq API
│       ├── gemini.ts        # Gemini API
│       ├── embeddings.ts    # Cohere embeddings
│       ├── github.ts        # GitHub API
│       ├── strava.ts        # Strava API
│       ├── calendar.ts      # Google Calendar
│       ├── scoring.ts       # Productivity scoring
│       ├── cron.ts          # Scheduled collection
│       ├── macrodroid.ts    # Webhook receiver
│       └── memory.ts        # In-memory fallback
├── db/
│   ├── setup-tables.sql     # Database setup
│   └── supabase-schema.sql  # Full schema
├── .env                     # Environment variables
├── package.json
└── tsconfig.json
```

---

## Appendix B: API Quick Reference

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check |
| `/chat` | POST | AI chat |
| `/api/activity` | POST | Log activity |
| `/api/activities` | GET | Get activities |
| `/api/goals` | POST/GET | Create/get goals |
| `/api/metrics/daily/:date` | GET | Daily metrics |
| `/api/metrics/weekly` | GET | Weekly metrics |
| `/api/analysis/weekly` | GET | AI analysis |
| `/api/cron/collect` | POST | Trigger collection |
| `/api/cron/status` | GET | Cron status |
| `/webhook/macrodroid` | POST | Receive webhook |

---

*Document generated on March 3, 2026*
