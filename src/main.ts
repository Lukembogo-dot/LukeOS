import { ChatRequest, ChatResponse, GroqMessage } from './types';
import { chatWithGroq } from './services/groq';
import { analyzeWithGemini, GEMINI_MODEL } from './services/gemini';
import { generateEmbedding } from './services/embeddings';
import { getMemoryContext, getRecentMessages, getRetrievedCount, saveConversation } from './services/memory';

const SYSTEM_PROMPT = 'You are LukeOS assistant. Be concise, practical, and accurate.';
const GROQ_MODEL = 'llama-3.3-70b-versatile';

export async function handleBrainRequest(payload: ChatRequest): Promise<ChatResponse> {
  const { user_message, user_id, mode = 'chat' } = payload;

  if (!user_message || !user_id) {
    throw new Error('user_message and user_id are required');
  }

  const huggingfaceApiKey = process.env.HUGGINGFACE_API_KEY;
  const groqApiKey = process.env.GROQ_API_KEY;
  const geminiApiKey = process.env.GEMINI_API_KEY;
  const timestamp = new Date().toISOString();

  if (mode === 'embed') {
    const embedResult = await generateEmbedding(user_message, huggingfaceApiKey);

    return {
      response: 'Embedding generated successfully.',
      embedding: embedResult.embedding,
      metadata: {
        mode,
        provider: embedResult.provider,
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

    const memoryContext = getMemoryContext(user_id);
    const analysisPrompt = `Analyze this user input with context.\n\nMemory:\n${memoryContext}\n\nInput:\n${user_message}`;
    const analysis = await analyzeWithGemini(analysisPrompt, geminiApiKey);
    const embedResult = await generateEmbedding(analysis, huggingfaceApiKey);

    return {
      response: analysis,
      embedding: embedResult.embedding,
      metadata: {
        mode,
        provider: 'gemini',
        model: GEMINI_MODEL,
        memory_used: true,
        retrieved_messages: getRetrievedCount(user_id),
        timestamp,
      },
    };
  }

  if (!groqApiKey) {
    throw new Error('GROQ_API_KEY is not configured');
  }

  const memoryMessages = getRecentMessages(user_id);
  const messages: GroqMessage[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...memoryMessages,
    { role: 'user', content: user_message },
  ];

  const chatResponse = await chatWithGroq(messages, groqApiKey);
  saveConversation(user_id, user_message, chatResponse);

  const embedResult = await generateEmbedding(chatResponse, huggingfaceApiKey);

  return {
    response: chatResponse,
    embedding: embedResult.embedding,
    metadata: {
      mode: 'chat',
      provider: 'groq',
      model: GROQ_MODEL,
      memory_used: memoryMessages.length > 0,
      retrieved_messages: getRetrievedCount(user_id),
      timestamp,
    },
  };
}
