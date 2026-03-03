import axios from 'axios';
import { getSupabase, getOrCreateUser, logActivity } from './supabase';
import { getGitHubActivity, summarizeGitHubActivity } from './github';
import { getAllStravaActivities, summarizeStravaActivities, getExerciseMinutes, getWorkoutStreak } from './strava';

// =====================================================
// CRON JOB SERVICE
// =====================================================
// Automatically collects data from external APIs on a schedule
// Currently runs weekly (can be triggered manually)

// Get date range for the past week
function getLastWeekDateRange(): { startDate: string; endDate: string } {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 7);
  
  return {
    startDate: startDate.toISOString().split('T')[0],
    endDate: endDate.toISOString().split('T')[0],
  };
}

/**
 * Collect GitHub activity for a user and store in Supabase
 */
export async function collectGitHubActivity(telegramId: number): Promise<{
  success: boolean;
  commits: number;
  codingMinutes: number;
  error?: string;
}> {
  const githubUsername = process.env.GITHUB_USERNAME;
  const githubToken = process.env.GITHUB_TOKEN;
  
  if (!githubUsername) {
    return { success: false, commits: 0, codingMinutes: 0, error: 'GitHub not configured' };
  }
  
  const { startDate, endDate } = getLastWeekDateRange();
  
  try {
    console.log(`📡 Fetching GitHub activity for ${githubUsername} (${startDate} to ${endDate})...`);
    
    const activity = await getGitHubActivity(githubUsername, startDate, endDate, githubToken);
    const summary = summarizeGitHubActivity(activity);
    
    console.log(`  Found ${activity.commits.length} commits, ${activity.pullRequests.length} PRs`);
    
    // Store coding activity in Supabase
    if (summary.codingMinutes > 0) {
      const logged = await logActivity(
        telegramId,
        'coding',
        summary.codingMinutes,
        `GitHub: ${activity.commits.length} commits, ${summary.prsOpened} PRs opened, ${summary.prsMerged} PRs merged`,
        endDate
      );
      
      if (logged) {
        console.log(`  ✅ Logged ${summary.codingMinutes} minutes of coding to Supabase`);
      }
    }
    
    return {
      success: true,
      commits: activity.commits.length,
      codingMinutes: summary.codingMinutes,
    };
  } catch (error: any) {
    console.error('❌ GitHub collection error:', error.message);
    return {
      success: false,
      commits: 0,
      codingMinutes: 0,
      error: error.message,
    };
  }
}

/**
 * Collect Strava activity for a user and store in Supabase
 */
export async function collectStravaActivity(telegramId: number): Promise<{
  success: boolean;
  activities: number;
  exerciseMinutes: number;
  workoutStreak: number;
  error?: string;
}> {
  const stravaAccessToken = process.env.STRAVA_ACCESS_TOKEN;
  const stravaClientId = process.env.STRAVA_CLIENT_ID;
  const stravaClientSecret = process.env.STRAVA_CLIENT_SECRET;
  const stravaRefreshToken = process.env.STRAVA_REFRESH_TOKEN;
  
  if (!stravaClientId || !stravaClientSecret || !stravaRefreshToken) {
    return { success: false, activities: 0, exerciseMinutes: 0, workoutStreak: 0, error: 'Strava not configured' };
  }
  
  const { startDate, endDate } = getLastWeekDateRange();
  
  try {
    console.log(`📡 Fetching Strava activities (${startDate} to ${endDate})...`);
    
    // Get access token (will refresh if needed)
    let accessToken: string | null = stravaAccessToken || null;
    
    // Try to refresh token if we have credentials
    if (stravaClientId && stravaClientSecret && stravaRefreshToken) {
      try {
        const refreshResponse = await axios.post('https://www.strava.com/oauth/token', {
          client_id: stravaClientId,
          client_secret: stravaClientSecret,
          refresh_token: stravaRefreshToken,
          grant_type: 'refresh_token',
        });
        accessToken = refreshResponse.data.access_token || null;
      } catch (refreshError: any) {
        console.warn('⚠️ Could not refresh Strava token, using cached token');
      }
    }
    
    if (!accessToken) {
      return { success: false, activities: 0, exerciseMinutes: 0, workoutStreak: 0, error: 'No Strava access token' };
    }
    
    const activities = await getAllStravaActivities(accessToken, startDate, endDate);
    const summary = summarizeStravaActivities(activities);
    const exerciseMinutes = getExerciseMinutes(activities);
    const workoutStreak = getWorkoutStreak(activities);
    
    console.log(`  Found ${activities.length} activities, ${exerciseMinutes} minutes of exercise`);
    
    // Store exercise activity in Supabase
    if (exerciseMinutes > 0) {
      const activityTypes = Object.entries(summary.activitiesByType)
        .map(([type, count]) => `${count} ${type}`)
        .join(', ');
      
      const logged = await logActivity(
        telegramId,
        'exercise',
        exerciseMinutes,
        `Strava: ${activities.length} activities (${activityTypes})`,
        endDate
      );
      
      if (logged) {
        console.log(`  ✅ Logged ${exerciseMinutes} minutes of exercise to Supabase`);
      }
    }
    
    return {
      success: true,
      activities: activities.length,
      exerciseMinutes,
      workoutStreak,
    };
  } catch (error: any) {
    console.error('❌ Strava collection error:', error.message);
    return {
      success: false,
      activities: 0,
      exerciseMinutes: 0,
      workoutStreak: 0,
      error: error.message,
    };
  }
}

/**
 * Run all cron collections (GitHub + Strava)
 */
export async function runWeeklyCollection(telegramId: number = 1): Promise<{
  github: { success: boolean; commits: number; codingMinutes: number; error?: string };
  strava: { success: boolean; activities: number; exerciseMinutes: number; workoutStreak: number; error?: string };
}> {
  console.log('\n🚀 Starting weekly data collection...\n');
  
  const [githubResult, stravaResult] = await Promise.all([
    collectGitHubActivity(telegramId),
    collectStravaActivity(telegramId),
  ]);
  
  console.log('\n📊 Weekly Collection Summary:');
  console.log(`  GitHub: ${githubResult.success ? '✅' : '❌'} ${githubResult.commits} commits, ${githubResult.codingMinutes} min`);
  if (githubResult.error) console.log(`    Error: ${githubResult.error}`);
  
  console.log(`  Strava: ${stravaResult.success ? '✅' : '❌'} ${stravaResult.activities} activities, ${stravaResult.exerciseMinutes} min`);
  if (stravaResult.error) console.log(`    Error: ${stravaResult.error}`);
  
  return { github: githubResult, strava: stravaResult };
}

/**
 * Schedule weekly cron jobs
 * Note: This requires the node-cron package
 */
export async function scheduleCronJobs(): Promise<void> {
  try {
    // Dynamic import to avoid issues if node-cron isn't installed
    const cronModule = await import('node-cron');
    const cron = cronModule.default;
      // Run every Sunday at midnight
      cron.schedule('0 0 * * 0', async () => {
        console.log('\n🕛 Weekly cron job triggered');
        await runWeeklyCollection();
      });
      
      console.log('✅ Cron jobs scheduled: weekly collection (Sunday midnight)');
    console.log('✅ Cron jobs scheduled: weekly collection (Sunday midnight)');
  } catch (error) {
    console.warn('⚠️ Could not schedule cron jobs:', error);
  }
}
