import { ChatRequest, ChatResponse, GroqMessage } from './types';
import { chatWithGroq } from './services/groq';
import { analyzeWithGemini, GEMINI_MODEL } from './services/gemini';
import { generateEmbedding } from './services/embeddings';
import { getMemoryContext, getRecentMessages, getRetrievedCount, saveConversation } from './services/memory';
import { storeUserMessage, storeAssistantMessage, getConversationHistory, getUserByTelegramId, getWeeklySummary, getActiveGoals, syncAllGitHubActivity } from './services/supabase';
import { getGitHubActivity } from './services/github';
import { getAllStravaActivities, summarizeStravaActivities } from './services/strava';

const SYSTEM_PROMPT = `You are LukeOS, a productivity assistant. You have access to the user's data:
- Their conversation history
- Their logged activities (coding, exercise, reading, etc.)
- Their goals and progress

IMPORTANT: When the user asks about their productivity, ALWAYS check their data first before giving generic advice. Use their actual logged activities and goals to provide personalized answers.

Be concise, practical, and accurate.`;
const GROQ_MODEL = 'llama-3.3-70b-versatile';

export async function handleBrainRequest(payload: ChatRequest): Promise<ChatResponse> {
  const { user_message, user_id, mode = 'chat' } = payload;

  if (!user_message || !user_id) {
    throw new Error('user_message and user_id are required');
  }

  // Auto-detect analyze mode based on user message - ONLY for heavy analysis
  // Use Gemini for: analysis, evaluation, productivity, reports
  // Use Groq for: regular chat, questions, conversations
  const userMessageLower = user_message.toLowerCase();
  const isAnalyzeQuery = userMessageLower.includes('analyze') || 
                        userMessageLower.includes('evaluation') ||
                        userMessageLower.includes('productivity score') ||
                        userMessageLower.includes('generate report') ||
                        userMessageLower.includes('weekly report') ||
                        userMessageLower.includes('monthly report') ||
                        userMessageLower.includes('productivity report') ||
                        userMessageLower.includes('detailed analysis') ||
                        userMessageLower.includes('comprehensive') ||
                        (userMessageLower.includes('percentage') && userMessageLower.includes('productivity')) ||
                        (userMessageLower.includes('score') && userMessageLower.includes('productivity')) ||
                        userMessageLower.includes('assess my performance');
  
  // Only auto-switch to Gemini if it's clearly a heavy analysis request
  const effectiveMode = isAnalyzeQuery && mode === 'chat' ? 'analyze' : mode;

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

  if (effectiveMode === 'embed') {
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

  if (effectiveMode === 'analyze') {
    if (!geminiApiKey) {
      throw new Error('GEMINI_API_KEY is not configured');
    }

    // Try to get context from Supabase, fallback to in-memory
    let memoryContext = '';
    let retrievedMessages = 0;
    if (isValidTelegramId) {
      const userId = await getUserByTelegramId(telegramId);
      if (userId) {
        const history = await getConversationHistory(userId, 20);
        memoryContext = history.map(m => `${m.role}: ${m.content}`).join('\n');
        retrievedMessages = history.length;
        
        // Get activities from database - parse date from user message for targeted queries
        const today = new Date();
        let startDate = new Date(today);
        let endDate = new Date(today);
        let dateLabel = 'last 90 days';
        
        // Detect date-specific queries for activities
        const msgLower = userMessageLower;
        
        if (msgLower.includes('yesterday')) {
          startDate.setDate(today.getDate() - 1);
          endDate.setDate(today.getDate() - 1);
          dateLabel = 'yesterday';
        } else if (msgLower.includes('today')) {
          // today - keep default
          dateLabel = 'today';
        } else if (msgLower.includes('last week') || msgLower.includes('this week')) {
          startDate.setDate(today.getDate() - 7);
          dateLabel = 'this week';
        } else if (msgLower.includes('last month') || msgLower.includes('this month')) {
          startDate.setDate(today.getDate() - 30);
          dateLabel = 'this month';
        } else if (msgLower.includes('last 2 weeks') || msgLower.includes('2 weeks')) {
          startDate.setDate(today.getDate() - 14);
          dateLabel = 'last 2 weeks';
        } else if (msgLower.includes('last 3 days')) {
          startDate.setDate(today.getDate() - 3);
          dateLabel = 'last 3 days';
        } else if (msgLower.includes('last 7 days')) {
          startDate.setDate(today.getDate() - 7);
          dateLabel = 'last 7 days';
        } else {
          // Default: 90 days for comprehensive analysis
          startDate.setDate(today.getDate() - 90);
        }
        
        const activities = await getWeeklySummary(
          telegramId,
          startDate.toISOString().split('T')[0],
          endDate.toISOString().split('T')[0]
        );
        
        // Get active goals
        const goals = await getActiveGoals(telegramId);
        
        // Build user data context
        if (activities.length > 0 || goals.length > 0) {
          memoryContext += '\n\n--- USER DATABASE DATA ---\n';
          
          if (activities.length > 0) {
            memoryContext += `\nYour activities (${dateLabel}):\n`;
            activities.forEach(a => {
              memoryContext += `- ${a.category_name}: ${a.total_minutes} minutes (${a.entry_count} sessions)\n`;
            });
          }
          
          if (goals.length > 0) {
            memoryContext += '\nYour goals:\n';
            goals.forEach(g => {
              memoryContext += `- ${g.category_name}: ${g.target_value} ${g.period}\n`;
            });
          }
          
          memoryContext += '\n--- END DATABASE DATA ---\n\n';
        }
        
        // Get real-time GitHub data - detect date-specific queries
        const githubUsername = process.env.GITHUB_USERNAME;
        const githubToken = process.env.GITHUB_TOKEN;
        if (githubUsername) {
          // Parse date range from user message
          const today = new Date();
          let startDate = new Date(today);
          let endDate = new Date(today);
          let dateLabel = 'today';
          
          // Detect date-specific queries
          const msgLower = userMessageLower;
          
          if (msgLower.includes('yesterday')) {
            // Fetch 2 days to ensure we catch yesterday's commits (timezone flexibility)
            startDate.setDate(today.getDate() - 2);
            endDate.setDate(today.getDate() - 1);
            dateLabel = 'yesterday';
          } else if (msgLower.includes('last week') || msgLower.includes('this week')) {
            startDate.setDate(today.getDate() - 7);
            dateLabel = 'the last 7 days';
          } else if (msgLower.includes('last month') || msgLower.includes('this month')) {
            startDate.setDate(today.getDate() - 30);
            dateLabel = 'the last 30 days';
          } else if (msgLower.includes('last 2 weeks') || msgLower.includes('2 weeks')) {
            startDate.setDate(today.getDate() - 14);
            dateLabel = 'the last 14 days';
          } else if (msgLower.includes('last 3 days') || msgLower.includes('3 days')) {
            startDate.setDate(today.getDate() - 3);
            dateLabel = 'the last 3 days';
          }
          
          const startDateStr = startDate.toISOString().split('T')[0];
          const endDateStr = endDate.toISOString().split('T')[0];
          
          const githubActivity = await getGitHubActivity(githubUsername, startDateStr, endDateStr, githubToken);
          
          // Save fetched GitHub data to database for future use
          if (githubActivity.commits.length > 0 && isValidTelegramId) {
            void syncAllGitHubActivity(
              telegramId,
              githubActivity.commits,
              githubActivity.pullRequests
            ).catch((err) => console.error('⚠️ Failed to save GitHub data:', err));
          }
          
          if (githubActivity.commits.length > 0) {
            memoryContext += '\n--- REAL-TIME GITHUB DATA ---\n';
            githubActivity.commits.slice(0, 10).forEach((commit: any) => {
              memoryContext += `- ${commit.repo}: ${commit.message} (${commit.date})\n`;
            });
            memoryContext += `Total commits ${dateLabel}: ${githubActivity.commits.length}\n`;
            memoryContext += '\n--- END GITHUB DATA ---\n\n';
          } else {
            memoryContext += '\n--- REAL-TIME GITHUB DATA ---\n';
            memoryContext += `No commits found for ${dateLabel} (${startDateStr} to ${endDateStr})\n`;
            memoryContext += '\n--- END GITHUB DATA ---\n\n';
          }
        }
        
        // Get real-time Strava data
        const stravaToken = process.env.STRAVA_ACCESS_TOKEN;
        if (stravaToken) {
          const today = new Date();
          const pastDate = new Date();
          pastDate.setDate(today.getDate() - 180);
          const stravaActivities = await getAllStravaActivities(
            stravaToken,
            pastDate.toISOString().split('T')[0],
            today.toISOString().split('T')[0]
          );
          if (stravaActivities.length > 0) {
            memoryContext += '\n--- REAL-TIME STRAVA DATA ---\n';
            const recentActivities = stravaActivities.slice(0, 5);
            recentActivities.forEach((activity: any) => {
              const distanceKm = (activity.distance / 1000).toFixed(2);
              const durationMin = Math.round(activity.moving_time / 60);
              memoryContext += `- ${activity.start_date.split('T')[0]}: ${activity.name}, ${activity.type}, ${distanceKm}km, ${durationMin}min\n`;
            });
            memoryContext += `Total activities: ${stravaActivities.length} in last 180 days\n`;
            memoryContext += '\n--- END STRAVA DATA ---\n\n';
          }
        }
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

  // Get user's data from Supabase (activities, goals, conversation history)
  let userContext = '';
  let retrievedMessages = 0;
  let memoryMessages: Array<{ role: 'user' | 'assistant'; content: string }> = [];
  
  if (isValidTelegramId) {
    const userId = await getUserByTelegramId(telegramId);
    if (userId) {
      // Get conversation history
      memoryMessages = await getConversationHistory(userId, 30);
      retrievedMessages = memoryMessages.length;
      
      // Get activities from database - parse date from user message for targeted queries
      const today = new Date();
      let startDate = new Date(today);
      let endDate = new Date(today);
      let dateLabel = 'last 90 days';
      
      // Detect date-specific queries for activities
      if (userMessageLower.includes('yesterday')) {
        startDate.setDate(today.getDate() - 1);
        endDate.setDate(today.getDate() - 1);
        dateLabel = 'yesterday';
      } else if (userMessageLower.includes('today')) {
        // today - keep default
        dateLabel = 'today';
      } else if (userMessageLower.includes('last week') || userMessageLower.includes('this week')) {
        startDate.setDate(today.getDate() - 7);
        dateLabel = 'this week';
      } else if (userMessageLower.includes('last month') || userMessageLower.includes('this month')) {
        startDate.setDate(today.getDate() - 30);
        dateLabel = 'this month';
      } else if (userMessageLower.includes('last 2 weeks') || userMessageLower.includes('2 weeks')) {
        startDate.setDate(today.getDate() - 14);
        dateLabel = 'last 2 weeks';
      } else if (userMessageLower.includes('last 3 days')) {
        startDate.setDate(today.getDate() - 3);
        dateLabel = 'last 3 days';
      } else if (userMessageLower.includes('last 7 days')) {
        startDate.setDate(today.getDate() - 7);
        dateLabel = 'last 7 days';
      } else {
        // Default: 90 days for comprehensive context
        startDate.setDate(today.getDate() - 90);
      }
      
      const activities = await getWeeklySummary(
        telegramId,
        startDate.toISOString().split('T')[0],
        endDate.toISOString().split('T')[0]
      );
      
      // Get active goals
      const goals = await getActiveGoals(telegramId);
      
      // Build context string
      if (activities.length > 0 || goals.length > 0) {
        userContext = '\n\n--- USER DATA ---\n';
        
        if (activities.length > 0) {
          userContext += `\nYour activities (${dateLabel}):\n`;
          activities.forEach(a => {
            userContext += `- ${a.category_name}: ${a.total_minutes} minutes (${a.entry_count} sessions)\n`;
          });
        }
        
        if (goals.length > 0) {
          userContext += '\nYour goals:\n';
          goals.forEach(g => {
            userContext += `- ${g.category_name}: ${g.target_value} ${g.period}\n`;
          });
        }
        
        userContext += '\n--- END USER DATA ---\n\n';
      }
      
      // Check if user is asking about GitHub commits - fetch real-time data
      const isGitHubQuery = userMessageLower.includes('commit') || 
                           userMessageLower.includes('github') ||
                           userMessageLower.includes('push');
      
      if (isGitHubQuery) {
        const githubUsername = process.env.GITHUB_USERNAME;
        const githubToken = process.env.GITHUB_TOKEN;
        
        if (githubUsername) {
          // Parse date range from user message
          const today = new Date();
          let startDate = new Date(today);
          let endDate = new Date(today);
          let dateLabel = 'today';
          
          // Detect date-specific queries
          if (userMessageLower.includes('yesterday')) {
            // Fetch 2 days to ensure we catch yesterday's commits (timezone flexibility)
            startDate.setDate(today.getDate() - 2);
            endDate.setDate(today.getDate() - 1);
            dateLabel = 'yesterday';
          } else if (userMessageLower.includes('last week') || userMessageLower.includes('this week')) {
            startDate.setDate(today.getDate() - 7);
            dateLabel = 'the last 7 days';
          } else if (userMessageLower.includes('last month') || userMessageLower.includes('this month')) {
            startDate.setDate(today.getDate() - 30);
            dateLabel = 'the last 30 days';
          } else if (userMessageLower.includes('last 2 weeks') || userMessageLower.includes('2 weeks')) {
            startDate.setDate(today.getDate() - 14);
            dateLabel = 'the last 14 days';
          } else if (userMessageLower.includes('last 3 days') || userMessageLower.includes('3 days')) {
            startDate.setDate(today.getDate() - 3);
            dateLabel = 'the last 3 days';
          }
          
          const startDateStr = startDate.toISOString().split('T')[0];
          const endDateStr = endDate.toISOString().split('T')[0];
          
          const githubActivity = await getGitHubActivity(githubUsername, startDateStr, endDateStr, githubToken);
          
          // Save fetched GitHub data to database for future use
          if (githubActivity.commits.length > 0 && isValidTelegramId) {
            void syncAllGitHubActivity(
              telegramId,
              githubActivity.commits,
              githubActivity.pullRequests
            ).catch((err) => console.error('⚠️ Failed to save GitHub data:', err));
          }
          
          if (githubActivity.commits.length > 0) {
            userContext += `\n--- REAL-TIME GITHUB DATA (${dateLabel})---\n`;
            githubActivity.commits.slice(0, 10).forEach((commit: any) => {
              userContext += `- ${commit.repo}: ${commit.message} (${commit.date})\n`;
            });
            userContext += `Total commits ${dateLabel}: ${githubActivity.commits.length}\n`;
            userContext += `--- END GITHUB DATA ---\n`;
          } else {
            userContext += `\n--- REAL-TIME GITHUB DATA (${dateLabel})---\n`;
            userContext += `No commits found for ${dateLabel} (${startDateStr} to ${endDateStr})\n`;
            userContext += `--- END GITHUB DATA ---\n`;
          }
        }
      }
      
      // Check if user is asking about Strava/exercise - fetch real-time data
      const isStravaQuery = userMessageLower.includes('strava') || 
                           userMessageLower.includes('exercise') ||
                           userMessageLower.includes('workout') ||
                           userMessageLower.includes('run') ||
                           userMessageLower.includes('cycling') ||
                           userMessageLower.includes('activity');
      
      if (isStravaQuery) {
        const stravaToken = process.env.STRAVA_ACCESS_TOKEN;
        
        if (stravaToken) {
          // Get last 180 days for historical data ( Strava API limit)
          const today = new Date();
          const pastDate = new Date();
          pastDate.setDate(today.getDate() - 180);
          
          const todayStr = today.toISOString().split('T')[0];
          const pastStr = pastDate.toISOString().split('T')[0];
          
          const stravaActivities = await getAllStravaActivities(stravaToken, pastStr, todayStr);
          
          if (stravaActivities.length > 0) {
            const summary = summarizeStravaActivities(stravaActivities);
            userContext += `\n--- REAL-TIME STRAVA DATA (Last 180 days)---\n`;
            // Show most recent first
            const recentActivities = stravaActivities.slice(0, 5);
            recentActivities.forEach((activity: any) => {
              const distanceKm = (activity.distance / 1000).toFixed(2);
              const durationMin = Math.round(activity.moving_time / 60);
              userContext += `- ${activity.start_date.split('T')[0]}: ${activity.name}, ${activity.type}, ${distanceKm}km, ${durationMin}min\n`;
            });
            userContext += `Total activities: ${stravaActivities.length} in last 180 days\n`;
            userContext += `--- END STRAVA DATA ---\n`;
          } else {
            userContext += `\n--- REAL-TIME STRAVA DATA ---\n`;
            userContext += `No Strava activities found in last 180 days\n`;
            userContext += `--- END STRAVA DATA ---\n`;
          }
        } else {
          userContext += `\n--- REAL-TIME STRAVA DATA ---\n`;
          userContext += `Strava not connected. Add STRAVA_ACCESS_TOKEN to .env\n`;
          userContext += `--- END STRAVA DATA ---\n`;
        }
      }
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
    ...(userContext ? [{ role: 'system' as const, content: userContext }] : []),
    ...memoryMessages,
    { role: 'user' as const, content: user_message },
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
