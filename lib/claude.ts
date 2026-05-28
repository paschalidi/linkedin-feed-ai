import Anthropic from "@anthropic-ai/sdk";

function getApiKey(): string {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY is not set.\n\n" +
      "To generate posts with Claude, add your Anthropic API key to .env.local:\n" +
      "ANTHROPIC_API_KEY=sk-ant-...\n\n" +
      "Get one at: https://console.anthropic.com/settings/keys"
    );
  }
  return apiKey;
}

export async function generateLinkedInPost(options: {
  idea: string;
  ideaDescription?: string;
  stylePrompt: string;
  articles: Array<{ title: string; content: string; url: string }>;
}): Promise<string> {
  const anthropic = new Anthropic({ apiKey: getApiKey() });

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

  const msg = await anthropic.messages.create({
    model: "claude-3-5-sonnet-20241022",
    max_tokens: 800,
    temperature: 0.8,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
  });

  const content = msg.content[0];
  if (content.type === "text") {
    return content.text;
  }
  return "";
}
