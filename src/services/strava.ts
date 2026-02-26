import axios from 'axios';

// =====================================================
// STRAVA API SERVICE
// =====================================================
// Fetches exercise/activity data from Strava

interface StravaActivity {
  id: number;
  name: string;
  type: string; // Run, Ride, Swim, Workout, etc.
  distance: number; // meters
  moving_time: number; // seconds
  elapsed_time: number; // seconds
  total_elevation_gain: number; // meters
  start_date: string;
  calories?: number;
  average_heartrate?: number;
  max_heartrate?: number;
  start_latlng?: [number, number];
  end_latlng?: [number, number];
}

interface StravaSummary {
  totalActivities: number;
  totalDistance: number; // meters
  totalDuration: number; // seconds
  totalElevation: number; // meters
  totalCalories: number;
  activitiesByType: Record<string, number>;
}

/**
 * Exchange Strava authorization code for access token
 */
export async function exchangeStravaToken(
  clientId: string,
  clientSecret: string,
  code: string
): Promise<{ access_token: string; athlete: any } | null> {
  try {
    const response = await axios.post('https://www.strava.com/oauth/token', {
      client_id: clientId,
      client_secret: clientSecret,
      code,
      grant_type: 'authorization_code',
    });

    return {
      access_token: response.data.access_token,
      athlete: response.data.athlete,
    };
  } catch (error: any) {
    console.error('Strava token exchange error:', error.response?.data || error.message);
    return null;
  }
}

/**
 * Get athlete's activities for a date range
 */
export async function getStravaActivities(
  accessToken: string,
  startDate: string,
  endDate: string,
  page: number = 1,
  perPage: number = 30
): Promise<StravaActivity[]> {
  try {
    const before = new Date(endDate).getTime() / 1000;
    const after = new Date(startDate).getTime() / 1000;

    const response = await axios.get('https://www.strava.com/api/v3/athlete/activities', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
      params: {
        before,
        after,
        page,
        per_page: perPage,
      },
    });

    return response.data || [];
  } catch (error: any) {
    console.error('Strava activities error:', error.response?.data || error.message);
    return [];
  }
}

/**
 * Get activities for a date range (handles pagination)
 */
export async function getAllStravaActivities(
  accessToken: string,
  startDate: string,
  endDate: string
): Promise<StravaActivity[]> {
  const allActivities: StravaActivity[] = [];
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    const activities = await getStravaActivities(accessToken, startDate, endDate, page);
    allActivities.push(...activities);
    
    if (activities.length < 30) {
      hasMore = false;
    } else {
      page++;
    }
    
    // Safety limit
    if (page > 10) break;
  }

  return allActivities;
}

/**
 * Summarize Strava activities
 */
export function summarizeStravaActivities(activities: StravaActivity[]): StravaSummary {
  const summary: StravaSummary = {
    totalActivities: activities.length,
    totalDistance: 0,
    totalDuration: 0,
    totalElevation: 0,
    totalCalories: 0,
    activitiesByType: {},
  };

  for (const activity of activities) {
    summary.totalDistance += activity.distance || 0;
    summary.totalDuration += activity.moving_time || 0;
    summary.totalElevation += activity.total_elevation_gain || 0;
    summary.totalCalories += activity.calories || 0;
    
    const type = activity.type || 'Other';
    summary.activitiesByType[type] = (summary.activitiesByType[type] || 0) + 1;
  }

  return summary;
}

/**
 * Convert Strava data to exercise minutes
 */
export function getExerciseMinutes(activities: StravaActivity[]): number {
  // Convert seconds to minutes
  return Math.round(
    activities.reduce((sum, a) => sum + (a.moving_time || 0), 0) / 60
  );
}

/**
 * Check if user exercised today
 */
export function hasExercisedToday(activities: StravaActivity[]): boolean {
  const today = new Date().toISOString().split('T')[0];
  return activities.some(a => a.start_date.startsWith(today));
}

/**
 * Get workout streak (consecutive days with exercise)
 */
export function getWorkoutStreak(activities: StravaActivity[]): number {
  if (!activities.length) return 0;

  // Get unique dates
  const dates = new Set(
    activities.map(a => a.start_date.split('T')[0])
  );
  
  const sortedDates = Array.from(dates).sort().reverse();
  
  let streak = 0;
  const today = new Date();
  
  for (let i = 0; i < sortedDates.length; i++) {
    const expectedDate = new Date(today);
    expectedDate.setDate(expectedDate.getDate() - i);
    const expectedStr = expectedDate.toISOString().split('T')[0];
    
    if (dates.has(expectedStr)) {
      streak++;
    } else {
      break;
    }
  }
  
  return streak;
}
