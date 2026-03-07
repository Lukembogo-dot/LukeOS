import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Supabase client types
export interface UserProfile {
  id: string;
  created_at: string;
  updated_at: string;
  telegram_id: number;
  timezone: string;
}

export interface Conversation {
  id: string;
  created_at: string;
  user_id: string;
  role: 'user' | 'assistant';
  message_text: string;
  embedding?: number[] | null;
}

export interface SearchResult {
  id: string;
  message_text: string;
  similarity: number;
}

// Embedding dimension constants
const EXPECTED_EMBEDDING_DIMENSION = 1024; // Cohere v3.0 produces 1024-dim vectors

// Initialize Supabase client
let supabase: SupabaseClient | null = null;

export function initSupabase(): SupabaseClient | null {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.log('⚠️  Supabase not configured. Set SUPABASE_URL and SUPABASE_ANON_KEY in .env');
    return null;
  }

  if (!supabase) {
    supabase = createClient(supabaseUrl, supabaseKey);
    console.log('✅ Supabase client initialized');
  }

  return supabase;
}

/**
 * Validate embedding dimension matches expected size for database
 */
function isValidEmbedding(embedding?: number[]): boolean {
  if (!embedding || !Array.isArray(embedding)) {
    return false;
  }
  return embedding.length === EXPECTED_EMBEDDING_DIMENSION;
}

export function getSupabase(): SupabaseClient | null {
  return supabase;
}

// =====================================================
// USER PROFILE FUNCTIONS
// =====================================================

/**
 * Get or create user profile by telegram_id
 * Uses upsert to prevent race conditions under concurrent load
 */
export async function getOrCreateUser(telegramId: number, timezone: string = 'Africa/Nairobi'): Promise<string | null> {
  const client = getSupabase();
  if (!client) return null;

  // Use upsert to handle concurrent requests safely
  // The unique constraint on telegram_id ensures only one user is created
  const { data: user, error } = await client
    .from('user_profile')
    .upsert(
      { telegram_id: telegramId, timezone },
      { onConflict: 'telegram_id', ignoreDuplicates: true }
    )
    .select('id')
    .single();

  if (error) {
    // If upsert failed due to other reasons, try to fetch existing user
    const { data: existingUser } = await client
      .from('user_profile')
      .select('id')
      .eq('telegram_id', telegramId)
      .single();
    
    if (existingUser) {
      return existingUser.id;
    }
    
    console.error('❌ Error creating/fetching user:', error);
    return null;
  }

  return user?.id;
}

// =====================================================
// CONVERSATION FUNCTIONS
// =====================================================

/**
 * Save a conversation message with embedding
 */
export async function saveConversation(
  userId: string,
  role: 'user' | 'assistant',
  messageText: string,
  embedding?: number[]
): Promise<boolean> {
  const client = getSupabase();
  if (!client) return false;

  // Validate embedding dimension before storage
  const validatedEmbedding = isValidEmbedding(embedding) ? embedding : null;
  if (embedding && !validatedEmbedding) {
    console.warn(
      `⚠️ Embedding dimension mismatch: got ${embedding.length}, expected ${EXPECTED_EMBEDDING_DIMENSION}. Storing without vector.`
    );
  }

  const { error } = await client
    .from('conversations')
    .insert({
      user_id: userId,
      role,
      message_text: messageText,
      embedding: validatedEmbedding,
    });

  if (error) {
    console.error('❌ Error saving conversation:', error);
    return false;
  }

  return true;
}

/**
 * Get recent conversations for a user
 */
export async function getRecentConversations(
  userId: string,
  limit: number = 10
): Promise<Conversation[]> {
  const client = getSupabase();
  if (!client) return [];

  const { data, error } = await client
    .from('conversations')
    .select('id, created_at, user_id, role, message_text')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('❌ Error fetching conversations:', error);
    return [];
  }

  return (data || []).map(conv => ({
    id: conv.id,
    created_at: conv.created_at,
    user_id: conv.user_id,
    role: conv.role,
    message_text: conv.message_text,
  }));
}

/**
 * Get conversation history formatted for LLM
 */
export async function getConversationHistory(
  userId: string,
  limit: number = 10
): Promise<Array<{ role: 'user' | 'assistant'; content: string }>> {
  const conversations = await getRecentConversations(userId, limit);
  
  // Reverse to get chronological order
  return conversations.reverse().map((conv) => ({
    role: conv.role,
    content: conv.message_text,
  }));
}

// =====================================================
// EMBEDDING / RAG FUNCTIONS
// =====================================================

/**
 * Search for similar conversations using vector similarity
 * Note: Requires pgvector extension and matching vector dimensions
 */
export async function searchSimilarConversations(
  telegramId: number,
  queryEmbedding: number[],
  matchThreshold: number = 0.7,
  matchCount: number = 5
): Promise<SearchResult[]> {
  const client = getSupabase();
  if (!client) return [];

  // Use RPC call for vector similarity search
  // Note: This requires the search_similar_conversations function to be set up
  try {
    const { data, error } = await client.rpc('search_similar_conversations', {
      p_telegram_id: telegramId,
      p_query_embedding: queryEmbedding,
      p_match_threshold: matchThreshold,
      p_match_count: matchCount,
    });

    if (error) {
      // If RPC doesn't exist, fall back to basic retrieval
      console.warn('⚠️  Vector search not available, using basic retrieval');
      return [];
    }

    return data || [];
  } catch (err) {
    console.warn('⚠️  Vector search not available:', err);
    return [];
  }
}

/**
 * Store user message with embedding for RAG
 */
export async function storeUserMessage(
  telegramId: number,
  messageText: string,
  embedding?: number[],
  timezone: string = 'Africa/Nairobi'
): Promise<boolean> {
  const userId = await getOrCreateUser(telegramId, timezone);
  if (!userId) return false;

  return saveConversation(userId, 'user', messageText, embedding);
}

/**
 * Store assistant response with embedding for RAG
 */
export async function storeAssistantMessage(
  telegramId: number,
  messageText: string,
  embedding?: number[]
): Promise<boolean> {
  const client = getSupabase();
  if (!client) return false;

  // Find user by telegram_id
  const { data: user } = await client
    .from('user_profile')
    .select('id')
    .eq('telegram_id', telegramId)
    .single();

  if (!user) return false;

  return saveConversation(user.id, 'assistant', messageText, embedding);
}

/**
 * Get user ID by telegram_id
 */
export async function getUserByTelegramId(telegramId: number): Promise<string | null> {
  const client = getSupabase();
  if (!client) return null;

  const { data, error } = await client
    .from('user_profile')
    .select('id')
    .eq('telegram_id', telegramId)
    .single();

  if (error) return null;
  return data?.id;
}

// =====================================================
// ACTIVITY TRACKING TYPES
// =====================================================

export interface Activity {
  id: string;
  user_id: string;
  category_name: string;
  duration_minutes: number;
  notes?: string;
  activity_date: string;
  start_time?: string;
  end_time?: string;
  created_at: string;
}

export interface Goal {
  id: string;
  user_id: string;
  category_name: string;
  target_value: number;
  period: 'daily' | 'weekly' | 'monthly';
  start_date: string;
  end_date?: string;
  is_active: boolean;
  created_at: string;
}

export interface GoalProgress {
  goal_id: string;
  target_value: number;
  actual_value: number;
  percentage_achieved: number;
}

export interface WeeklySummary {
  category_name: string;
  total_minutes: number;
  entry_count: number;
}

export interface WeeklyReport {
  week_start: string;
  week_end: string;
  summaries: WeeklySummary[];
  goals_progress: GoalProgress[];
  overall_score?: number;
}

// =====================================================
// ACTIVITY TRACKING FUNCTIONS
// =====================================================

/**
 * Log a new activity (coding, exercise, screentime, etc.)
 */
export async function logActivity(
  telegramId: number,
  categoryName: string,
  durationMinutes: number,
  notes?: string,
  activityDate?: string,
  embedding?: number[]
): Promise<boolean> {
  const client = getSupabase();
  if (!client) return false;

  const userId = await getOrCreateUser(telegramId);
  if (!userId) return false;

  const date = activityDate || new Date().toISOString().split('T')[0];
  
  // Validate embedding dimension
  const validatedEmbedding = isValidEmbedding(embedding) ? embedding : null;

  const { error } = await client
    .from('activities')
    .insert({
      user_id: userId,
      category_name: categoryName,
      duration_minutes: durationMinutes,
      notes: notes || null,
      activity_date: date,
      embedding: validatedEmbedding,
    });

  if (error) {
    console.error('❌ Error logging activity:', error);
    return false;
  }

  return true;
}

/**
 * Get activities for a user within a date range
 */
export async function getActivities(
  telegramId: number,
  startDate: string,
  endDate: string,
  categoryName?: string
): Promise<Activity[]> {
  const client = getSupabase();
  if (!client) return [];

  const userId = await getUserByTelegramId(telegramId);
  if (!userId) return [];

  let query = client
    .from('activities')
    .select('*')
    .eq('user_id', userId)
    .gte('activity_date', startDate)
    .lte('activity_date', endDate)
    .order('activity_date', { ascending: false });

  if (categoryName) {
    query = query.eq('category_name', categoryName);
  }

  const { data, error } = await query;

  if (error) {
    console.error('❌ Error fetching activities:', error);
    return [];
  }

  return data || [];
}

/**
 * Get weekly summary of activities
 */
export async function getWeeklySummary(
  telegramId: number,
  weekStartDate: string,
  weekEndDate: string
): Promise<WeeklySummary[]> {
  const client = getSupabase();
  if (!client) return [];

  const userId = await getUserByTelegramId(telegramId);
  if (!userId) return [];

  const { data, error } = await client
    .from('activities')
    .select('category_name, duration_minutes')
    .eq('user_id', userId)
    .gte('activity_date', weekStartDate)
    .lte('activity_date', weekEndDate);

  if (error) {
    console.error('❌ Error fetching weekly summary:', error);
    return [];
  }

  // Aggregate by category
  const summaryMap = new Map<string, { total: number; count: number }>();
  for (const row of data || []) {
    const existing = summaryMap.get(row.category_name) || { total: 0, count: 0 };
    summaryMap.set(row.category_name, {
      total: existing.total + row.duration_minutes,
      count: existing.count + 1,
    });
  }

  return Array.from(summaryMap.entries())
    .map(([category_name, { total, count }]) => ({
      category_name,
      total_minutes: total,
      entry_count: count,
    }))
    .sort((a, b) => b.total_minutes - a.total_minutes);
}

// =====================================================
// GOALS FUNCTIONS
// =====================================================

/**
 * Create a new goal
 */
export async function createGoal(
  telegramId: number,
  categoryName: string,
  targetValue: number,
  period: 'daily' | 'weekly' | 'monthly',
  startDate?: string,
  endDate?: string
): Promise<string | null> {
  const client = getSupabase();
  if (!client) return null;

  const userId = await getOrCreateUser(telegramId);
  if (!userId) return null;

  const start = startDate || new Date().toISOString().split('T')[0];

  const { data, error } = await client
    .from('goals')
    .insert({
      user_id: userId,
      category_name: categoryName,
      target_value: targetValue,
      period,
      start_date: start,
      end_date: endDate || null,
      is_active: true,
    })
    .select('id')
    .single();

  if (error) {
    console.error('❌ Error creating goal:', error);
    return null;
  }

  return data?.id;
}

/**
 * Get user's active goals
 */
export async function getActiveGoals(telegramId: number): Promise<Goal[]> {
  const client = getSupabase();
  if (!client) return [];

  const userId = await getUserByTelegramId(telegramId);
  if (!userId) return [];

  const { data, error } = await client
    .from('goals')
    .select('*')
    .eq('user_id', userId)
    .eq('is_active', true)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('❌ Error fetching goals:', error);
    return [];
  }

  return data || [];
}

/**
 * Update goal status
 */
export async function updateGoal(
  goalId: string,
  updates: Partial<Pick<Goal, 'target_value' | 'is_active' | 'end_date'>>
): Promise<boolean> {
  const client = getSupabase();
  if (!client) return false;

  const { error } = await client
    .from('goals')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', goalId);

  if (error) {
    console.error('❌ Error updating goal:', error);
    return false;
  }

  return true;
}

/**
 * Get goal progress for a specific period
 */
export async function getGoalProgress(
  telegramId: number,
  categoryName: string,
  periodStart: string,
  periodEnd: string
): Promise<GoalProgress[]> {
  const client = getSupabase();
  if (!client) return [];

  const userId = await getUserByTelegramId(telegramId);
  if (!userId) return [];

  // Get goals for this category
  const { data: goals, error: goalsError } = await client
    .from('goals')
    .select('id, target_value')
    .eq('user_id', userId)
    .eq('category_name', categoryName)
    .eq('is_active', true)
    .lte('start_date', periodEnd)
    .or('end_date.is.null,end_date.gte.' + periodStart);

  if (goalsError || !goals?.length) return [];

  // Get activities for this category in period
  const { data: activities, error: activitiesError } = await client
    .from('activities')
    .select('duration_minutes')
    .eq('user_id', userId)
    .eq('category_name', categoryName)
    .gte('activity_date', periodStart)
    .lte('activity_date', periodEnd);

  if (activitiesError) {
    console.error('❌ Error fetching activities for progress:', activitiesError);
    return [];
  }

  const totalMinutes = (activities || []).reduce(
    (sum, a) => sum + a.duration_minutes,
    0
  );

  // Calculate progress for each goal
  return goals.map((goal) => ({
    goal_id: goal.id,
    target_value: goal.target_value,
    actual_value: totalMinutes,
    percentage_achieved:
      goal.target_value > 0
        ? Math.round((totalMinutes / goal.target_value) * 100 * 100) / 100
        : 0,
  }));
}

/**
 * Get all goals progress for a week
 */
export async function getAllGoalsProgress(
  telegramId: number,
  weekStart: string,
  weekEnd: string
): Promise<GoalProgress[]> {
  const goals = await getActiveGoals(telegramId);
  const allProgress: GoalProgress[] = [];

  for (const goal of goals) {
    const progress = await getGoalProgress(
      telegramId,
      goal.category_name,
      weekStart,
      weekEnd
    );
    allProgress.push(...progress);
  }

  return allProgress;
}

// =====================================================
// STRAVA SYNC FUNCTIONS
// =====================================================

/**
 * Sync Strava activity to productivity_events table
 */
export async function syncStravaActivity(
  telegramId: number,
  activityData: {
    strava_id: number;
    name: string;
    type: string;
    distance: number;
    moving_time: number;
    calories?: number;
    start_date: string;
  }
): Promise<boolean> {
  const client = getSupabase();
  if (!client) return false;

  const userId = await getUserByTelegramId(telegramId);
  if (!userId) return false;

  const { error } = await client
    .from('productivity_events')
    .insert({
      user_id: userId,
      timestamp: activityData.start_date,
      source: 'strava',
      event_type: 'workout',
      data: {
        strava_id: activityData.strava_id,
        name: activityData.name,
        type: activityData.type,
        distance_meters: activityData.distance,
        distance_km: (activityData.distance / 1000).toFixed(2),
        duration_seconds: activityData.moving_time,
        duration_minutes: Math.round(activityData.moving_time / 60),
        calories: activityData.calories || 0,
      },
      category: 'physical',
    });

  if (error) {
    console.error('❌ Error syncing Strava activity:', error);
    return false;
  }

  return true;
}

/**
 * Update daily_metrics with Strava workout data for a specific date
 */
export async function updateDailyMetricsWithStrava(
  telegramId: number,
  date: string,
  workoutData: {
    workout_done: boolean;
    workout_type?: string;
    workout_duration_minutes?: number;
    distance_km?: number;
    calories_burned?: number;
  }
): Promise<boolean> {
  const client = getSupabase();
  if (!client) return false;

  const userId = await getUserByTelegramId(telegramId);
  if (!userId) return false;

  const { error } = await client
    .from('daily_metrics')
    .upsert(
      {
        user_id: userId,
        date,
        workout_done: workoutData.workout_done,
        workout_type: workoutData.workout_type || null,
        workout_duration_minutes: workoutData.workout_duration_minutes || null,
        distance_km: workoutData.distance_km || null,
        calories_burned: workoutData.calories_burned || null,
      },
      { onConflict: 'user_id, date' }
    );

  if (error) {
    console.error('❌ Error updating daily metrics with Strava:', error);
    return false;
  }

  return true;
}

/**
 * Sync all Strava activities to database (for a given date range)
 */
export async function syncAllStravaActivities(
  telegramId: number,
  activities: Array<{
    id: number;
    name: string;
    type: string;
    distance: number;
    moving_time: number;
    calories?: number;
    start_date: string;
  }>
): Promise<{ synced: number; errors: number }> {
  let synced = 0;
  let errors = 0;

  // Group activities by date for daily_metrics
  const activitiesByDate = new Map<string, typeof activities>();

  for (const activity of activities) {
    const date = activity.start_date.split('T')[0];
    
    // Add to productivity_events
    const success = await syncStravaActivity(telegramId, {
      strava_id: activity.id,
      name: activity.name,
      type: activity.type,
      distance: activity.distance,
      moving_time: activity.moving_time,
      calories: activity.calories,
      start_date: activity.start_date,
    });

    if (success) {
      synced++;
    } else {
      errors++;
    }

    // Group by date for daily metrics
    if (!activitiesByDate.has(date)) {
      activitiesByDate.set(date, []);
    }
    activitiesByDate.get(date)!.push(activity);
  }

  // Update daily_metrics for each date
  for (const [date, dayActivities] of activitiesByDate) {
    const totalDuration = dayActivities.reduce((sum, a) => sum + a.moving_time, 0);
    const totalDistance = dayActivities.reduce((sum, a) => sum + a.distance, 0);
    const totalCalories = dayActivities.reduce((sum, a) => sum + (a.calories || 0), 0);
    
    // Get primary workout type
    const typeCounts = new Map<string, number>();
    for (const a of dayActivities) {
      typeCounts.set(a.type, (typeCounts.get(a.type) || 0) + 1);
    }
    const primaryType = [...typeCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];

    await updateDailyMetricsWithStrava(telegramId, date, {
      workout_done: true,
      workout_type: primaryType,
      workout_duration_minutes: Math.round(totalDuration / 60),
      distance_km: Math.round(totalDistance / 1000 * 100) / 100,
      calories_burned: Math.round(totalCalories),
    });
  }

  return { synced, errors };
}

// =====================================================
// GITHUB SYNC FUNCTIONS
// =====================================================

/**
 * Sync GitHub activity to productivity_events and github_activity tables
 * Prevents duplicates by checking if entry already exists
 */
export async function syncGitHubActivity(
  telegramId: number,
  commitData: {
    date: string;
    message: string;
    repo: string;
  }
): Promise<boolean> {
  const client = getSupabase();
  if (!client) return false;

  const userId = await getUserByTelegramId(telegramId);
  if (!userId) return false;

  // Check for duplicates - don't insert if this commit already exists
  const timestamp = commitData.date.split('T')[0];
  const { data: existing } = await client
    .from('github_activity')
    .select('id')
    .eq('user_id', userId)
    .eq('repo_name', commitData.repo)
    .gte('timestamp', `${timestamp}T00:00:00Z`)
    .lt('timestamp', `${timestamp}T23:59:59Z`)
    .limit(1);

  if (existing && existing.length > 0) {
    // Already synced this repo for this day, skip
    return true;
  }

  // Insert into productivity_events
  const { error: eventError } = await client
    .from('productivity_events')
    .insert({
      user_id: userId,
      timestamp: commitData.date,
      source: 'github',
      event_type: 'push',
      data: {
        message: commitData.message,
        repo: commitData.repo,
      },
      category: 'coding',
    });

  if (eventError) {
    console.error('❌ Error syncing GitHub event:', eventError);
  }

  // Insert into github_activity
  const { error: ghError } = await client
    .from('github_activity')
    .insert({
      user_id: userId,
      timestamp: commitData.date,
      repo_name: commitData.repo,
      commits_count: 1,
      commit_message: commitData.message,
      event_type: 'push',
      raw_data: { message: commitData.message },
    });

  if (ghError) {
    console.error('❌ Error syncing GitHub activity:', ghError);
    return false;
  }

  return true;
}

/**
 * Update daily_metrics with GitHub data for a specific date
 */
export async function updateDailyMetricsWithGitHub(
  telegramId: number,
  date: string,
  githubData: {
    commits_count: number;
    lines_added: number;
    lines_deleted: number;
  }
): Promise<boolean> {
  const client = getSupabase();
  if (!client) return false;

  const userId = await getUserByTelegramId(telegramId);
  if (!userId) return false;

  // Calculate coding hours (estimate 30 min per commit)
  const codingHours = githubData.commits_count * 0.5;

  const { error } = await client
    .from('daily_metrics')
    .upsert(
      {
        user_id: userId,
        date,
        commits_count: githubData.commits_count,
        lines_added: githubData.lines_added,
        lines_deleted: githubData.lines_deleted,
        coding_hours: codingHours,
      },
      { onConflict: 'user_id, date' }
    );

  if (error) {
    console.error('❌ Error updating daily metrics with GitHub:', error);
    return false;
  }

  return true;
}

/**
 * Sync all GitHub commits to database (for a given date range)
 */
export async function syncAllGitHubActivity(
  telegramId: number,
  commits: Array<{
    date: string;
    message: string;
    repo: string;
  }>,
  pullRequests: Array<{
    title: string;
    state: string;
    created_at: string;
    repo: string;
  }> = []
): Promise<{ synced: number; errors: number }> {
  let synced = 0;
  let errors = 0;

  // Group commits by date for daily_metrics
  const commitsByDate = new Map<string, typeof commits>();

  for (const commit of commits) {
    const success = await syncGitHubActivity(telegramId, commit);
    if (success) {
      synced++;
    } else {
      errors++;
    }

    // Group by date
    const date = commit.date.split('T')[0];
    if (!commitsByDate.has(date)) {
      commitsByDate.set(date, []);
    }
    commitsByDate.get(date)!.push(commit);
  }

  // Update daily_metrics for each date
  for (const [date, dayCommits] of commitsByDate) {
    await updateDailyMetricsWithGitHub(telegramId, date, {
      commits_count: dayCommits.length,
      lines_added: 0, // GitHub API doesn't give line stats from events
      lines_deleted: 0,
    });
  }

  return { synced, errors };
}
