export interface PromptSegmentData {
  valeur: string;
  alternatives: string[];
}

export type PromptPartKey = string;

export type PromptData = Record<PromptPartKey, PromptSegmentData>;

export interface ApiConfig {
  apiKey: string;
  model: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  promptData?: PromptData;
  imagePreviewUrl?: string; // For UI display of user's image
}

export interface OpenRouterModel {
  id: string;
  name: string;
  description: string;
  pricing: {
    prompt: string;
    completion: string;
    output?: string;
    request: string;
    image: string;
  };
  context_length: number;
}