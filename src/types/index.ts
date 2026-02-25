export type BrainMode = 'chat' | 'embed' | 'analyze';

export interface ChatRequest {
  user_message: string;
  user_id: string;
  mode?: BrainMode;
}

export interface ChatResponse {
  response: string;
  embedding?: number[];
  metadata: {
    mode: BrainMode;
    provider: 'groq' | 'gemini' | 'huggingface' | 'local';
    model?: string;
    memory_used: boolean;
    retrieved_messages: number;
    timestamp: string;
  };
}

export interface GroqMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}
