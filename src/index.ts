import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import chatRouter from './routes/chat';
import productivityRouter from './routes/productivity';
import macrodroidRouter from './services/macrodroid';
import { initSupabase } from './services/supabase';

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

app.listen(port, () => {
  console.log(`LukeOS brain API running on port ${port}`);
});
