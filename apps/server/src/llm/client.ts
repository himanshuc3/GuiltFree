import type { Config } from '../config';

/** Any OpenAI-compatible chat endpoint serving an open-weight model (OpenRouter, Ollama, vLLM...). */
export interface LlmClient {
  model: string;
  complete(system: string, user: string): Promise<string>;
}

export function createLlmClient(config: Config): LlmClient | null {
  if (!config.LLM_API_KEY) return null;
  const { LLM_BASE_URL: base, LLM_API_KEY: key, LLM_MODEL: model } = config;

  return {
    model,
    async complete(system, user) {
      const res = await fetch(`${base.replace(/\/$/, '')}/chat/completions`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
        body: JSON.stringify({
          model,
          temperature: 0,
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: user },
          ],
        }),
        signal: AbortSignal.timeout(60_000),
      });
      if (!res.ok) throw new Error(`LLM request failed: ${res.status} ${(await res.text()).slice(0, 200)}`);
      const body = (await res.json()) as { choices?: { message?: { content?: string } }[] };
      const content = body.choices?.[0]?.message?.content;
      if (!content) throw new Error('LLM returned no content');
      return content;
    },
  };
}

/** Pulls the first JSON object out of a model reply, tolerating ```json fences and chatter. */
export function extractJson(text: string): unknown {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('no JSON object in model output');
  return JSON.parse(text.slice(start, end + 1));
}
