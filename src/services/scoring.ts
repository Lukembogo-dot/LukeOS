// =====================================================
// PRODUCTIVITY SCORING SERVICE
// =====================================================
// Algorithm for calculating productivity scores and detecting patterns

// =====================================================
// TYPES
// =====================================================

export interface DailyMetrics {
  date: string;
  // GitHub metrics
  github_commits?: number;
  github_prs?: number;
  github_coding_minutes?: number;
  
  // Exercise metrics
  exercise_minutes?: number;
  workout_streak?: number;
  exercised_today?: boolean;
  
  // Screen time
  screen_time_minutes?: number;
  productive_app_minutes?: number;
  
  // Calendar
  meetings_minutes?: number;
  focus_time_minutes?: number;
  deep_work_session?: boolean;
  
  // Sleep (from MacroDroid)
  sleep_hours?: number;
  steps?: number;
  
  // Calculated
  productivity_score?: number;
}

export interface WeeklyMetrics extends DailyMetrics {
  dayOfWeek: string;
}

export interface PatternAnalysis {
  avgDailyScore: number;
  consistency: number; // 0-100
  workoutCorrelation: number; // -1 to 1
  bestDay: string;
  worstDay: string;
  trend: 'improving' | 'declining' | 'stable';
  insights: string[];
  recommendations: string[];
}

// =====================================================
// WEIGHTS (Customizable)
// =====================================================

const WEIGHTS = {
  // Coding (30% of score)
  commits: 10,
  prs: 10,
  codingMinutes: 10,
  
  // Exercise (25% of score)
  exerciseMinutes: 15,
  workoutStreak: 5,
  exercisedToday: 5,
  
  //Today: 5 Focus & Meetings (25% of score)
  focusTime: 15,
  deepWorkSession: 5,
  meetingsMinutes: 5,
  
  // Health (10% of score)
  sleepHours: 5,
  steps: 5,
  
  // Screen time penalty
  excessiveScreenTime: -10,
};

// =====================================================
// SCORE CALCULATION
// =====================================================

/**
 * Calculate productivity score for a single day (0-100)
 */
export function calculateProductivityScore(metrics: DailyMetrics): number {
  let score = 0;
  
  // === CODING (max 30 points) ===
  
  // Commits: 1 point each, max 10
  const commitScore = Math.min(metrics.github_commits || 0, 10) * 1;
  score += commitScore;
  
  // PRs: 2 points each, max 10
  const prScore = Math.min(metrics.github_prs || 0, 5) * 2;
  score += prScore;
  
  // Coding time: 1 point per 30 mins, max 10
  const codingScore = Math.min((metrics.github_coding_minutes || 0) / 30, 10);
  score += Math.round(codingScore);
  
  // === EXERCISE (max 25 points) ===
  
  // Exercise: 1 point per 15 mins, max 15
  const exerciseScore = Math.min((metrics.exercise_minutes || 0) / 15, 15);
  score += Math.round(exerciseScore);
  
  // Workout streak: 1 point per day of streak, max 5
  const streakScore = Math.min(metrics.workout_streak || 0, 5);
  score += streakScore;
  
  // Exercised today bonus
  if (metrics.exercised_today) {
    score += 5;
  }
  
  // === FOCUS & MEETINGS (max 25 points) ===
  
  // Focus time: 1 point per 20 mins, max 15
  const focusScore = Math.min((metrics.focus_time_minutes || 0) / 20, 15);
  score += Math.round(focusScore);
  
  // Deep work session bonus (>2 hours)
  if (metrics.deep_work_session) {
    score += 5;
  }
  
  // Meetings: less is better (too many meetings = less productivity)
  const meetingsPenalty = Math.max(0, ((metrics.meetings_minutes || 0) - 120) / 60) * 2;
  score -= Math.round(meetingsPenalty);
  
  // === HEALTH (max 10 points) ===
  
  // Sleep: optimal is 7-8 hours
  const sleep = metrics.sleep_hours || 0;
  if (sleep >= 7 && sleep <= 8) {
    score += 5;
  } else if (sleep >= 6 && sleep <= 9) {
    score += 3;
  } else if (sleep > 0) {
    score += 1;
  }
  
  // Steps: 1 point per 2000 steps, max 5
  const stepsScore = Math.min((metrics.steps || 0) / 2000, 5);
  score += Math.round(stepsScore);
  
  // === PENALTIES ===
  
  // Excessive screen time penalty (>6 hours)
  if ((metrics.screen_time_minutes || 0) > 360) {
    score += WEIGHTS.excessiveScreenTime;
  }
  
  // Ensure score is between 0 and 100
  return Math.max(0, Math.min(100, score));
}

/**
 * Get score grade (A-F)
 */
export function getScoreGrade(score: number): string {
  if (score >= 90) return 'A+';
  if (score >= 80) return 'A';
  if (score >= 70) return 'B';
  if (score >= 60) return 'C';
  if (score >= 50) return 'D';
  return 'F';
}

/**
 * Get score description
 */
export function getScoreDescription(score: number): string {
  if (score >= 90) return 'Exceptional productivity! 🌟';
  if (score >= 80) return 'Great day! Keep it up! 💪';
  if (score >= 70) return 'Good progress 👍';
  if (score >= 60) return 'Decent day, room for improvement 📈';
  if (score >= 50) return 'Below average, consider adjustments ⚠️';
  return 'Low productivity, analyze and adjust 🔴';
}

// =====================================================
// PATTERN DETECTION
// =====================================================

/**
 * Detect patterns in weekly metrics
 */
export function detectPatterns(weeklyMetrics: DailyMetrics[]): PatternAnalysis {
  if (!weeklyMetrics.length) {
    return {
      avgDailyScore: 0,
      consistency: 0,
      workoutCorrelation: 0,
      bestDay: 'N/A',
      worstDay: 'N/A',
      trend: 'stable',
      insights: [],
      recommendations: [],
    };
  }

  // Calculate scores for each day
  const dailyScores = weeklyMetrics.map(m => ({
    date: m.date,
    score: calculateProductivityScore(m),
    exercised: m.exercised_today || false,
    exerciseMinutes: m.exercise_minutes || 0,
  }));

  // Average score
  const avgDailyScore = dailyScores.reduce((sum, d) => sum + d.score, 0) / dailyScores.length;

  // Consistency (standard deviation inverted)
  const variance = dailyScores.reduce((sum, d) => 
    sum + Math.pow(d.score - avgDailyScore, 2), 0) / dailyScores.length;
  const stdDev = Math.sqrt(variance);
  const consistency = Math.max(0, 100 - stdDev * 2);

  // Workout correlation
  const exercisedDays = dailyScores.filter(d => d.exercised);
  const nonExercisedDays = dailyScores.filter(d => !d.exercised);
  
  let workoutCorrelation = 0;
  if (exercisedDays.length > 0 && nonExercisedDays.length > 0) {
    const avgExercised = exercisedDays.reduce((s, d) => s + d.score, 0) / exercisedDays.length;
    const avgNonExercised = nonExercisedDays.reduce((s, d) => s + d.score, 0) / nonExercisedDays.length;
    workoutCorrelation = Math.min(1, Math.max(-1, (avgExercised - avgNonExercised) / 50));
  }

  // Best and worst days
  const sorted = [...dailyScores].sort((a, b) => b.score - a.score);
  const bestDay = sorted[0]?.date || 'N/A';
  const worstDay = sorted[sorted.length - 1]?.date || 'N/A';

  // Trend (compare first half vs second half)
  let trend: 'improving' | 'declining' | 'stable' = 'stable';
  if (dailyScores.length >= 4) {
    const midpoint = Math.floor(dailyScores.length / 2);
    const firstHalf = dailyScores.slice(0, midpoint).reduce((s, d) => s + d.score, 0) / midpoint;
    const secondHalf = dailyScores.slice(midpoint).reduce((s, d) => s + d.score, 0) / (dailyScores.length - midpoint);
    
    if (secondHalf - firstHalf > 10) trend = 'improving';
    else if (firstHalf - secondHalf > 10) trend = 'declining';
  }

  // Generate insights
  const insights = generateInsights(dailyScores, consistency, workoutCorrelation, trend);
  
  // Generate recommendations
  const recommendations = generateRecommendations(dailyScores, insights);

  return {
    avgDailyScore: Math.round(avgDailyScore),
    consistency: Math.round(consistency),
    workoutCorrelation: Math.round(workoutCorrelation * 100) / 100,
    bestDay,
    worstDay,
    trend,
    insights,
    recommendations,
  };
}

// =====================================================
// INSIGHTS & RECOMMENDATIONS
// =====================================================

function generateInsights(
  dailyScores: { date: string; score: number; exercised: boolean; exerciseMinutes: number }[],
  consistency: number,
  workoutCorrelation: number,
  trend: string
): string[] {
  const insights: string[] = [];

  // Consistency insight
  if (consistency >= 80) {
    insights.push('Highly consistent - you maintain steady productivity');
  } else if (consistency < 50) {
    insights.push('High variability - productivity fluctuates significantly');
  }

  // Workout correlation insight
  if (workoutCorrelation > 0.3) {
    insights.push('Exercise significantly boosts your productivity');
  } else if (workoutCorrelation < -0.2) {
    insights.push('Productivity seems lower on exercise days - check timing');
  }

  // Trend insight
  if (trend === 'improving') {
    insights.push('Productivity is trending upward this week');
  } else if (trend === 'declining') {
    insights.push('Productivity declining - consider a reset');
  }

  // Find pattern in days
  const dayScores = dailyScores.reduce((acc, d) => {
    const day = new Date(d.date).getDay();
    acc[day] = (acc[day] || 0) + d.score;
    return acc;
  }, {} as Record<number, number>);

  const bestDayNum = Object.entries(dayScores).sort((a, b) => b[1] - a[1])[0]?.[0];
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  if (bestDayNum) {
    insights.push(`Most productive on ${days[parseInt(bestDayNum)]}s`);
  }

  return insights;
}

function generateRecommendations(
  dailyScores: { date: string; score: number; exercised: boolean; exerciseMinutes: number }[],
  insights: string[]
): string[] {
  const recommendations: string[] = [];
  const lastDay = dailyScores[0]; // Most recent

  // If low score today
  if (lastDay && lastDay.score < 50) {
    recommendations.push('Start tomorrow with exercise to boost productivity');
    recommendations.push('Block focus time early in the morning');
  }

  // If no exercise
  if (!lastDay?.exercised) {
    recommendations.push('Add a 20-minute workout to improve focus');
  }

  // If high variability
  if (insights.some(i => i.includes('fluctuates'))) {
    recommendations.push('Create a more consistent daily routine');
    recommendations.push('Set fixed times for coding, exercise, and rest');
  }

  // If declining trend
  if (insights.some(i => i.includes('declining'))) {
    recommendations.push('Take a rest day and plan for next week');
    recommendations.push('Review what changed in your routine');
  }

  // General recommendations
  recommendations.push('Aim for 7-8 hours of sleep');
  recommendations.push('Schedule deep work sessions (>2 hours)');
  recommendations.push('Limit meetings to 2 hours per day');

  return recommendations.slice(0, 5); // Max 5 recommendations
}

// =====================================================
// UTILITY FUNCTIONS
// =====================================================

/**
 * Calculate weekly aggregate metrics
 */
export function aggregateWeeklyMetrics(dailyMetrics: DailyMetrics[]): {
  totalCodingMinutes: number;
  totalExerciseMinutes: number;
  totalFocusMinutes: number;
  avgScore: number;
  daysWorked: number;
  daysExercised: number;
} {
  return {
    totalCodingMinutes: dailyMetrics.reduce((sum, m) => sum + (m.github_coding_minutes || 0), 0),
    totalExerciseMinutes: dailyMetrics.reduce((sum, m) => sum + (m.exercise_minutes || 0), 0),
    totalFocusMinutes: dailyMetrics.reduce((sum, m) => sum + (m.focus_time_minutes || 0), 0),
    avgScore: Math.round(dailyMetrics.reduce((sum, m) => sum + calculateProductivityScore(m), 0) / dailyMetrics.length),
    daysWorked: dailyMetrics.filter(m => (m.github_commits || 0) > 0).length,
    daysExercised: dailyMetrics.filter(m => m.exercised_today).length,
  };
}
