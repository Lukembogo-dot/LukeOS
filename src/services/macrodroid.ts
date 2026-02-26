import { Router, Request, Response } from 'express';
import { logActivity } from '../services/supabase';

// =====================================================
// MACRODROID WEBHOOK SERVICE
// =====================================================
// Receives data from MacroDroid automations via webhooks

const router = Router();

// Types of data MacroDroid can send
type MacroDroidEventType = 
  | 'screen_time'
  | 'app_usage'
  | 'steps'
  | 'location'
  | 'custom';

// In-memory storage for recent MacroDroid events (for demo)
// In production, this would go to Supabase
const recentEvents: Map<string, any[]> = new Map();

/**
 * POST /webhook/macrodroid
 * Receive events from MacroDroid
 * 
 * Expected payload:
 * {
 *   event_type: 'screen_time' | 'app_usage' | 'steps' | 'location' | 'custom',
 *   user_id: '123456789',
 *   data: { ... },
 *   timestamp: '2026-02-26T12:00:00Z'
 * }
 */
router.post('/webhook/macrodroid', async (req: Request, res: Response) => {
  try {
    const { event_type, user_id, data, timestamp } = req.body;

    if (!user_id || !event_type) {
      return res.status(400).json({
        error: 'Missing required fields: user_id, event_type'
      });
    }

    const telegramId = typeof user_id === 'string' ? parseInt(user_id, 10) : user_id;
    const eventTime = timestamp || new Date().toISOString();
    const date = eventTime.split('T')[0];

    // Process based on event type
    switch (event_type) {
      case 'screen_time':
        await handleScreenTime(telegramId, data, date);
        break;
        
      case 'app_usage':
        await handleAppUsage(telegramId, data, date);
        break;
        
      case 'steps':
        await handleSteps(telegramId, data, date);
        break;
        
      case 'location':
        // Store location data for pattern analysis
        await handleLocation(telegramId, data, eventTime);
        break;
        
      case 'custom':
        await handleCustomEvent(telegramId, data, date);
        break;
        
      default:
        console.warn(`Unknown MacroDroid event type: ${event_type}`);
    }

    // Store in memory for quick access
    const key = `${telegramId}:${date}`;
    const events = recentEvents.get(key) || [];
    events.push({ event_type, data, timestamp: eventTime });
    recentEvents.set(key, events);

    res.json({ success: true, event_type, timestamp: eventTime });
  } catch (error) {
    console.error('MacroDroid webhook error:', error);
    res.status(500).json({ error: 'Failed to process webhook' });
  }
});

/**
 * GET /webhook/macrodroid/:userId
 * Get recent MacroDroid events for a user
 */
router.get('/webhook/macrodroid/:userId', async (req: Request, res: Response) => {
  try {
    // Handle array case from query params
    const userIdParam = req.params.userId;
    const userId = Array.isArray(userIdParam) ? userIdParam[0] : userIdParam;
    const { date } = req.query;
    
    const telegramId = parseInt(userId, 10);
    const dateStr = date as string || new Date().toISOString().split('T')[0];
    const key = `${telegramId}:${dateStr}`;
    
    const events = recentEvents.get(key) || [];
    
    res.json({ date: dateStr, events });
  } catch (error) {
    console.error('Error fetching MacroDroid events:', error);
    res.status(500).json({ error: 'Failed to fetch events' });
  }
});

// =====================================================
// HANDLER FUNCTIONS
// =====================================================

async function handleScreenTime(telegramId: number, data: any, date: string) {
  // data: { total_minutes: number, apps: [{ name, minutes }] }
  const totalMinutes = data?.total_minutes || 0;
  
  if (totalMinutes > 0) {
    // Log as activity
    await logActivity(
      telegramId,
      'screentime',
      totalMinutes,
      `Screen time: ${totalMinutes} mins. Top apps: ${(data.apps || []).slice(0, 3).map((a: any) => a.name).join(', ')}`,
      date
    );
  }
}

async function handleAppUsage(telegramId: number, data: any, date: string) {
  // data: { productive_minutes, unproductive_minutes, apps: [...] }
  const productive = data?.productive_minutes || 0;
  const unproductive = data?.unproductive_minutes || 0;
  
  // Log productive app usage
  if (productive > 0) {
    await logActivity(
      telegramId,
      'coding',
      productive,
      `Productive app usage: ${data.productive_apps?.join(', ')}`,
      date
    );
  }
}

async function handleSteps(telegramId: number, data: any, date: string) {
  // data: { steps: number, goal: number }
  const steps = data?.steps || 0;
  const goal = data?.goal || 10000;
  
  if (steps > 0) {
    // Convert steps to exercise minutes (approx 1000 steps = 10 mins)
    const exerciseMinutes = Math.round(steps / 100);
    
    await logActivity(
      telegramId,
      'exercise',
      exerciseMinutes,
      `Steps: ${steps}/${goal} (${Math.round(steps/goal*100)}%)`,
      date
    );
  }
}

async function handleLocation(telegramId: number, data: any, timestamp: string) {
  // Store location for pattern analysis
  // In production, save to Supabase
  console.log(`Location update for ${telegramId}:`, data);
}

async function handleCustomEvent(telegramId: number, data: any, date: string) {
  // Handle custom events from MacroDroid
  const eventName = data?.event_name || 'custom';
  const value = data?.value || 0;
  
  // Map custom events to categories
  const categoryMap: Record<string, string> = {
    'workout': 'exercise',
    'reading': 'reading',
    'meditation': 'exercise',
    'coding': 'coding',
  };
  
  const category = categoryMap[eventName] || 'other';
  
  if (value > 0) {
    await logActivity(
      telegramId,
      category,
      value,
      `Custom event: ${eventName}`,
      date
    );
  }
}

export default router;
