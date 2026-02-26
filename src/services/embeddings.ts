import axios from 'axios';

const COHERE_API_URL = 'https://api.cohere.ai/v1/embed';
const COHERE_MODEL = 'embed-english-v3.0'; // High quality embeddings
const FALLBACK_VECTOR_SIZE = 1024; // Cohere v3.0 outputs 1024-dim vectors

function createLocalEmbedding(text: string): number[] {
  const vector = new Array<number>(FALLBACK_VECTOR_SIZE).fill(0);

  for (let i = 0; i < text.length; i += 1) {
    const code = text.charCodeAt(i);
    const idx = i % FALLBACK_VECTOR_SIZE;
    vector[idx] += (code % 97) / 97;
  }

  const norm = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0)) || 1;
  return vector.map((v) => Number((v / norm).toFixed(6)));
}

export async function generateEmbedding(
  text: string,
  cohereApiKey?: string,
  inputType: 'search_query' | 'search_document' = 'search_document'
): Promise<{
  embedding: number[];
  provider: 'cohere' | 'local';
  model?: string;
}> {
  if (!cohereApiKey) {
    return {
      embedding: createLocalEmbedding(text),
      provider: 'local',
      model: 'local-hash-1024',
    };
  }

  try {
    const response = await axios.post(
      COHERE_API_URL,
      {
        texts: [text],
        model: COHERE_MODEL,
        input_type: inputType, // Use 'search_query' for queries, 'search_document' for documents
      },
      {
        headers: {
          'Authorization': `Bearer ${cohereApiKey}`,
          'Content-Type': 'application/json',
        },
      }
    );

    // Cohere returns embeddings array, take the first one
    const embedding = response.data.embeddings?.[0];

    if (!embedding) {
      console.error('Cohere API returned empty embeddings, falling back to local embedding');
      return {
        embedding: createLocalEmbedding(text),
        provider: 'local',
        model: 'local-hash-1024',
      };
    }

    return {
      embedding: embedding,
      provider: 'cohere',
      model: COHERE_MODEL,
    };
  } catch (error: any) {
    console.error(
      'Cohere embedding error, falling back to local embedding:',
      error.response?.data || error.message
    );
    return {
      embedding: createLocalEmbedding(text),
      provider: 'local',
      model: 'local-hash-1024',
    };
  }
}
