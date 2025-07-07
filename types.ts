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
}