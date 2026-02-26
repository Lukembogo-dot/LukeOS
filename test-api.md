# LukeOS Brain API Test Templates

## Base URL
```
http://localhost:8000
```

---

## 1. Health Check

**Endpoint:** `GET /health`

### curl
```bash
curl -X GET http://localhost:8000/health
```

### Expected Response
```json
{
  "status": "ok",
  "timestamp": "2026-02-26T12:00:00.000Z"
}
```

---

## 2. Chat Mode (Default)

**Endpoint:** `POST /chat`

### Request Body
```json
{
  "user_message": "Hello, how are you?",
  "user_id": "123456789",
  "mode": "chat"
}
```

### curl
```bash
curl -X POST http://localhost:8000/chat \
  -H "Content-Type: application/json" \
  -d '{"user_message": "Hello, how are you?", "user_id": "123456789", "mode": "chat"}'
```

### Expected Response
```json
{
  "response": "Hello! I'm doing well...",
  "embedding": [0.123, -0.456, ...],
  "metadata": {
    "mode": "chat",
    "provider": "groq",
    "model": "llama-3.3-70b-versatile",
    "memory_used": true,
    "retrieved_messages": 1,
    "timestamp": "2026-02-26T12:00:00.000Z"
  }
}
```

---

## 3. Embed Mode (Generate Embedding)

**Endpoint:** `POST /chat`

### Request Body
```json
{
  "user_message": "What is machine learning?",
  "user_id": "123456789",
  "mode": "embed"
}
```

### curl
```bash
curl -X POST http://localhost:8000/chat \
  -H "Content-Type: application/json" \
  -d '{"user_message": "What is machine learning?", "user_id": "123456789", "mode": "embed"}'
```

### Expected Response
```json
{
  "response": "Embedding generated successfully.",
  "embedding": [0.123, -0.456, ...],
  "metadata": {
    "mode": "embed",
    "provider": "cohere",
    "model": "embed-english-v3.0",
    "memory_used": false,
    "retrieved_messages": 0,
    "timestamp": "2026-02-26T12:00:00.000Z"
  }
}
```

---

## 4. Analyze Mode (Gemini Analysis)

**Endpoint:** `POST /chat`

### Request Body
```json
{
  "user_message": "Help me write a Python function",
  "user_id": "123456789",
  "mode": "analyze"
}
```

### curl
```bash
curl -X POST http://localhost:8000/chat \
  -H "Content-Type: application/json" \
  -d '{"user_message": "Help me write a Python function", "user_id": "123456789", "mode": "analyze"}'
```

### Expected Response
```json
{
  "response": "I'd be happy to help you write a Python function...",
  "embedding": [0.123, -0.456, ...],
  "metadata": {
    "mode": "analyze",
    "provider": "gemini",
    "model": "gemini-2.0-flash",
    "memory_used": true,
    "retrieved_messages": 3,
    "timestamp": "2026-02-26T12:00:00.000Z"
  }
}
```

---

## 5. Test Error Cases

### Missing user_message
```bash
curl -X POST http://localhost:8000/chat \
  -H "Content-Type: application/json" \
  -d '{"user_id": "123456789", "mode": "chat"}'
```

### Missing user_id
```bash
curl -X POST http://localhost:8000/chat \
  -H "Content-Type: application/json" \
  -d '{"user_message": "Hello", "mode": "chat"}'
```

---

## 6. Verify Supabase Storage

After running chat requests, check your Supabase dashboard:

1. Go to **Supabase Dashboard** → **Table Editor**
2. Check `user_profile` table - should contain users with telegram_id
3. Check `conversations` table - should contain messages with embeddings

### SQL to check data:
```sql
-- Check users
SELECT * FROM user_profile;

-- Check conversations (last 10)
SELECT id, role, message_text, embedding IS NOT NULL as has_embedding, created_at 
FROM conversations 
ORDER BY created_at DESC 
LIMIT 10;
```

---

## 7. Test with Different user_ids

Test that different users get separate conversation histories:

```bash
# User 1
curl -X POST http://localhost:8000/chat \
  -H "Content-Type: application/json" \
  -d '{"user_message": "My name is John", "user_id": "111111111", "mode": "chat"}'

# User 2  
curl -X POST http://localhost:8000/chat \
  -H "Content-Type: application/json" \
  -d '{"user_message": "My name is Jane", "user_id": "222222222", "mode": "chat"}'

# User 1 again - should NOT see Jane's message
curl -X POST http://localhost:8000/chat \
  -H "Content-Type: application/json" \
  -d '{"user_message": "What is my name?", "user_id": "111111111", "mode": "chat"}'
```

---

## 8. Postman/Insomnia Collection Import

```json
{
  "info": {
    "name": "LukeOS Brain API",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  "item": [
    {
      "name": "Health Check",
      "request": {
        "method": "GET",
        "url": "http://localhost:8000/health"
      }
    },
    {
      "name": "Chat Mode",
      "request": {
        "method": "POST",
        "url": "http://localhost:8000/chat",
        "body": {
          "mode": "json",
          "json": {
            "user_message": "Hello",
            "user_id": "123456789",
            "mode": "chat"
          }
        }
      }
    },
    {
      "name": "Embed Mode",
      "request": {
        "method": "POST",
        "url": "http://localhost:8000/chat",
        "body": {
          "mode": "json",
          "json": {
            "user_message": "Test embedding",
            "user_id": "123456789",
            "mode": "embed"
          }
        }
      }
    },
    {
      "name": "Analyze Mode",
      "request": {
        "method": "POST",
        "url": "http://localhost:8000/chat",
        "body": {
          "mode": "json",
          "json": {
            "user_message": "Analyze this",
            "user_id": "123456789",
            "mode": "analyze"
          }
        }
      }
    }
  ]
}
```
