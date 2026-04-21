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
  status?: string;
  webSources?: WebSource[];
};

export type ReasoningEffort = 'low' | 'medium' | 'high';

export type Settings = {
  apiKey: string;
  suggestionModel: string;
  chatModel: string;
  ledgerModel: string;
  scoutModel: string;
  transcriptionModel: string;
  suggestionPrompt: string;
  detailPrompt: string;
  chatPrompt: string;
  ledgerPrompt: string;
  webQueryPrompt: string;
  suggestionContextChars: number;
  detailContextChars: number;
  refreshIntervalSec: number;
  chunkSeconds: number;
  ledgerUpdateChunks: number;
  densityThreshold: number;
  recentWindowSeconds: number;
  recentlySaidSeconds: number;
  enableWebSearch: boolean;
  suggestionReasoningEffort: ReasoningEffort;
  detailReasoningEffort: ReasoningEffort;
};

export type Toast = {
  id: string;
  message: string;
  kind: 'info' | 'error' | 'success';
};

export type WebSource = {
  title: string;
  url: string;
  snippet: string;
};

export type LedgerState = {
  entities: string[];
  facts: string[];
  decisions: string[];
  open_questions: string[];
};

export type DensitySignal = {
  score: number;
  newEntities: string[];
  hasQuestion: boolean;
  hasNumber: boolean;
};
