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

    const prompt = `You are a literary analyst specializing in voice and tone. Your job is to extract the *emotional fingerprint* of a writer — not what they write about, but HOW they write. Focus on tone, authenticity, and personality. Ignore content, topics, and industry specifics entirely.

Analyze the sample posts below and produce a voice guide that captures:

1. **Emotional Temperature** — What is the baseline energy? Warm? Cold? Playful? Dead serious? Intimate or distant? Does it feel like a conversation at a bar or a boardroom presentation?

2. **Authenticity Markers** — How do they reveal themselves as a real person? Self-deprecation? Honest admissions of uncertainty? Specific personal stories with dates, names, places? Vulnerability without performativity? What makes you trust that a human wrote this, not a brand?

3. **Rhythm and Cadence** — How do the sentences breathe? Short staccato bursts? Long flowing paragraphs? Fragments? Repetition for emphasis? Read a few aloud — what is the musical pattern?

4. **Point of View** — Do they speak from "I" (personal experience) or "we" (tribal), or shift between them? Is it observational, confessional, instructional, or something else? How does their perspective on their own life and work feel?

5. **Relationship with the Reader** — How do they address you? As a peer? A student? A friend? Do they challenge, invite, confess to, or lecture the reader? What is the implied social contract?

6. **Humor and Irony** — Dry wit? Self-mockery? Absurdity? Dark humor? Or completely earnest with zero irony? How do they use humor to build connection or make a point land harder?

7. **Language Texture** — Concrete and sensory, or abstract and conceptual? Do they swear? Use slang? Technical jargon? Poetic language? Simple words carrying heavy meaning? What is the *mouthfeel* of their vocabulary?

8. **Confidence vs. Uncertainty** — Do they state things as fact, or hedge, or explore openly? How do they handle not knowing something? Is there intellectual humility, or unshakeable conviction, or both?

9. **What They Avoid** — What phrases, tones, or moves are completely absent? Corporate speak? Motivational clichés? Humble-bragging? Over-explaining? What would feel *wrong* in their mouth?

10. **The X-Factor** — If you stripped away the topic, what is the ONE thing that makes this voice unmistakably THEM? The signature move, the tell, the fingerprint that no one else has.

Output as a vivid, specific style guide that a writer could read and immediately *feel* the voice. Use sensory language. Quote short fragments from the posts as examples. Make it emotionally resonant, not a checklist.

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
