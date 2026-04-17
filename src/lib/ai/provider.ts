// AI Provider Abstraction Layer

export interface AiMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AiResponse {
  content: string;
  usage?: { inputTokens: number; outputTokens: number };
}

export interface AiProviderConfig {
  providerType: 'hosted_api' | 'lm_studio' | 'ollama';
  endpointUrl: string | null;
  modelName: string | null;
  apiKey: string | null;
}

const DEFAULT_ENDPOINTS: Record<string, string> = {
  hosted_api: 'https://api.openai.com/v1',
  lm_studio: 'http://localhost:1234/v1',
  ollama: 'http://localhost:11434',
};

function getEndpoint(config: AiProviderConfig): string {
  let url = config.endpointUrl || DEFAULT_ENDPOINTS[config.providerType] || DEFAULT_ENDPOINTS.hosted_api;
  url = url.replace(/\/+$/, '');
  // Ensure LM Studio endpoints always include /v1
  if (config.providerType === 'lm_studio' && !url.endsWith('/v1')) url += '/v1';
  return url;
}

export async function callAi(
  config: AiProviderConfig,
  messages: AiMessage[],
  options?: { maxTokens?: number; temperature?: number }
): Promise<AiResponse> {
  const model = config.modelName || 'gpt-3.5-turbo';

  if (config.providerType === 'ollama') {
    const endpoint = getEndpoint(config);
    const res = await fetch(`${endpoint}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, messages, stream: false, options: { num_predict: options?.maxTokens, temperature: options?.temperature } }),
    });
    if (!res.ok) throw new Error(`Ollama error: ${res.status} ${await res.text()}`);
    const data = await res.json();
    return { content: data.message?.content || '', usage: data.prompt_eval_count != null ? { inputTokens: data.prompt_eval_count, outputTokens: data.eval_count || 0 } : undefined };
  }

  // OpenAI-compatible (hosted_api and lm_studio)
  const endpoint = getEndpoint(config);
  const url = config.providerType === 'lm_studio' ? `${endpoint}/chat/completions` : `${endpoint}/chat/completions`;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (config.apiKey) headers['Authorization'] = `Bearer ${config.apiKey}`;

  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({ model, messages, max_tokens: options?.maxTokens, temperature: options?.temperature }),
  });
  if (!res.ok) throw new Error(`API error: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return {
    content: data.choices?.[0]?.message?.content || '',
    usage: data.usage ? { inputTokens: data.usage.prompt_tokens, outputTokens: data.usage.completion_tokens } : undefined,
  };
}

export async function testConnection(config: AiProviderConfig): Promise<{ success: boolean; message: string; models?: string[] }> {
  try {
    if (config.providerType === 'ollama') {
      const endpoint = getEndpoint(config);
      const res = await fetch(`${endpoint}/api/tags`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const models = (data.models || []).map((m: { name: string }) => m.name);
      return { success: true, message: `Connected — ${models.length} model(s) found`, models };
    }

    if (config.providerType === 'lm_studio') {
      const endpoint = getEndpoint(config);
      const res = await fetch(`${endpoint}/models`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const models = (data.data || []).map((m: { id: string }) => m.id);
      return { success: true, message: `Connected — ${models.length} model(s) found`, models };
    }

    // hosted_api — try listing models
    const endpoint = getEndpoint(config);
    const headers: Record<string, string> = {};
    if (config.apiKey) headers['Authorization'] = `Bearer ${config.apiKey}`;
    const res = await fetch(`${endpoint}/models`, { headers });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const models = (data.data || []).map((m: { id: string }) => m.id);
    return { success: true, message: `Connected — ${models.length} model(s) found`, models };
  } catch (e: any) {
    return { success: false, message: e.message || 'Connection failed' };
  }
}

export async function detectModels(providerType: string, endpointUrl?: string | null): Promise<string[]> {
  let url = (endpointUrl || DEFAULT_ENDPOINTS[providerType] || '').replace(/\/+$/, '');

  if (providerType === 'ollama') {
    const res = await fetch(`${url}/api/tags`);
    if (!res.ok) return [];
    const data = await res.json();
    return (data.models || []).map((m: { name: string }) => m.name);
  }

  // OpenAI-compatible (hosted_api and lm_studio)
  if (providerType === 'lm_studio' && !url.endsWith('/v1')) url += '/v1';
  const res = await fetch(`${url}/models`);
  if (!res.ok) return [];
  const data = await res.json();
  return (data.data || []).map((m: { id: string }) => m.id);
}
