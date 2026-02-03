export interface ModelOption {
  id: string;
  name: string;
}

export interface ModelGroup {
  label: string;
  models: ModelOption[];
}

export const MODEL_GROUPS: ModelGroup[] = [
  {
    label: 'BuiltIn',
    models: [
      { id: 'memcool:gemini-2.5-flash-lite', name: 'Gemini 2.5 Flash Lite' },
      { id: 'memcool:gemini-2.5-flash', name: 'Gemini 2.5 Flash' },
    ],
  },
  {
    label: 'OpenRouter',
    models: [
      { id: 'openrouter:openai/gpt-oss-120b', name: 'GPT OSS 120B' },
      { id: 'openrouter:google/gemini-2.0-flash-001', name: 'Gemini 2.0 Flash' },
      { id: 'openrouter:google/gemini-2.5-flash-lite', name: 'Gemini 2.5 Flash Lite' },
      { id: 'openrouter:x-ai/grok-4.1-fast', name: 'Grok 4.1 Fast' },
      { id: 'openrouter:deepseek/deepseek-v3.2', name: 'DeepSeek V3.2' },
      { id: 'openrouter:x-ai/grok-code-fast-1', name: 'Grok Code Fast' },
    ],
  },
  {
    label: 'Gemini',
    models: [
      { id: 'gemini:gemini-2.5-flash', name: 'Gemini 2.5 Flash' },
      { id: 'gemini:gemini-2.0-flash', name: 'Gemini 2.0 Flash' },
      { id: 'gemini:gemini-2.0-flash-lite', name: 'Gemini 2.0 Flash Lite' },
      { id: 'gemini:gemini-1.5-flash', name: 'Gemini 1.5 Flash' },
    ],
  },
];

export const ALL_MODELS = MODEL_GROUPS.flatMap((group) => group.models);
