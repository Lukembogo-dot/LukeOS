import { Router, Request, Response } from 'express';
import { 
  logActivity, 
  getActivities, 
  getWeeklySummary,
  createGoal,
  getActiveGoals,
  updateGoal,
  getAllGoalsProgress 
} from '../services/supabase';
import { generateEmbedding } from '../services/embeddings';
import { analyzeWithGemini } from '../services/gemini';
import { chatWithGroq } from '../services/groq';
import { GroqMessage } from '../types';
import { calculateProductivityScore, detectPatterns, getScoreGrade, getScoreDescription, DailyMetrics } from '../services/scoring';
import { getGitHubActivity, summarizeGitHubActivity } from '../services/github';
import { getAllStravaActivities, summarizeStravaActivities, getExerciseMinutes, hasExercisedToday, getWorkoutStreak } from '../services/strava';
import { getCalendarEvents, summarizeCalendarEvents, hadDeepWorkSession } from '../services/calendar';
import { getSupabase } from '../services/supabase';

const router = Router();

// =====================================================
// ACTIVITY ROUTES
// =====================================================

/**
 * POST /api/activity
 * Log a new activity
 * Body: { user_id, category_name, duration_minutes, notes?, date? }
 */
router.post('/activity', async (req: Request, res: Response) => {
  try {
    const { user_id, category_name, duration_minutes, notes, date } = req.body;
    
    if (!user_id || !category_name || !duration_minutes) {
      return res.status(400).json({ 
        error: 'Missing required fields: user_id, category_name, duration_minutes' 
      });
    }

    const telegramId = typeof user_id === 'string' ? parseInt(user_id, 10) : user_id;
    if (!Number.isInteger(telegramId)) {
      return res.status(400).json({ error: 'Invalid user_id' });
    }

    // Generate embedding for notes if provided (for semantic search)
    let embedding;
    if (notes) {
      const cohereApiKey = process.env.COHERE_API_KEY;
      const embedResult = await generateEmbedding(notes, cohereApiKey, 'search_document');
      embedding = embedResult.embedding;
    }

    const success = await logActivity(telegramId, category_name, duration_minutes, notes, date, embedding);
    
    if (success) {
      res.json({ success: true, message: 'Activity logged successfully' });
    } else {
      res.status(500).json({ error: 'Failed to log activity' });
    }
  } catch (error) {
    console.error('Error logging activity:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/activities
 * Get activities for a date range
 * Query: ?user_id=123&start_date=2026-01-01&end_date=2026-01-31&category=coding
 */
router.get('/activities', async (req: Request, res: Response) => {
  try {
    const { user_id, start_date, end_date, category } = req.query;
    
    if (!user_id || !start_date || !end_date) {
      return res.status(400).json({ 
        error: 'Missing required query params: user_id, start_date, end_date' 
      });
    }

    const telegramId = typeof user_id === 'string' ? parseInt(user_id, 10) : Number(user_id);
    
    const activities = await getActivities(
      telegramId, 
      start_date as string, 
      end_date as string,
      category as string | undefined
    );
    
    res.json({ activities });
  } catch (error) {
    console.error('Error fetching activities:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/activities/summary
 * Get weekly summary
 * Query: ?user_id=123&week_start=2026-02-20&week_end=2026-02-26
 */
router.get('/activities/summary', async (req: Request, res: Response) => {
  try {
    const { user_id, week_start, week_end } = req.query;
    
    if (!user_id || !week_start || !week_end) {
      return res.status(400).json({ 
        error: 'Missing required query params: user_id, week_start, week_end' 
      });
    }

    const telegramId = typeof user_id === 'string' ? parseInt(user_id, 10) : Number(user_id);
    
    const summary = await getWeeklySummary(telegramId, week_start as string, week_end as string);
    
    res.json({ summary });
  } catch (error) {
    console.error('Error fetching summary:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// =====================================================
// GOALS ROUTES
// =====================================================

/**
 * POST /api/goals
 * Create a new goal
 * Body: { user_id, category_name, target_value, period, start_date?, end_date? }
 * 
 * Examples:
 * - Weekly coding goal: { category_name: 'coding', target_value: 600, period: 'weekly' }
 * - Daily exercise: { category_name: 'exercise', target_value: 30, period: 'daily' }
 */
router.post('/goals', async (req: Request, res: Response) => {
  try {
    const { user_id, category_name, target_value, period, start_date, end_date } = req.body;
    
    if (!user_id || !category_name || !target_value || !period) {
      return res.status(400).json({ 
        error: 'Missing required fields: user_id, category_name, target_value, period' 
      });
    }

    if (!['daily', 'weekly', 'monthly'].includes(period)) {
      return res.status(400).json({ error: 'Period must be daily, weekly, or monthly' });
    }

    const telegramId = typeof user_id === 'string' ? parseInt(user_id, 10) : user_id;
    
    const goalId = await createGoal(
      telegramId, 
      category_name, 
      target_value, 
      period,
      start_date,
      end_date
    );
    
    if (goalId) {
      res.json({ success: true, goal_id: goalId });
    } else {
      res.status(500).json({ error: 'Failed to create goal' });
    }
  } catch (error) {
    console.error('Error creating goal:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/goals
 * Get user's active goals
 * Query: ?user_id=123
 */
router.get('/goals', async (req: Request, res: Response) => {
  try {
    const { user_id } = req.query;
    
    if (!user_id) {
      return res.status(400).json({ error: 'Missing required query param: user_id' });
    }

    const telegramId = typeof user_id === 'string' ? parseInt(user_id, 10) : Number(user_id);
    
    const goals = await getActiveGoals(telegramId);
    
    res.json({ goals });
  } catch (error) {
    console.error('Error fetching goals:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * PUT /api/goals/:goalId
 * Update a goal
 * Body: { target_value?, is_active?, end_date? }
 */
router.put('/goals/:goalId', async (req: Request, res: Response) => {
  try {
    const { goalId } = req.params;
    const { target_value, is_active, end_date } = req.body;
    
    // Ensure goalId is a string (not an array from query params)
    const goalIdStr = Array.isArray(goalId) ? goalId[0] : goalId;
    
    const updates: any = {};
    if (target_value !== undefined) updates.target_value = target_value;
    if (is_active !== undefined) updates.is_active = is_active;
    if (end_date !== undefined) updates.end_date = end_date;
    
    const success = await updateGoal(goalIdStr, updates);
    
    if (success) {
      res.json({ success: true });
    } else {
      res.status(500).json({ error: 'Failed to update goal' });
    }
  } catch (error) {
    console.error('Error updating goal:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/goals/progress
 * Get goal progress for a period
 * Query: ?user_id=123&week_start=2026-02-20&week_end=2026-02-26
 */
router.get('/goals/progress', async (req: Request, res: Response) => {
  try {
    const { user_id, week_start, week_end } = req.query;
    
    if (!user_id || !week_start || !week_end) {
      return res.status(400).json({ 
        error: 'Missing required query params: user_id, week_start, week_end' 
      });
    }

    const telegramId = typeof user_id === 'string' ? parseInt(user_id, 10) : Number(user_id);
    
    const progress = await getAllGoalsProgress(telegramId, week_start as string, week_end as string);
    
    res.json({ progress });
  } catch (error) {
    console.error('Error fetching progress:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// =====================================================
// WEEKLY ANALYSIS ENDPOINT
// =====================================================

/**
 * GET /api/analysis/weekly
 * Generate weekly productivity analysis using AI
 * Query: ?user_id=123&week_start=2026-02-20&week_end=2026-02-26
 */
router.get('/analysis/weekly', async (req: Request, res: Response) => {
  try {
    const { user_id, week_start, week_end } = req.query;
    
    if (!user_id || !week_start || !week_end) {
      return res.status(400).json({ 
        error: 'Missing required query params: user_id, week_start, week_end' 
      });
    }

    const telegramId = typeof user_id === 'string' ? parseInt(user_id, 10) : Number(user_id);
    const geminiApiKey = process.env.GEMINI_API_KEY;
    const groqApiKey = process.env.GROQ_API_KEY;
    
    // Get data for analysis
    const [summary, goals, activities] = await Promise.all([
      getWeeklySummary(telegramId, week_start as string, week_end as string),
      getAllGoalsProgress(telegramId, week_start as string, week_end as string),
      getActivities(telegramId, week_start as string, week_end as string)
    ]);
    
    if (!summary.length && !goals.length) {
      return res.json({ 
        analysis: 'No activity data found for this period. Start logging your activities to get productivity insights!',
        summary: [],
        goals_progress: []
      });
    }

    // Build analysis prompt
    const summaryText = summary.map(s => 
      `- ${s.category_name}: ${Math.round(s.total_minutes / 60 * 10) / 10} hours (${s.entry_count} sessions)`
    ).join('\n');

    const goalsText = goals.map(g => {
      const status = g.percentage_achieved >= 100 ? '✅ Achieved' : 
                     g.percentage_achieved >= 75 ? '⚠️ Close' : '❌ Below target';
      return `- ${g.goal_id}: ${g.percentage_achieved}% (${Math.round(g.actual_value/60*10)/10}/${Math.round(g.target_value/60*10)/10} hours) ${status}`;
    }).join('\n');

    const analysisPrompt = `You are a productivity coach. Analyze this week's activities and generate a concise weekly productivity report.

## Weekly Activity Summary:
${summaryText || 'No activities logged'}

## Goals Progress:
${goalsText || 'No goals set'}

## Instructions:
1. Provide an overall productivity score (0-100)
2. Identify top achievements and areas for improvement
3. Give specific actionable recommendations for next week
4. Keep the response concise but insightful
5. Format with clear sections: Score, Highlights, Improvements, Next Week Goals

Respond in a structured format:`;

    let analysis: string;
    
    // Try Gemini first, fallback to Groq
    if (geminiApiKey) {
      analysis = await analyzeWithGemini(analysisPrompt, geminiApiKey);
    } else if (groqApiKey) {
      const messages = [
        { role: 'system' as const, content: 'You are a productivity coach. Provide concise, actionable insights.' },
        { role: 'user' as const, content: analysisPrompt }
      ];
      analysis = await chatWithGroq(messages, groqApiKey);
    } else {
      // Fallback to basic analysis without AI
      const totalHours = summary.reduce((sum, s) => sum + s.total_minutes, 0) / 60;
      const avgGoalsAchieved = goals.length ? 
        goals.reduce((sum, g) => sum + g.percentage_achieved, 0) / goals.length : 0;
      
      analysis = `## Weekly Summary\n\n**Total Activity:** ${Math.round(totalHours * 10) / 10} hours\n` +
        `**Goals Achievement:** ${Math.round(avgGoalsAchieved)}%\n\n` +
        `Activities:\n${summaryText}\n\n` +
        `Goal Progress:\n${goalsText || 'No goals set'}\n\n` +
        `💡 Tip: Configure GEMINI_API_KEY or GROQ_API_KEY for AI-powered detailed analysis.`;
    }
    
    res.json({ 
      analysis,
      week_start: week_start,
      week_end: week_end,
      summary,
      goals_progress: goals,
      activity_count: activities.length
    });
  } catch (error) {
    console.error('Error generating weekly analysis:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// =====================================================
// DAILY METRICS ENDPOINT
// =====================================================

/**
 * GET /api/metrics/daily/:date
 * Get daily metrics with productivity score
 */
router.get('/metrics/daily/:date', async (req: Request, res: Response) => {
  try {
    const { date } = req.params;
    const userId = req.query.user_id as string;
    
    if (!userId) {
      return res.status(400).json({ error: 'Missing user_id query param' });
    }

    const telegramId = parseInt(userId, 10);
    const startDate = String(date);
    const endDate = String(date);

    // Gather metrics from all sources
    const [activities, goals, githubData, stravaData, calendarData] = await Promise.all([
      getActivities(telegramId, startDate, endDate),
      getAllGoalsProgress(telegramId, startDate, endDate),
      // GitHub (if configured)
      process.env.GITHUB_USERNAME ? 
        getGitHubActivity(process.env.GITHUB_USERNAME, startDate, endDate, process.env.GITHUB_TOKEN)
        : Promise.resolve({ commits: [], pullRequests: [], totalContributions: 0 }),
      // Strava (if configured)
      process.env.STRAVA_ACCESS_TOKEN ?
        getAllStravaActivities(process.env.STRAVA_ACCESS_TOKEN, startDate, endDate)
        : Promise.resolve([]),
      // Calendar (if configured)
      process.env.GOOGLE_CALENDAR_TOKEN ?
        getCalendarEvents(process.env.GOOGLE_CALENDAR_TOKEN, startDate, endDate)
        : Promise.resolve([]),
    ]);

    // Aggregate metrics
    const githubSummary = summarizeGitHubActivity(githubData);
    const stravaSummary = summarizeStravaActivities(stravaData);
    const calendarSummary = summarizeCalendarEvents(calendarData);

    // Build daily metrics object
    const metrics = {
      date: String(date),
      github_commits: githubData.commits.length,
      github_prs: githubData.pullRequests.length,
      github_coding_minutes: githubSummary.codingMinutes,
      exercise_minutes: getExerciseMinutes(stravaData),
      workout_streak: getWorkoutStreak(stravaData),
      exercised_today: hasExercisedToday(stravaData),
      screen_time_minutes: activities.filter(a => a.category_name === 'screentime')
        .reduce((sum, a) => sum + a.duration_minutes, 0),
      productive_app_minutes: activities.filter(a => a.category_name === 'coding')
        .reduce((sum, a) => sum + a.duration_minutes, 0),
      meetings_minutes: calendarSummary.totalMeetingMinutes,
      focus_time_minutes: calendarSummary.totalFocusMinutes,
      deep_work_session: hadDeepWorkSession(calendarData),
    };

    // Calculate score
    const score = calculateProductivityScore(metrics);

    res.json({
      date,
      metrics,
      score,
      grade: getScoreGrade(score),
      description: getScoreDescription(score),
      sources: {
        github: githubData.totalContributions > 0,
        strava: stravaData.length > 0,
        calendar: calendarData.length > 0,
        local: activities.length > 0,
      },
    });
  } catch (error) {
    console.error('Error calculating daily metrics:', error);
    res.status(500).json({ error: 'Failed to calculate metrics' });
  }
});

/**
 * GET /api/metrics/weekly
 * Get weekly metrics with pattern analysis
 */
router.get('/metrics/weekly', async (req: Request, res: Response) => {
  try {
    const userId = req.query.user_id as string;
    const { start_date, end_date } = req.query;
    
    if (!userId) {
      return res.status(400).json({ error: 'Missing user_id query param' });
    }

    const telegramId = parseInt(userId, 10);
    
    // Calculate date range
    const today = new Date();
    const weekStart = start_date as string || 
      new Date(today.setDate(today.getDate() - 7)).toISOString().split('T')[0];
    const weekEnd = end_date as string || new Date().toISOString().split('T')[0];

    // Get daily metrics for each day
    const weekMetrics = [];
    const currentDate = new Date(weekStart);
    const endDateObj = new Date(weekEnd);

    while (currentDate <= endDateObj) {
      const dateStr = currentDate.toISOString().split('T')[0];
      
      // Fetch data for each day
      const [activities, githubData, stravaData, calendarData] = await Promise.all([
        getActivities(telegramId, dateStr, dateStr),
        process.env.GITHUB_USERNAME ? 
          getGitHubActivity(process.env.GITHUB_USERNAME, dateStr, dateStr, process.env.GITHUB_TOKEN)
          : Promise.resolve({ commits: [], pullRequests: [], totalContributions: 0 }),
        process.env.STRAVA_ACCESS_TOKEN ?
          getAllStravaActivities(process.env.STRAVA_ACCESS_TOKEN, dateStr, dateStr)
          : Promise.resolve([]),
        process.env.GOOGLE_CALENDAR_TOKEN ?
          getCalendarEvents(process.env.GOOGLE_CALENDAR_TOKEN, dateStr, dateStr)
          : Promise.resolve([]),
      ]);

      const githubSummary = summarizeGitHubActivity(githubData);
      const stravaSummary = summarizeStravaActivities(stravaData);
      const calendarSummary = summarizeCalendarEvents(calendarData);

      const dayMetrics: DailyMetrics = {
        date: dateStr,
        github_commits: githubData.commits.length,
        github_prs: githubData.pullRequests.length,
        github_coding_minutes: githubSummary.codingMinutes,
        exercise_minutes: getExerciseMinutes(stravaData),
        workout_streak: getWorkoutStreak(stravaData),
        exercised_today: hasExercisedToday(stravaData),
        screen_time_minutes: activities.filter(a => a.category_name === 'screentime')
          .reduce((sum, a) => sum + a.duration_minutes, 0),
        meetings_minutes: calendarSummary.totalMeetingMinutes,
        focus_time_minutes: calendarSummary.totalFocusMinutes,
        deep_work_session: hadDeepWorkSession(calendarData),
        productivity_score: calculateProductivityScore({
          date: dateStr,
          github_commits: githubData.commits.length,
          github_prs: githubData.pullRequests.length,
          github_coding_minutes: githubSummary.codingMinutes,
          exercise_minutes: getExerciseMinutes(stravaData),
          workout_streak: getWorkoutStreak(stravaData),
          exercised_today: hasExercisedToday(stravaData),
          screen_time_minutes: activities.filter(a => a.category_name === 'screentime')
            .reduce((sum, a) => sum + a.duration_minutes, 0),
          meetings_minutes: calendarSummary.totalMeetingMinutes,
          focus_time_minutes: calendarSummary.totalFocusMinutes,
          deep_work_session: hadDeepWorkSession(calendarData),
        }),
      };

      weekMetrics.push(dayMetrics);

      currentDate.setDate(currentDate.getDate() + 1);
    }

    // Detect patterns
    const patterns = detectPatterns(weekMetrics);

    res.json({
      week_start: weekStart,
      week_end: weekEnd,
      weekMetrics,
      patterns,
      summary: {
        avgScore: patterns.avgDailyScore,
        consistency: patterns.consistency,
        workoutImpact: patterns.workoutCorrelation,
      },
    });
  } catch (error) {
    console.error('Error calculating weekly metrics:', error);
    res.status(500).json({ error: 'Failed to calculate weekly metrics' });
  }
});

export default router;
