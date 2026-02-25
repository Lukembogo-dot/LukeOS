import { GroqMessage } from '../types';

interface MemoryTurn {
  user: string;
  assistant: string;
  createdAt: number;
}

const memoryStore = new Map<string, MemoryTurn[]>();
const MAX_TURNS_PER_USER = 30;

export function getRecentMessages(userId: string, maxTurns = 6): GroqMessage[] {
  const turns = memoryStore.get(userId) ?? [];
  const selected = turns.slice(-maxTurns);

  return selected.flatMap((turn) => [
    { role: 'user' as const, content: turn.user },
    { role: 'assistant' as const, content: turn.assistant },
  ]);
}

export function getMemoryContext(userId: string, maxTurns = 4): string {
  const turns = memoryStore.get(userId) ?? [];
  const selected = turns.slice(-maxTurns);

  if (selected.length === 0) {
    return 'No prior memory found for this user.';
  }

  const lines = selected.map((turn, index) => {
    return `Turn ${index + 1}\nUser: ${turn.user}\nAssistant: ${turn.assistant}`;
  });

  return lines.join('\n\n');
}

export function saveConversation(userId: string, userMessage: string, assistantMessage: string): void {
  const turns = memoryStore.get(userId) ?? [];

  turns.push({
    user: userMessage,
    assistant: assistantMessage,
    createdAt: Date.now(),
  });

  if (turns.length > MAX_TURNS_PER_USER) {
    turns.splice(0, turns.length - MAX_TURNS_PER_USER);
  }

  memoryStore.set(userId, turns);
}

export function getRetrievedCount(userId: string, maxTurns = 6): number {
  const turns = memoryStore.get(userId) ?? [];
  return Math.min(turns.length, maxTurns);
}
