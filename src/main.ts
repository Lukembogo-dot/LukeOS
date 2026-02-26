import { ChatRequest, ChatResponse, GroqMessage } from './types';
import { chatWithGroq } from './services/groq';
import { analyzeWithGemini, GEMINI_MODEL } from './services/gemini';
import { generateEmbedding } from './services/embeddings';
import { getMemoryContext, getRecentMessages, getRetrievedCount, saveConversation } from './services/memory';
import { storeUserMessage, storeAssistantMessage, getConversationHistory, getUserByTelegramId } from './services/supabase';

const SYSTEM_PROMPT = 'You are LukeOS assistant. Be concise, practical, and accurate.';
const GROQ_MODEL = 'llama-3.3-70b-versatile';

export async function handleBrainRequest(payload: ChatRequest): Promise<ChatResponse> {
  const { user_message, user_id, mode = 'chat' } = payload;

  if (!user_message || !user_id) {
    throw new Error('user_message and user_id are required');
  }

  // Convert user_id to telegramId (assume it's a number or parse from string)
  const telegramId = typeof user_id === 'string' ? parseInt(user_id, 10) : user_id;
  const isValidTelegramId = Number.isInteger(telegramId) && telegramId > 0 && telegramId < Number.MAX_SAFE_INTEGER;

  const cohereApiKey = process.env.COHERE_API_KEY;
  const groqApiKey = process.env.GROQ_API_KEY;
  const geminiApiKey = process.env.GEMINI_API_KEY;
  const timestamp = new Date().toISOString();

  if (mode === 'embed') {
    const embedResult = await generateEmbedding(user_message, cohereApiKey, 'search_query');

    // Store user message with embedding in Supabase if available
    if (isValidTelegramId && embedResult.embedding) {
      void storeUserMessage(telegramId, user_message, embedResult.embedding).catch((err) => {
        console.error('⚠️ Failed to store embed message in Supabase:', err);
      });
    }

    // Determine actual provider for metadata - report actual provider used
    // (local fallback indicates embedding generation was local, not from external API)
    const actualProvider = embedResult.provider;

    return {
      response: 'Embedding generated successfully.',
      embedding: embedResult.embedding,
      metadata: {
        mode,
        provider: actualProvider,
        model: embedResult.model,
        memory_used: false,
        retrieved_messages: 0,
        timestamp,
      },
    };
  }

  if (mode === 'analyze') {
    if (!geminiApiKey) {
      throw new Error('GEMINI_API_KEY is not configured');
    }

    // Try to get context from Supabase, fallback to in-memory
    let memoryContext = '';
    let retrievedMessages = 0;
    if (isValidTelegramId) {
      const userId = await getUserByTelegramId(telegramId);
      if (userId) {
        const history = await getConversationHistory(userId, 5);
        memoryContext = history.map(m => `${m.role}: ${m.content}`).join('\n');
        retrievedMessages = history.length;
      }
    }
    
    // Fallback to in-memory if Supabase not available
    if (!memoryContext) {
      memoryContext = getMemoryContext(user_id);
      retrievedMessages = getRetrievedCount(user_id);
    }

    const analysisPrompt = `Analyze this user input with context.\n\nMemory:\n${memoryContext}\n\nInput:\n${user_message}`;
    const analysis = await analyzeWithGemini(analysisPrompt, geminiApiKey);
    
    // Generate embeddings for both user message and assistant response separately
    // User messages use 'search_query' type, assistant responses use 'search_document' type
    const userEmbedResult = await generateEmbedding(user_message, cohereApiKey, 'search_query');
    const analysisEmbedResult = await generateEmbedding(analysis, cohereApiKey, 'search_document');

    // Store in Supabase if available
    if (isValidTelegramId) {
      void storeUserMessage(telegramId, user_message, userEmbedResult.embedding).catch((err) => {
        console.error('⚠️ Failed to store user message in Supabase:', err);
      });
      void storeAssistantMessage(telegramId, analysis, analysisEmbedResult.embedding).catch((err) => {
        console.error('⚠️ Failed to store assistant message in Supabase:', err);
      });
    }

    return {
      response: analysis,
      embedding: analysisEmbedResult.embedding,
      metadata: {
        mode,
        provider: 'gemini',
        model: GEMINI_MODEL,
        memory_used: true,
        retrieved_messages: retrievedMessages,
        timestamp,
      },
    };
  }

  if (!groqApiKey) {
    throw new Error('GROQ_API_KEY is not configured');
  }

  // Get conversation history - try Supabase first, then in-memory fallback
  let memoryMessages: Array<{ role: 'user' | 'assistant'; content: string }> = [];
  let retrievedMessages = 0;
  
  if (isValidTelegramId) {
    const userId = await getUserByTelegramId(telegramId);
    if (userId) {
      memoryMessages = await getConversationHistory(userId, 10);
      retrievedMessages = memoryMessages.length;
    }
  }
  
  // Fallback to in-memory if no Supabase history
  if (memoryMessages.length === 0) {
    const recentMessages = getRecentMessages(user_id);
    // Validate role type to ensure type safety
    memoryMessages = recentMessages
      .filter(m => m.role === 'user' || m.role === 'assistant')
      .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }));
    retrievedMessages = getRetrievedCount(user_id);
  }

  const messages: GroqMessage[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...memoryMessages,
    { role: 'user', content: user_message },
  ];

  const chatResponse = await chatWithGroq(messages, groqApiKey);

  // Store in Supabase if available, otherwise use in-memory fallback
  // Generate embeddings asynchronously - don't block the response
  let chatEmbedding: number[] | undefined;
  if (isValidTelegramId) {
    // Start embedding generation in background (non-blocking)
    const embeddingPromise = Promise.all([
      generateEmbedding(user_message, cohereApiKey, 'search_query'),
      generateEmbedding(chatResponse, cohereApiKey, 'search_document')
    ]).then(([userEmbed, assistantEmbed]) => {
      chatEmbedding = assistantEmbed.embedding;
      // Store in Supabase after embeddings are ready
      return Promise.all([
        storeUserMessage(telegramId, user_message, userEmbed.embedding),
        storeAssistantMessage(telegramId, chatResponse, assistantEmbed.embedding)
      ]);
    }).catch((err) => {
      console.error('⚠️ Failed to generate/store embeddings for chat:', err);
      // Fallback to in-memory on failure
      saveConversation(user_id, user_message, chatResponse);
    });

    // Fire and forget - don't await, return immediately with response
    void embeddingPromise;
  } else {
    // Fallback to in-memory only when Supabase is not available
    saveConversation(user_id, user_message, chatResponse);
  }

  return {
    response: chatResponse,
    embedding: chatEmbedding,
    metadata: {
      mode: 'chat',
      provider: 'groq',
      model: GROQ_MODEL,
      memory_used: memoryMessages.length > 0,
      retrieved_messages: retrievedMessages,
      timestamp,
    },
  };
}
