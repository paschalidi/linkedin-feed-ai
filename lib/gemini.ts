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

Below are sample posts. Your task: write a COMPREHENSIVE voice guide with ALL TEN sections listed below. Each section must be at least 3–4 sentences and include SPECIFIC examples (short quotes) from the posts. Do NOT summarize — analyze deeply. This should be a substantial document, not a brief summary.

Format your output EXACTLY as follows, with each section as a markdown heading:

## 1. Emotional Temperature
[3–4 sentences analyzing baseline energy. Warm? Cold? Playful? Dead serious? Intimate or distant? Quote specific fragments as evidence.]

## 2. Authenticity Markers
[3–4 sentences. How do they reveal themselves as a real person? Self-deprecation? Honest admissions? Specific personal stories with dates/names/places? Quote examples.]

## 3. Rhythm and Cadence
[3–4 sentences. How do sentences breathe? Short bursts? Long paragraphs? Fragments? Repetition? Quote examples showing the musical pattern.]

## 4. Point of View
[3–4 sentences. "I" vs "we"? Observational, confessional, instructional? Quote examples showing perspective shifts.]

## 5. Relationship with the Reader
[3–4 sentences. Peer? Student? Friend? Do they challenge, invite, confess? Quote examples of direct address or implied tone.]

## 6. Humor and Irony
[3–4 sentences. Dry wit? Self-mockery? Absurdity? Earnest with zero irony? Quote examples of humor or its absence.]

## 7. Language Texture
[3–4 sentences. Concrete/sensory or abstract? Swearing? Slang? Technical jargon? Poetic? Quote words/phrases that show mouthfeel.]

## 8. Confidence vs. Uncertainty
[3–4 sentences. State facts? Hedge? Explore openly? Intellectual humility or unshakeable conviction? Quote examples of each mode.]

## 9. What They Avoid
[3–4 sentences. What phrases, tones, moves are COMPLETELY absent? Corporate speak? Clichés? Humble-bragging? Over-explaining? Be specific about what would feel WRONG in their mouth.]

## 10. The X-Factor
[3–4 sentences. Stripped of topic, what makes this voice unmistakably THEM? The signature move, the tell, the fingerprint no one else has.]

RULES:
- You MUST include all 10 sections. Do not skip any.
- Each section MUST contain at least one direct quote from the posts.
- Write in vivid, sensory language. A writer should read this and immediately *feel* the voice.
- Be specific, not generic. Avoid phrases like "they write well" or "their style is engaging." Say WHAT specifically makes it engaging.

POSTS:
${postsText}`;

    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 8192,
      },
    });

    const text = result.response.text() ?? "";
    console.log(
      `[analyzeWritingStyle] Response length: ${text.length} chars, finish reason:`,
      result.response.candidates?.[0]?.finishReason
    );
    return text;
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
