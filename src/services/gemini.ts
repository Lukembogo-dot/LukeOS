import axios from 'axios';

// List of Gemini models to try (in order of preference)
const GEMINI_MODELS = [
  'gemini-2.5-flash',      // Latest, works!
  'gemini-2.5-pro',        // Pro version
  'gemini-2.0-flash',      // Older flash
  'gemini-2.0-flash-001',  // Stable version
];

let GEMINI_MODEL = GEMINI_MODELS[0]; // Start with first model

export async function analyzeWithGemini(prompt: string, apiKey: string): Promise<string> {
  // Try each model until one works
  for (const model of GEMINI_MODELS) {
    console.log(`\n🔄 Trying Gemini model: ${model}`);

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    try {
      console.log(`📤 Sending request to: ${url.split('?')[0]}`);

      const response = await axios.post(
        url,
        {
          contents: [
            {
              role: 'user',
              parts: [{ text: prompt }],
            },
          ],
        },
        {
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      console.log(`📥 Got response from Gemini`);

      const text = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!text) {
        console.warn(`⚠️  Empty response from ${model}`);
        throw new Error('Gemini returned an empty response.');
      }

      // If successful, update the preferred model for next calls
      GEMINI_MODEL = model;
      console.log(`✅ Success with model: ${model}\n`);
      return text;
    } catch (error: any) {
      const errorMsg = error.response?.data?.error?.message || error.message;
      const status = error.response?.status;
      console.error(`❌ Model ${model} failed [${status}]: ${errorMsg}`);
      // Continue to next model
    }
  }

  // All models failed
  console.error(`\n❌ ALL GEMINI MODELS FAILED\n`);
  throw new Error('All Gemini models failed. Check API key and model availability.');
}

export { GEMINI_MODEL };
