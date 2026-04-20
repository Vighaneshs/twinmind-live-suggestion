export type TranscriptChunk = {
  id: string;
  text: string;
  startedAt: number;
  endedAt: number;
};

export type SuggestionType =
  | 'question'
  | 'talking_point'
  | 'answer'
  | 'fact_check'
  | 'clarification';

export type Suggestion = {
  id: string;
  type: SuggestionType;
  title: string;
  preview: string;
};

export type SuggestionBatch = {
  id: string;
  createdAt: number;
  suggestions: Suggestion[];
};

export type ChatRole = 'user' | 'assistant';

export type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
  createdAt: number;
  sourceSuggestionId?: string;
  streaming?: boolean;
};

export type Settings = {
  apiKey: string;
  suggestionModel: string;
  chatModel: string;
  transcriptionModel: string;
  suggestionPrompt: string;
  detailPrompt: string;
  chatPrompt: string;
  suggestionContextChars: number;
  detailContextChars: number;
  refreshIntervalSec: number;
  chunkSeconds: number;
};

export type Toast = {
  id: string;
  message: string;
  kind: 'info' | 'error' | 'success';
};
