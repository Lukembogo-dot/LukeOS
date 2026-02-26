import axios from 'axios';

// =====================================================
// GOOGLE CALENDAR API SERVICE
// =====================================================
// Fetches calendar events for productivity analysis

interface CalendarEvent {
  id: string;
  summary: string;
  description?: string;
  start: string;
  end: string;
  durationMinutes: number;
  eventType: 'work' | 'personal' | 'meeting' | 'focus' | 'other';
  attendees?: string[];
  conferenceData?: any;
}

interface CalendarSummary {
  totalEvents: number;
  totalMeetingMinutes: number;
  totalFocusMinutes: number;
  eventsByType: Record<string, number>;
  busySlots: number; // hours marked as busy
  freeSlots: number; // hours marked as free
}

/**
 * Get calendar events for a date range using Google Calendar API
 */
export async function getCalendarEvents(
  accessToken: string,
  startDate: string,
  endDate: string
): Promise<CalendarEvent[]> {
  try {
    const response = await axios.get(
      'https://www.googleapis.com/calendar/v3/calendars/primary/events',
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
        params: {
          timeMin: `${startDate}T00:00:00Z`,
          timeMax: `${endDate}T23:59:59Z`,
          singleEvents: true,
          orderBy: 'startTime',
          maxResults: 250,
        },
      }
    );

    const events: CalendarEvent[] = (response.data.items || [])
      .filter((event: any) => event.status !== 'cancelled')
      .map((event: any) => {
        const start = new Date(event.start.dateTime || event.start.date);
        const end = new Date(event.end.dateTime || event.end.date);
        const durationMinutes = Math.round((end.getTime() - start.getTime()) / 60000);

        return {
          id: event.id,
          summary: event.summary || 'Untitled',
          description: event.description,
          start: event.start.dateTime || event.start.date,
          end: event.end.dateTime || event.end.date,
          durationMinutes,
          eventType: classifyEvent(event.summary, event.description),
          attendees: event.attendees?.map((a: any) => a.email) || [],
          conferenceData: event.conferenceData,
        };
      });

    return events;
  } catch (error: any) {
    console.error('Calendar API error:', error.response?.data || error.message);
    return [];
  }
}

/**
 * Classify event type based on title and description
 */
function classifyEvent(
  summary?: string,
  description?: string
): 'work' | 'personal' | 'meeting' | 'focus' | 'other' {
  const text = `${summary || ''} ${description || ''}`.toLowerCase();
  
  // Focus keywords
  if (
    text.includes('focus') ||
    text.includes('deep work') ||
    text.includes('study') ||
    text.includes('coding') ||
    text.includes('programming')
  ) {
    return 'focus';
  }
  
  // Meeting keywords
  if (
    text.includes('meeting') ||
    text.includes('call') ||
    text.includes('sync') ||
    text.includes('standup') ||
    text.includes('1:1') ||
    text.includes('1-on-1')
  ) {
    return 'meeting';
  }
  
  // Personal keywords
  if (
    text.includes('lunch') ||
    text.includes('break') ||
    text.includes('personal') ||
    text.includes('appointment') ||
    text.includes('medical') ||
    text.includes('gym') ||
    text.includes('workout')
  ) {
    return 'personal';
  }
  
  // Work keywords
  if (
    text.includes('work') ||
    text.includes('project') ||
    text.includes('task') ||
    text.includes('deadline')
  ) {
    return 'work';
  }
  
  return 'other';
}

/**
 * Summarize calendar events
 */
export function summarizeCalendarEvents(events: CalendarEvent[]): CalendarSummary {
  const summary: CalendarSummary = {
    totalEvents: events.length,
    totalMeetingMinutes: 0,
    totalFocusMinutes: 0,
    eventsByType: {},
    busySlots: 0,
    freeSlots: 0,
  };

  for (const event of events) {
    summary.eventsByType[event.eventType] = 
      (summary.eventsByType[event.eventType] || 0) + 1;
    
    if (event.eventType === 'meeting') {
      summary.totalMeetingMinutes += event.durationMinutes;
    } else if (event.eventType === 'focus') {
      summary.totalFocusMinutes += event.durationMinutes;
    }
    
    // Estimate busy slots (8 hours work day - events = busy)
    summary.busySlots += event.durationMinutes / 60;
  }

  // Assume 8 hour workday
  const totalWorkHours = 8;
  summary.freeSlots = Math.max(0, totalWorkHours - summary.busySlots);

  return summary;
}

/**
 * Get productive hours (focus time + meetings)
 */
export function getProductiveHours(events: CalendarEvent[]): number {
  return events.reduce((sum, e) => {
    if (e.eventType === 'focus' || e.eventType === 'meeting') {
      return sum + e.durationMinutes / 60;
    }
    return sum;
  }, 0);
}

/**
 * Check if had deep work session (>2 hours focus)
 */
export function hadDeepWorkSession(events: CalendarEvent[]): boolean {
  return events.some(e => 
    e.eventType === 'focus' && e.durationMinutes >= 120
  );
}
