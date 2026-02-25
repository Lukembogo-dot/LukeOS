import { Router, Request, Response } from 'express';
import { handleBrainRequest } from '../main';
import { ChatRequest } from '../types';

const router = Router();

router.post('/', async (req: Request, res: Response) => {
  try {
    const payload = req.body as ChatRequest;
    const result = await handleBrainRequest(payload);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({
      response: '',
      embedding: [],
      metadata: {
        mode: req.body?.mode ?? 'chat',
        provider: 'local',
        memory_used: false,
        retrieved_messages: 0,
        timestamp: new Date().toISOString(),
      },
      error: error.message || 'Request failed',
    });
  }
});

export default router;
