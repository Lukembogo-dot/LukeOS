import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import chatRouter from './routes/chat';
import productivityRouter from './routes/productivity';
import macrodroidRouter from './services/macrodroid';
import { initSupabase } from './services/supabase';
import { runWeeklyCollection } from './services/cron';

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
