import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

export async function planEpisodes(params: {
  url: string;
  userGoal: string;
  htmlSnippet: string;       // trimmed DOM, e.g., 20–30k chars
  maxEpisodes?: number;      // default 2–3
}) {
  const { url, userGoal, htmlSnippet, maxEpisodes = 3 } = params;

  const system = [
    "You are a web task planner. Do NOT control a browser.",
    "Return compact JSON only: { allowlist: string[], episodes: [{ task: string, maxSteps: number }] }",
    `Rules: 1) <= ${maxEpisodes} episodes, 2) each maxSteps 4-8, 3) tasks are specific and actionable,`,
    "4) include site:domain queries to avoid scrolling when searching,",
    "5) no prose, no explanations."
  ].join(" ");

  const user = `
URL: ${url}
GOAL: ${userGoal}

HTML_SNIPPET:
${htmlSnippet.slice(0, 30000)}
`;

  const resp = await anthropic.messages.create({
    model: "claude-3-5-haiku-latest",
    max_tokens: 220,
    system,
    messages: [{ role: "user", content: user }]
  });

  const text = resp.content?.[0]?.type === "text" ? resp.content[0].text : "{}";
  return JSON.parse(text);   // { allowlist, episodes }
}