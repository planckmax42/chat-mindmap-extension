// 用户提问记录
export interface QuestionRecord {
  id: string;
  text: string;
  timestamp: number;
  pageUrl: string;
  platform: 'chatgpt' | 'claude' | 'deepseek' | 'unknown';
}

// storage 中存储的数据结构
export interface StorageData {
  questions: QuestionRecord[];
}

// 插件内部消息类型
export type MessageType =
  | { type: 'ADD_QUESTION'; payload: QuestionRecord }
  | { type: 'CLEAR_QUESTIONS' }
  | { type: 'GET_QUESTIONS' };
