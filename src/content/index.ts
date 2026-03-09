/**
 * Content Script
 * 注入到 ChatGPT / Claude / DeepSeek / GitHub Copilot Chat 页面，监听用户消息并上报给 background。
 */

import { nanoid } from 'nanoid';
import type { QuestionRecord, MessageType } from '../types';

// ---------- 平台判断 ----------

type Platform = QuestionRecord['platform'];

function detectPlatform(urlStr: string): Platform {
  try {
    const { hostname, pathname } = new URL(urlStr);
    if (hostname === 'chatgpt.com' || hostname.endsWith('.chatgpt.com')) return 'chatgpt';
    if (hostname === 'claude.ai' || hostname.endsWith('.claude.ai')) return 'claude';
    if (hostname === 'chat.deepseek.com' || hostname.endsWith('.chat.deepseek.com')) return 'deepseek';
    // 仅在 github.com 的 /copilot 路径下才识别为 copilot，避免其他页面误抓
    if ((hostname === 'github.com' || hostname.endsWith('.github.com')) && (pathname === '/copilot' || pathname.startsWith('/copilot/'))) return 'copilot';
  } catch {
    // URL 解析失败时忽略
  }
  return 'unknown';
}

// 根据平台返回用户消息选择器列表（按优先级排序）
function getSelectors(platform: Platform): string[] {
  switch (platform) {
    case 'chatgpt':
      return ['[data-message-author-role="user"]'];
    case 'claude':
      return ['[data-testid="human-message"]', '.human-turn'];
    case 'deepseek':
      return ['[class*="user-message"]'];
    // GitHub Copilot Chat 网页版用户消息选择器（优先尝试 ChatMessage，备选 UserMessage）
    case 'copilot':
      return [
        'div[class*="ChatMessage-module__userMessage"]',
        'div[class*="UserMessage-module__container"]',
      ];
    default:
      return [];
  }
}

// ---------- 状态 ----------

let currentUrl = location.href;
let platform: Platform = detectPlatform(currentUrl);
// 记录已发送过的消息文本，避免重复上报
let sentTexts = new Set<string>();
let observer: MutationObserver | null = null;

// ---------- 消息发送 ----------

function sendAddQuestion(text: string): void {
  const record: QuestionRecord = {
    id: nanoid(),
    text,
    timestamp: Date.now(),
    pageUrl: location.href,
    platform,
  };
  const msg: MessageType = { type: 'ADD_QUESTION', payload: record };
  chrome.runtime.sendMessage(msg).catch(() => {
    // background 未就绪时忽略错误
  });
}

function sendClearQuestions(): void {
  const msg: MessageType = { type: 'CLEAR_QUESTIONS' };
  chrome.runtime.sendMessage(msg).catch(() => {});
}

// ---------- DOM 扫描 ----------

function scanMessages(): void {
  const selectors = getSelectors(platform);
  if (selectors.length === 0) return;

  // 找到第一个有匹配元素的选择器
  let elements: NodeListOf<Element> | null = null;
  for (const selector of selectors) {
    const found = document.querySelectorAll(selector);
    if (found.length > 0) {
      elements = found;
      break;
    }
  }

  if (!elements) {
    console.warn('[Chat MindMap] 未找到用户消息元素，选择器：', selectors);
    return;
  }

  elements.forEach((el) => {
    const text = el.textContent?.trim();
    if (text && !sentTexts.has(text)) {
      sentTexts.add(text);
      sendAddQuestion(text);
    }
  });
}

// ---------- MutationObserver ----------

function startObserver(): void {
  if (observer) {
    observer.disconnect();
  }

  observer = new MutationObserver(() => {
    scanMessages();
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });

  // 初始扫描（页面已有内容）
  scanMessages();
}

// ---------- SPA 路由监听 ----------

function handleUrlChange(): void {
  const newUrl = location.href;
  if (newUrl !== currentUrl) {
    currentUrl = newUrl;
    platform = detectPlatform(currentUrl);
    sentTexts = new Set<string>();
    sendClearQuestions();
    // 重新启动 observer
    startObserver();
  }
}

// 监听 pushState / replaceState
const originalPushState = history.pushState.bind(history);
const originalReplaceState = history.replaceState.bind(history);

history.pushState = function (...args) {
  originalPushState(...args);
  handleUrlChange();
};

history.replaceState = function (...args) {
  originalReplaceState(...args);
  handleUrlChange();
};

window.addEventListener('popstate', handleUrlChange);

// ---------- 启动 ----------

startObserver();
