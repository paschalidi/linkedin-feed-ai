import { GoogleGenerativeAI, TaskType } from "@google/generative-ai";
import { buildSystemPrompt, buildUserPrompt } from "./prompts";

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
      const is429 =
        status === 429 || (err.message && err.message.includes("429"));
      if (is429 && attempt < maxRetries) {
        const delay = Math.pow(2, attempt) * baseDelay;
        console.warn(
          `Gemini rate limited (429). Retrying in ${delay}ms... (attempt ${attempt + 1}/${maxRetries})`
        );
        await sleep(delay);
        continue;
      }
      throw err;
    }
  }

  throw lastError || new Error("Failed after retries");
}

/**
 * Generate an embedding with Gemini's gemini-embedding-001.
 *
 * Supports task-specific embeddings via `taskType`:
 *   - "RETRIEVAL_DOCUMENT" — for stored documents (ingestion)
 *   - "RETRIEVAL_QUERY"    — for search queries (retrieval)
 *   - "SEMANTIC_SIMILARITY" — for pairwise similarity
 *
 * The `title` parameter is used by RETRIEVAL_DOCUMENT to condition
 * the embedding on which article the text belongs to, improving
 * retrieval quality by ~5–15%.
 */
export async function generateEmbedding(
  text: string,
  options?: {
    taskType?: "RETRIEVAL_DOCUMENT" | "RETRIEVAL_QUERY" | "SEMANTIC_SIMILARITY";
    title?: string;
  }
): Promise<number[]> {
  return tryWithRetry(async () => {
    const genAI = new GoogleGenerativeAI(getApiKey());
    const model = genAI.getGenerativeModel({ model: "gemini-embedding-001" });

    const taskType = options?.taskType;
    const title = options?.title;

    let result;
    if (taskType) {
      // Type cast needed because the SDK types are slightly restrictive
      result = await model.embedContent({
        content: { role: "user", parts: [{ text }] },
        taskType: taskType as unknown as TaskType,
        ...(title ? { title } : {}),
      });
    } else {
      result = await model.embedContent(text);
    }

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
    examples?: string[];
  },
  modelName: string
): Promise<string> {
  const genAI = new GoogleGenerativeAI(getApiKey());
  const model = genAI.getGenerativeModel({ model: modelName });

  const systemPrompt = buildSystemPrompt(options.stylePrompt, options.examples);
  const userPrompt = buildUserPrompt(options);

  const result = await model.generateContent({
    systemInstruction: systemPrompt,
    contents: [{ role: "user", parts: [{ text: userPrompt }] }],
    generationConfig: {
      temperature: 0.85,
      maxOutputTokens: 900,
    },
  });

  return result.response.text() ?? "";
}

export async function analyzeWritingStyle(postsText: string): Promise<string> {
  return tryWithRetry(async () => {
    const genAI = new GoogleGenerativeAI(getApiKey());
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const prompt = `You are analyzing a corpus of LinkedIn posts to extract a writing style guide.

Below are sample posts. Identify the patterns:

1. Average post length (words / paragraphs)
2. Sentence structure (short punchy / flowing / mixed)
3. Common opening hooks
4. Whitespace and formatting conventions
5. Tone (confident / vulnerable / contrarian / educational / ...)
6. Vocabulary register (formal / casual / technical / mixed)
7. How they use data, numbers, specifics
8. How they tell stories or share personal anecdotes
9. Closing patterns (call-to-action / declarative summary / question)
10. What they DON'T do (clichés they avoid)

Output a writing style guide a junior writer could follow to imitate this voice.
Be specific. Use examples from the posts.
Output as markdown.

POSTS:
${postsText}`;

    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 2000,
      },
    });

    return result.response.text() ?? "";
  });
}

export async function generateLinkedInPost(options: {
  idea: string;
  ideaDescription?: string;
  stylePrompt: string;
  articles: Array<{ title: string; content: string; url: string }>;
  examples?: string[];
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
      const is429 =
        err.status === 429 || (err.message && err.message.includes("429"));
      if (!is429) throw err; // Non-retryable error
      console.warn(`Model ${modelName} rate limited. Trying fallback...`);
    }
  }

  throw (
    lastError ||
    new Error("All Gemini models exhausted their free-tier quota. Try again tomorrow.")
  );
}
