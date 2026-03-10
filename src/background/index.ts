import { nanoid } from 'nanoid';
import type {
  ConversationRoute,
  LLMSettings,
  MessageType,
  Platform,
  QuestionRecord,
  RelationType,
  StorageData,
} from '../types';

chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(console.error);

const MAX_QUESTIONS_PER_CONVERSATION = 120;
const MAX_CONVERSATIONS = 30;

const DEFAULT_LLM_SETTINGS: LLMSettings = {
  endpoint: 'https://api.openai.com/v1/chat/completions',
  apiKey: '',
  model: 'gpt-4o-mini',
  enabled: false,
};

function getConversationId(platform: Platform, pageUrl: string): string {
  try {
    const url = new URL(pageUrl);
    const pathKey = url.pathname.split('/').filter(Boolean).slice(0, 3).join('/');
    return `${platform}:${pathKey || 'root'}`;
  } catch {
    return `${platform}:unknown`;
  }
}

async function loadStorage(): Promise<Required<StorageData>> {
  const result = await chrome.storage.local.get(['activeConversationId', 'conversations', 'llmSettings']);
  return {
    activeConversationId: result.activeConversationId,
    conversations: result.conversations ?? {},
    llmSettings: result.llmSettings ?? DEFAULT_LLM_SETTINGS,
  };
}

async function saveStorage(data: Partial<StorageData>): Promise<void> {
  await chrome.storage.local.set(data);
}

function keywords(text: string): string[] {
  return text.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter((w) => w.length > 1).slice(0, 12);
}

function similarity(a: string, b: string): number {
  const ka = new Set(keywords(a));
  const kb = new Set(keywords(b));
  if (ka.size === 0 || kb.size === 0) return 0;
  let hit = 0;
  ka.forEach((k) => kb.has(k) && hit++);
  return hit / Math.max(ka.size, kb.size);
}

function relationFor(newText: string, prev?: QuestionRecord): RelationType {
  if (!prev) return 'root';
  const overlap = similarity(newText, prev.text);
  const askMore = /为什么|怎么|细节|举例|对比|实现|why|how|detail|example|compare/i.test(newText);
  if (overlap > 0.6 || askMore) return 'deepen';
  if (overlap > 0.25) return 'branch';
  return 'topic_shift';
}

function titleFromText(text: string): string {
  const normalized = text.replace(/\s+/g, ' ').trim();
  return normalized.length <= 28 ? normalized : `${normalized.slice(0, 28)}...`;
}

async function llmTitle(text: string, settings: LLMSettings): Promise<string | null> {
  if (!settings.enabled || !settings.apiKey || !settings.endpoint) return null;

  try {
    const response = await fetch(settings.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${settings.apiKey}`,
      },
      body: JSON.stringify({
        model: settings.model,
        messages: [
          { role: 'system', content: '你是标题助手。请将用户问题浓缩成不超过14个字中文标题，仅输出标题。' },
          { role: 'user', content: text },
        ],
        temperature: 0.2,
      }),
    });
    if (!response.ok) return null;
    const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
    const content = data.choices?.[0]?.message?.content?.trim();
    return content ? content.slice(0, 20) : null;
  } catch {
    return null;
  }
}

function trimConversations(conversations: Record<string, ConversationRoute>) {
  const ids = Object.values(conversations)
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .map((c) => c.id);

  ids.slice(MAX_CONVERSATIONS).forEach((id) => {
    delete conversations[id];
  });
}

chrome.runtime.onMessage.addListener((message: MessageType, _sender, sendResponse) => {
  (async () => {
    const storage = await loadStorage();

    switch (message.type) {
      case 'SET_ACTIVE_CONVERSATION': {
        const id = getConversationId(message.payload.platform, message.payload.pageUrl);
        const now = Date.now();
        if (!storage.conversations[id]) {
          storage.conversations[id] = {
            id,
            title: '新会话',
            platform: message.payload.platform,
            pageUrl: message.payload.pageUrl,
            createdAt: now,
            updatedAt: now,
            questions: [],
          };
        }
        storage.activeConversationId = id;
        storage.conversations[id].updatedAt = now;
        await saveStorage({ conversations: storage.conversations, activeConversationId: id });
        sendResponse({ ok: true, conversationId: id });
        break;
      }

      case 'ADD_QUESTION': {
        const conversationId = storage.activeConversationId ?? getConversationId(message.payload.platform, message.payload.pageUrl);
        const now = Date.now();
        const conversation =
          storage.conversations[conversationId] ??
          {
            id: conversationId,
            title: '新会话',
            platform: message.payload.platform,
            pageUrl: message.payload.pageUrl,
            createdAt: now,
            updatedAt: now,
            questions: [],
          };

        const prev = conversation.questions[conversation.questions.length - 1];
        const relation = relationFor(message.payload.text, prev);
        const deviationWarning =
          relation === 'topic_shift' && conversation.questions.length > 0
            ? '该问题可能偏离初始目标'
            : undefined;

        const shortTitle = (await llmTitle(message.payload.text, storage.llmSettings)) ?? titleFromText(message.payload.text);
        const question: QuestionRecord = {
          id: nanoid(),
          text: message.payload.text,
          shortTitle,
          timestamp: now,
          pageUrl: message.payload.pageUrl,
          platform: message.payload.platform,
          relation,
          parentId: prev ? (relation === 'topic_shift' ? conversation.questions[0]?.id ?? null : prev.id) : null,
          deviationWarning,
          domSelector: message.payload.domSelector,
        };

        const last = prev?.text;
        if (last === question.text) {
          sendResponse({ ok: true, deduped: true, questionId: prev.id });
          return;
        }

        conversation.questions.push(question);
        if (conversation.questions.length > MAX_QUESTIONS_PER_CONVERSATION) {
          conversation.questions = conversation.questions.slice(-MAX_QUESTIONS_PER_CONVERSATION);
        }

        if (conversation.questions.length === 1) {
          conversation.title = shortTitle;
        }

        conversation.updatedAt = now;
        storage.conversations[conversationId] = conversation;
        storage.activeConversationId = conversationId;
        trimConversations(storage.conversations);

        await saveStorage({ conversations: storage.conversations, activeConversationId: conversationId });
        sendResponse({ ok: true, questionId: question.id });
        break;
      }

      case 'CLEAR_ACTIVE_CONVERSATION': {
        if (storage.activeConversationId && storage.conversations[storage.activeConversationId]) {
          storage.conversations[storage.activeConversationId].questions = [];
          storage.conversations[storage.activeConversationId].updatedAt = Date.now();
        }
        await saveStorage({ conversations: storage.conversations });
        sendResponse({ ok: true });
        break;
      }

      case 'GET_ACTIVE_CONVERSATION': {
        const conversation =
          (storage.activeConversationId && storage.conversations[storage.activeConversationId]) ||
          Object.values(storage.conversations).sort((a, b) => b.updatedAt - a.updatedAt)[0] ||
          null;
        sendResponse({ conversation, conversations: Object.values(storage.conversations), llmSettings: storage.llmSettings });
        break;
      }

      case 'SYNC_ACTIVE_TAB': {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab?.id) {
          const sent = await chrome.tabs.sendMessage(tab.id, { type: 'FORCE_SCAN' } as MessageType)
            .then(() => true)
            .catch(() => false);

          if (!sent && tab.url) {
            await chrome.scripting.executeScript({
              target: { tabId: tab.id },
              files: ['content/index.js'],
            }).catch(() => {});
            await chrome.tabs.sendMessage(tab.id, { type: 'FORCE_SCAN' } as MessageType).catch(() => {});
          }
        }
        sendResponse({ ok: true });
        break;
      }

      case 'SAVE_LLM_SETTINGS': {
        await saveStorage({ llmSettings: message.payload });
        sendResponse({ ok: true });
        break;
      }

      case 'JUMP_TO_QUESTION': {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab?.id) {
          const tabUrl = tab.url ?? '';
          const targetUrl = message.payload.pageUrl;

          if (targetUrl && tabUrl !== targetUrl) {
            await chrome.tabs.update(tab.id, { url: targetUrl });
            chrome.tabs.onUpdated.addListener(function handleUpdated(updatedTabId, info) {
              if (updatedTabId !== tab.id || info.status !== 'complete') return;
              chrome.tabs.onUpdated.removeListener(handleUpdated);
              void chrome.tabs.sendMessage(tab.id as number, message).catch(() => {});
            });
          } else {
            await chrome.tabs.sendMessage(tab.id, message);
          }
        }
        sendResponse({ ok: true });
        break;
      }

      default:
        sendResponse({ ok: false });
    }
  })();

  return true;
});
