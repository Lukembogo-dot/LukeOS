import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import chatRouter from './routes/chat';
import productivityRouter from './routes/productivity';
import macrodroidRouter from './services/macrodroid';
import { initSupabase, syncAllStravaActivities, syncAllGitHubActivity } from './services/supabase';
import { runWeeklyCollection } from './services/cron';
import { getAllStravaActivities } from './services/strava';
import { getGitHubActivity } from './services/github';

dotenv.config();

const app = express();
const port = Number(process.env.PORT || 8000);

// Initialize Supabase
initSupabase();

app.use(cors());
app.use(express.json({ limit: '1mb' }));

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Strava OAuth endpoints
const stravaClientId = process.env.STRAVA_CLIENT_ID;
const stravaClientSecret = process.env.STRAVA_CLIENT_SECRET;
const stravaRedirectUri = process.env.STRAVA_REDIRECT_URI || 'http://localhost:8000/auth/strava/callback';

// Generate Strava OAuth URL with correct scope
app.get('/auth/strava', (_req, res) => {
  if (!stravaClientId || !stravaClientSecret) {
    res.status(500).json({ error: 'STRAVA_CLIENT_ID or STRAVA_CLIENT_SECRET not configured in .env' });
    return;
  }
  
  // Request activity:read_all scope to read all activities
  const scope = 'activity:read_all';
  const authUrl = `https://www.strava.com/oauth/authorize?client_id=${stravaClientId}&redirect_uri=${encodeURIComponent(stravaRedirectUri)}&response_type=code&scope=${scope}`;
  
  res.json({
    message: 'Open this URL in your browser to authorize Strava access:',
    authUrl,
    instructions: 'After authorizing, you will be redirected to the callback URL with a code. Copy that code and use it with /auth/strava/token endpoint.'
  });
});

// Exchange authorization code for access token
app.post('/auth/strava/token', async (req, res) => {
  const { code } = req.body;
  
  if (!code) {
    res.status(400).json({ error: 'Authorization code required. Send: { "code": "your_code" }' });
    return;
  }
  
  if (!stravaClientId || !stravaClientSecret) {
    res.status(500).json({ error: 'Strava OAuth not configured' });
    return;
  }
  
  try {
    const response = await fetch('https://www.strava.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: stravaClientId,
        client_secret: stravaClientSecret,
        code,
        grant_type: 'authorization_code',
      }),
    });
    
    const data = await response.json();
    
    if (data.access_token) {
      res.json({
        message: 'Successfully obtained Strava access token!',
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        expires_at: data.expires_at,
        expires_in: data.expires_in,
        athlete: data.athlete,
        instructions: 'Add these to your .env file as STRAVA_ACCESS_TOKEN and STRAVA_REFRESH_TOKEN'
      });
    } else {
      res.status(400).json({ error: 'Failed to get access token', details: data });
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.use('/chat', chatRouter);

// Productivity tracking routes (activities, goals, weekly analysis)
app.use('/api', productivityRouter);

// MacroDroid webhook for real-time data ingestion
app.use('/webhook', macrodroidRouter);

// Cron job endpoint (manual trigger for weekly collection)
app.post('/api/cron/collect', async (req, res) => {
  try {
    const body = req.body || {};
    const telegramId = body.telegramId || body.user_id || 1;
    console.log(`
 🚀 Triggering weekly collection for user ${telegramId}...`);
    const result = await runWeeklyCollection(telegramId);
    res.json({ success: true, ...result });
  } catch (error: any) {
    console.error('Cron collection error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get cron job status/info
app.get('/api/cron/status', (_req, res) => {
  res.json({
    status: 'ready',
    schedule: 'Weekly (Sundays at midnight)',
    manual_trigger: 'POST /api/cron/collect',
    services: {
      github: !!process.env.GITHUB_USERNAME,
      strava: !!process.env.STRAVA_CLIENT_ID,
    },
  });
});

app.listen(port, () => {
  console.log(`LukeOS brain API running on port ${port}`);
});

// Strava sync endpoint - imports all activities to database
app.post('/api/strava/sync', async (req, res) => {
  const telegramId = req.body.telegramId || req.body.user_id || 1966734159;
  const days = req.body.days || 180;
  
  const stravaToken = process.env.STRAVA_ACCESS_TOKEN;
  if (!stravaToken) {
    res.status(500).json({ error: 'STRAVA_ACCESS_TOKEN not configured' });
    return;
  }
  
  try {
    // Get date range
    const today = new Date();
    const pastDate = new Date();
    pastDate.setDate(today.getDate() - days);
    
    const todayStr = today.toISOString().split('T')[0];
    const pastStr = pastDate.toISOString().split('T')[0];
    
    console.log(`🔄 Syncing Strava activities for user ${telegramId} from ${pastStr} to ${todayStr}...`);
    
    // Fetch all activities from Strava
    const activities = await getAllStravaActivities(stravaToken, pastStr, todayStr);
    
    if (activities.length === 0) {
      res.json({ message: 'No activities found', synced: 0 });
      return;
    }
    
    // Sync to database
    const result = await syncAllStravaActivities(Number(telegramId), activities);
    
    res.json({
      message: `Synced ${result.synced} activities to database`,
      total_activities: activities.length,
      synced: result.synced,
      errors: result.errors,
      date_range: { from: pastStr, to: todayStr }
    });
  } catch (error: any) {
    console.error('Strava sync error:', error);
    res.status(500).json({ error: error.message });
  }
});

// GitHub sync endpoint - imports all commits to database
app.post('/api/github/sync', async (req, res) => {
  const telegramId = req.body.telegramId || req.body.user_id || 1966734159;
  const days = req.body.days || 30;
  
  const githubUsername = process.env.GITHUB_USERNAME;
  const githubToken = process.env.GITHUB_TOKEN;
  
  if (!githubUsername) {
    res.status(500).json({ error: 'GITHUB_USERNAME not configured' });
    return;
  }
  
  try {
    // Get date range
    const today = new Date();
    const pastDate = new Date();
    pastDate.setDate(today.getDate() - days);
    
    const todayStr = today.toISOString().split('T')[0];
    const pastStr = pastDate.toISOString().split('T')[0];
    
    console.log(`🔄 Syncing GitHub activity for user ${telegramId} from ${pastStr} to ${todayStr}...`);
    
    // Fetch all GitHub activity
    const activity = await getGitHubActivity(githubUsername, pastStr, todayStr, githubToken);
    
    if (activity.commits.length === 0) {
      res.json({ message: 'No commits found', synced: 0 });
      return;
    }
    
    // Sync to database
    const result = await syncAllGitHubActivity(Number(telegramId), activity.commits, activity.pullRequests);
    
    res.json({
      message: `Synced ${result.synced} commits to database`,
      total_commits: activity.commits.length,
      total_prs: activity.pullRequests.length,
      synced: result.synced,
      errors: result.errors,
      date_range: { from: pastStr, to: todayStr }
    });
  } catch (error: any) {
    console.error('GitHub sync error:', error);
    res.status(500).json({ error: error.message });
  }
});
