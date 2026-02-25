import axios from 'axios';

const HUGGINGFACE_EMBEDDING_URL = 'https://router.huggingface.co/models/sentence-transformers/all-MiniLM-L6-v2';
const FALLBACK_VECTOR_SIZE = 384; // MiniLM outputs 384-dim vectors

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

export async function generateEmbedding(text: string, huggingfaceApiKey?: string): Promise<{ embedding: number[]; provider: 'huggingface' | 'local'; model?: string }> {
  if (!huggingfaceApiKey) {
    return {
      embedding: createLocalEmbedding(text),
      provider: 'local',
      model: 'local-hash-384',
    };
  }

  try {
    const response = await axios.post(
      HUGGINGFACE_EMBEDDING_URL,
      { inputs: text },
      {
        headers: {
          Authorization: `Bearer ${huggingfaceApiKey}`,
          'Content-Type': 'application/json',
        },
      }
    );

    // HuggingFace returns array of embeddings, take the first one
    const embedding = Array.isArray(response.data) ? response.data[0] : response.data;

    return {
      embedding: embedding,
      provider: 'huggingface',
      model: 'sentence-transformers/all-MiniLM-L6-v2',
    };
  } catch (error: any) {
    console.error('HuggingFace embedding error, falling back to local embedding:', error.response?.data || error.message);
    return {
      embedding: createLocalEmbedding(text),
      provider: 'local',
      model: 'local-hash-384',
    };
  }
}
