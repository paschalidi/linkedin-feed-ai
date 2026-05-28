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

export async function generateEmbedding(text: string): Promise<number[]> {
  const genAI = new GoogleGenerativeAI(getApiKey());
  const model = genAI.getGenerativeModel({ model: "text-embedding-004" });

  const result = await model.embedContent(text);
  return result.embedding.values;
}

export async function generateLinkedInPost(options: {
  idea: string;
  ideaDescription?: string;
  stylePrompt: string;
  articles: Array<{ title: string; content: string; url: string }>;
}): Promise<string> {
  const genAI = new GoogleGenerativeAI(getApiKey());
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

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
