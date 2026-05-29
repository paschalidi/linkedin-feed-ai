import Anthropic from "@anthropic-ai/sdk";
import {
  buildSystemPrompt,
  buildUserPrompt,
  buildStyleAnalysisPrompt,
} from "./prompts";

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
  examples?: string[];
}): Promise<string> {
  const anthropic = new Anthropic({ apiKey: getApiKey() });

  const systemPrompt = buildSystemPrompt(options.stylePrompt, options.examples);
  const userPrompt = buildUserPrompt(options);

  const msg = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 900,
    temperature: 0.85,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
  });

  const content = msg.content[0];
  if (content.type === "text") {
    return content.text;
  }
  return "";
}

export async function analyzeWritingStyle(
  postsText: string
): Promise<string> {
  const anthropic = new Anthropic({ apiKey: getApiKey() });

  const prompt = buildStyleAnalysisPrompt(postsText);

  const msg = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 2000,
    temperature: 0.7,
    messages: [{ role: "user", content: prompt }],
  });

  const content = msg.content[0];
  if (content.type === "text") {
    return content.text;
  }
  return "";
}
