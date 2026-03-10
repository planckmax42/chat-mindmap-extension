/**
 * Content Script
 * 监听主流 AI 聊天网站中的用户消息，实时发送给 background。
 */

import type { MessageType, Platform } from '../types';

function detectPlatform(urlStr: string): Platform {
  try {
    const { hostname, pathname } = new URL(urlStr);
    if (hostname === 'chatgpt.com' || hostname.endsWith('.chatgpt.com')) return 'chatgpt';
    if (hostname === 'claude.ai' || hostname.endsWith('.claude.ai')) return 'claude';
    if (hostname === 'chat.deepseek.com' || hostname.endsWith('.chat.deepseek.com')) return 'deepseek';
    if (hostname === 'gemini.google.com' || hostname.endsWith('.gemini.google.com')) return 'gemini';
    if ((hostname === 'github.com' || hostname.endsWith('.github.com')) && (pathname === '/copilot' || pathname.startsWith('/copilot/'))) return 'copilot';
  } catch {
    // ignore
  }
  return 'unknown';
}

function getSelectors(platform: Platform): string[] {
  switch (platform) {
    case 'chatgpt':
      return ['[data-message-author-role="user"] .whitespace-pre-wrap', '[data-message-author-role="user"]'];
    case 'claude':
      return ['[data-testid="human-message"]', '.human-turn'];
    case 'deepseek':
      return ['[class*="user-message"]', '[class*="UserMessage"]'];
    case 'gemini':
      return ['user-query .query-text', 'user-query p', '.query-text'];
    case 'copilot':
      return ['div[class*="ChatMessage-module__userMessage"]', 'div[class*="UserMessage-module__container"]'];
    default:
      return [];
  }
}

function elementSelector(el: Element): string | undefined {
  const id = el.getAttribute('id');
  if (id) return `#${CSS.escape(id)}`;
  if (el.hasAttribute('data-testid')) {
    const testId = el.getAttribute('data-testid');
    if (testId) return `[data-testid="${CSS.escape(testId)}"]`;
  }
  if (el.classList.length > 0) {
    const className = [...el.classList].slice(0, 2).map((c) => `.${CSS.escape(c)}`).join('');
    if (className) return `${el.tagName.toLowerCase()}${className}`;
  }
  return el.tagName.toLowerCase();
}

let currentUrl = location.href;
let platform: Platform = detectPlatform(currentUrl);
let observer: MutationObserver | null = null;
let sentHash = new Set<string>();

function conversationContext(): void {
  const msg: MessageType = {
    type: 'SET_ACTIVE_CONVERSATION',
    payload: { pageUrl: location.href, platform },
  };
  chrome.runtime.sendMessage(msg).catch(() => {});
}

async function sendQuestion(el: Element, text: string): Promise<void> {
  const domSelector = elementSelector(el);
  const payload: MessageType = {
    type: 'ADD_QUESTION',
    payload: {
      text,
      pageUrl: location.href,
      platform,
      domSelector,
    },
  };
  chrome.runtime.sendMessage(payload).then((resp: { questionId?: string } | undefined) => {
    if (resp?.questionId) {
      el.setAttribute('data-cm-qid', resp.questionId);
    }
  }).catch(() => {});
}

function scanMessages(): void {
  const selectors = getSelectors(platform);
  for (const selector of selectors) {
    const elements = document.querySelectorAll(selector);
    if (!elements.length) continue;

    elements.forEach((el, index) => {
      const text = el.textContent?.trim();
      if (!text) return;
      const hash = `${selector}:${index}:${text}`;
      if (sentHash.has(hash)) return;
      sentHash.add(hash);
      void sendQuestion(el, text);
    });

    return;
  }
}

function startObserver(): void {
  observer?.disconnect();
  observer = new MutationObserver(() => scanMessages());
  observer.observe(document.body, { childList: true, subtree: true });
  scanMessages();
}

function handleUrlChange(): void {
  const newUrl = location.href;
  if (newUrl === currentUrl) return;
  currentUrl = newUrl;
  platform = detectPlatform(newUrl);
  sentHash = new Set<string>();
  conversationContext();
  startObserver();
}

chrome.runtime.onMessage.addListener((message: MessageType) => {
  if (message.type !== 'JUMP_TO_QUESTION') return;
  const target =
    document.querySelector(`[data-cm-qid="${message.payload.questionId}"]`) ??
    (message.payload.domSelector ? document.querySelector(message.payload.domSelector) : null);
  if (target instanceof HTMLElement) {
    target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    target.classList.add('cm-q-highlight');
    setTimeout(() => target.classList.remove('cm-q-highlight'), 1200);
  }
});

const style = document.createElement('style');
style.textContent = `
  .cm-q-highlight { outline: 2px solid #60a5fa !important; border-radius: 8px; transition: outline 0.2s ease; }
`;
document.documentElement.appendChild(style);

const oldPush = history.pushState.bind(history);
const oldReplace = history.replaceState.bind(history);
history.pushState = function (...args) {
  oldPush(...args);
  handleUrlChange();
};
history.replaceState = function (...args) {
  oldReplace(...args);
  handleUrlChange();
};
window.addEventListener('popstate', handleUrlChange);

conversationContext();
startObserver();
