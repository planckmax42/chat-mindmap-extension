/**
 * Background Service Worker
 * 负责接收来自 content script 的消息，并管理 chrome.storage.local 中的问题记录。
 */

import type { MessageType, StorageData } from '../types';

// storage 中最多保留的问题数量
const MAX_QUESTIONS = 50;

// 读取 storage 中的 questions
async function loadQuestions() {
  const result = await chrome.storage.local.get<StorageData>('questions');
  return result.questions ?? [];
}

// 将 questions 写入 storage
async function saveQuestions(questions: StorageData['questions']) {
  await chrome.storage.local.set({ questions });
}

// 监听来自 content script / sidepanel 的消息
chrome.runtime.onMessage.addListener(
  (message: MessageType, _sender, sendResponse) => {
    // 必须返回 true 才能让 sendResponse 在异步操作后仍然有效
    (async () => {
      switch (message.type) {
        case 'ADD_QUESTION': {
          const questions = await loadQuestions();
          questions.push(message.payload);
          // 超出上限时删除最旧的记录
          const trimmed =
            questions.length > MAX_QUESTIONS
              ? questions.slice(questions.length - MAX_QUESTIONS)
              : questions;
          await saveQuestions(trimmed);
          sendResponse({ ok: true });
          break;
        }

        case 'CLEAR_QUESTIONS': {
          await saveQuestions([]);
          sendResponse({ ok: true });
          break;
        }

        case 'GET_QUESTIONS': {
          const questions = await loadQuestions();
          sendResponse({ questions });
          break;
        }

        default:
          sendResponse({ ok: false, error: 'Unknown message type' });
      }
    })();

    return true; // 保持消息通道开放，等待异步 sendResponse
  },
);
