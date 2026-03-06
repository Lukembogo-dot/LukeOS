# =============================================================================
# LukeOS AI Test Script
# =============================================================================
# Test the AI flow: embeddings → chat → analysis
# Run with: bash tests/test-ai.sh
# Or use the curl commands below directly
# =============================================================================

BASE_URL="http://localhost:8000"
USER_ID="1966734159"

echo "============================================"
echo "LukeOS AI Flow Test"
echo "============================================"

# -----------------------------------------------------------------------------
# Test 1: Generate Embedding (mode=embed)
# -----------------------------------------------------------------------------
echo ""
echo ">>> Test 1: Generate Embedding"
echo "--------------------------------"

curl -s -X POST "$BASE_URL/api/chat" \
  -H "Content-Type: application/json" \
  -d "{
    \"user_id\": \"$USER_ID\",
    \"user_message\": \"I love coding in TypeScript\",
    \"mode\": \"embed\"
  }" | jq '{
    provider: .metadata.provider,
    model: .metadata.model,
    embedding_length: (.embedding | length),
    response: .response
  }'

# -----------------------------------------------------------------------------
# Test 2: Chat with Groq (default mode)
# -----------------------------------------------------------------------------
echo ""
echo ">>> Test 2: Chat with Groq"
echo "--------------------------------"

curl -s -X POST "$BASE_URL/api/chat" \
  -H "Content-Type: application/json" \
  -d "{
    \"user_id\": \"$USER_ID\",
    \"user_message\": \"What can you help me with?\"
  }" | jq '{
    provider: .metadata.provider,
    model: .metadata.model,
    memory_used: .metadata.memory_used,
    retrieved_messages: .metadata.retrieved_messages,
    response: .response
  }'

# -----------------------------------------------------------------------------
# Test 3: Chat with context (second message)
# -----------------------------------------------------------------------------
echo ""
echo ">>> Test 3: Chat with Memory"
echo "--------------------------------"

curl -s -X POST "$BASE_URL/api/chat" \
  -H "Content-Type: application/json" \
  -d "{
    \"user_id\": \"$USER_ID\",
    \"user_message\": \"I want to track my coding time\"
  }" | jq '{
    provider: .metadata.provider,
    memory_used: .metadata.memory_used,
    retrieved_messages: .metadata.retrieved_messages,
    response: .response
  }'

# -----------------------------------------------------------------------------
# Test 4: Analyze with Gemini (mode=analyze)
# -----------------------------------------------------------------------------
echo ""
echo ">>> Test 4: Analyze with Gemini"
echo "--------------------------------"

curl -s -X POST "$BASE_URL/api/chat" \
  -H "Content-Type: application/json" \
  -duser_id\": \" "{
    \"$USER_ID\",
    \"user_message\": \"Analyze my productivity patterns\",
    \"mode\": \"analyze\"
  }" | jq '{
    provider: .metadata.provider,
    model: .metadata.model,
    memory_used: .metadata.memory_used,
    retrieved_messages: .metadata.retrieved_messages,
    response: .response
  }'

# -----------------------------------------------------------------------------
# Test 5: Check stored conversations in DB
# -----------------------------------------------------------------------------
echo ""
echo ">>> Test 5: Verify Conversations Stored"
echo "--------------------------------"
echo "Run this in Supabase SQL Editor:"
echo "SELECT role, message_text, embedding IS NOT NULL as has_embedding, created_at"
echo "FROM conversations"
echo "WHERE user_id = (SELECT id FROM user_profile WHERE telegram_id = $USER_ID)"
echo "ORDER BY created_at DESC LIMIT 5;"

echo ""
echo "============================================"
echo "Tests Complete!"
echo "============================================"
