import { GoogleGenerativeAI } from "@google/generative-ai";

function getApiKey(): string {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "GEMINI_API_KEY is not set.\n\n" +
      "To generate posts, add your Gemini API key to .env.local:\n" +
      "GEMINI_API_KEY=your-key-here\n\n" +
      "Get one at: https://aistudio.google.com/app/apikey"
    );
  }
  return apiKey;
}

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Convert a JavaScript number array to a pgvector text literal string.
 * pgvector text input format: [0.1,0.2,0.3]
 * @see https://github.com/pgvector/pgvector/blob/master/README.md
 */
export function formatEmbeddingForPostgres(embedding: number[]): string {
  return "[" + embedding.join(",") + "]";
}

async function tryWithRetry<T>(
  fn: () => Promise<T>,
  options: { maxRetries?: number; baseDelay?: number } = {}
): Promise<T> {
  const { maxRetries = 3, baseDelay = 1000 } = options;
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      lastError = err;
      const status = err.status ?? err.code;
      const is429 = status === 429 || (err.message && err.message.includes("429"));
      if (is429 && attempt < maxRetries) {
        const delay = Math.pow(2, attempt) * baseDelay;
        console.warn(`Gemini rate limited (429). Retrying in ${delay}ms... (attempt ${attempt + 1}/${maxRetries})`);
        await sleep(delay);
        continue;
      }
      throw err;
    }
  }

  throw lastError || new Error("Failed after retries");
}

export async function generateEmbedding(text: string): Promise<number[]> {
  return tryWithRetry(async () => {
    const genAI = new GoogleGenerativeAI(getApiKey());
    const model = genAI.getGenerativeModel({ model: "gemini-embedding-001" });
    const result = await model.embedContent(text);
    const embedding = result.embedding.values;
    // Truncate to 768 dimensions using Matryoshka Representation Learning
    return embedding.slice(0, 768);
  });
}

async function generateWithModel(
  options: {
    idea: string;
    ideaDescription?: string;
    stylePrompt: string;
    articles: Array<{ title: string; content: string; url: string }>;
  },
  modelName: string
): Promise<string> {
  const genAI = new GoogleGenerativeAI(getApiKey());
  const model = genAI.getGenerativeModel({ model: modelName });

  const articleContext = options.articles
    .map(
      (a, i) =>
        `Article ${i + 1}: ${a.title}\nSource: ${a.url}\n${a.content.slice(0, 2000)}`
    )
    .join("\n\n---\n\n");

  const systemPrompt = `You are a LinkedIn content strategist. Write engaging, professional LinkedIn posts based on the user's idea and reference articles.

Writing Style:
${options.stylePrompt}

Guidelines:
- Write 3-5 short paragraphs
- Use line breaks for readability
- Include a hook in the first line
- Add 1-3 relevant bullet points if appropriate
- End with a question or call-to-action to drive engagement
- Keep it under 300 words
- Do not use hashtags unless specifically requested in the style
- Match the tone and voice described in the Writing Style section`;

  const userPrompt = `Idea: ${options.idea}
${options.ideaDescription ? `Description: ${options.ideaDescription}\n` : ""}

Reference Articles:
${articleContext}

Write a LinkedIn post about this idea, using the reference articles for context and facts. Do not copy-paste from the articles — synthesize and add your own perspective.`;

  const result = await model.generateContent({
    systemInstruction: systemPrompt,
    contents: [{ role: "user", parts: [{ text: userPrompt }] }],
    generationConfig: {
      temperature: 0.8,
      maxOutputTokens: 800,
    },
  });

  return result.response.text() ?? "";
}

export async function generateLinkedInPost(options: {
  idea: string;
  ideaDescription?: string;
  stylePrompt: string;
  articles: Array<{ title: string; content: string; url: string }>;
}): Promise<string> {
  // Try models in order: flash-lite (higher free quota) -> flash (better quality)
  const models = ["gemini-2.5-flash-lite", "gemini-2.5-flash"];
  let lastError: Error | undefined;

  for (const modelName of models) {
    try {
      return await tryWithRetry(
        () => generateWithModel(options, modelName),
        { maxRetries: 2, baseDelay: 2000 }
      );
    } catch (err: any) {
      lastError = err;
      const is429 = err.status === 429 || (err.message && err.message.includes("429"));
      if (!is429) throw err; // Non-retryable error
      console.warn(`Model ${modelName} rate limited. Trying fallback...`);
    }
  }

  throw lastError || new Error("All Gemini models exhausted their free-tier quota. Try again tomorrow.");
}
