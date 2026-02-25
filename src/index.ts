import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import chatRouter from './routes/chat';

dotenv.config();

const app = express();
const port = Number(process.env.PORT || 8000);

app.use(cors());
app.use(express.json({ limit: '1mb' }));

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/chat', chatRouter);

app.listen(port, () => {
  console.log(`LukeOS brain API running on port ${port}`);
});
