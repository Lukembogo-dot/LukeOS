import axios from 'axios';
import { GroqMessage } from '../types';

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

export async function chatWithGroq(
  messages: GroqMessage[],
  apiKey: string
): Promise<string> {
  try {
    const response = await axios.post(
      GROQ_API_URL,
      {
        model: 'llama-3.3-70b-versatile',
        messages: messages,
        temperature: 0.7,
        max_tokens: 1000,
      },
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      }
    );

    return response.data.choices[0].message.content;
  } catch (error: any) {
    console.error('Groq API error:', error.response?.data || error.message);
    throw new Error('Failed to get response from Groq');
  }
}