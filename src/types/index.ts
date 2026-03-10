export type Platform =
  | 'chatgpt'
  | 'claude'
  | 'deepseek'
  | 'copilot'
  | 'gemini'
  | 'unknown';

export type RelationType = 'root' | 'deepen' | 'branch' | 'topic_shift';

export interface QuestionRecord {
  id: string;
  text: string;
  shortTitle?: string;
  timestamp: number;
  pageUrl: string;
  platform: Platform;
  relation: RelationType;
  parentId: string | null;
  deviationWarning?: string;
  domSelector?: string;
}

export interface ConversationRoute {
  id: string;
  title: string;
  platform: Platform;
  pageUrl: string;
  createdAt: number;
  updatedAt: number;
  questions: QuestionRecord[];
}

export interface LLMSettings {
  endpoint: string;
  apiKey: string;
  model: string;
  enabled: boolean;
}

export interface StorageData {
  activeConversationId?: string;
  conversations?: Record<string, ConversationRoute>;
  llmSettings?: LLMSettings;
}

export type MessageType =
  | {
      type: 'ADD_QUESTION';
      payload: {
        text: string;
        pageUrl: string;
        platform: Platform;
        domSelector?: string;
      };
    }
  | { type: 'SET_ACTIVE_CONVERSATION'; payload: { pageUrl: string; platform: Platform } }
  | { type: 'CLEAR_ACTIVE_CONVERSATION' }
  | { type: 'GET_ACTIVE_CONVERSATION' }
  | { type: 'JUMP_TO_QUESTION'; payload: { questionId: string; pageUrl?: string; domSelector?: string } }
  | { type: 'SAVE_LLM_SETTINGS'; payload: LLMSettings };
