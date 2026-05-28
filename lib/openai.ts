import OpenAI from "openai";

export async function generateEmbedding(text: string): Promise<number[]> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not set");
  }

  const openai = new OpenAI({ apiKey });

  const response = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: text,
  });
  return response.data[0].embedding;
}

export async function generateLinkedInPost(options: {
  idea: string;
  ideaDescription?: string;
  stylePrompt: string;
  articles: Array<{ title: string; content: string; url: string }>;
}): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not set");
  }

  const openai = new OpenAI({ apiKey });

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

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    temperature: 0.8,
    max_tokens: 800,
  });

  return response.choices[0].message.content ?? "";
}
