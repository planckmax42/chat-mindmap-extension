/**
 * App.tsx — SidePanel 根组件
 * 负责从 chrome.storage.local 读取问题列表，并监听实时更新。
 */

import React, { useEffect, useState } from 'react';
import type { QuestionRecord, MessageType } from '../types';
import Timeline from './components/Timeline';

const App: React.FC = () => {
  const [questions, setQuestions] = useState<QuestionRecord[]>([]);

  // 从 storage 加载问题列表
  const loadQuestions = () => {
    chrome.storage.local.get('questions', (result) => {
      const qs: QuestionRecord[] = result.questions ?? [];
      setQuestions(qs);
    });
  };

  useEffect(() => {
    // 首次挂载时加载
    loadQuestions();

    // 监听 storage 变化，实时刷新列表
    const handleStorageChange = (
      changes: { [key: string]: chrome.storage.StorageChange },
    ) => {
      if ('questions' in changes) {
        const newQuestions: QuestionRecord[] = changes.questions.newValue ?? [];
        setQuestions(newQuestions);
      }
    };

    chrome.storage.onChanged.addListener(handleStorageChange);

    return () => {
      chrome.storage.onChanged.removeListener(handleStorageChange);
    };
  }, []);

  // 点击"清空"按钮
  const handleClear = () => {
    const msg: MessageType = { type: 'CLEAR_QUESTIONS' };
    chrome.runtime.sendMessage(msg).catch(() => {});
    setQuestions([]);
  };

  // 第一条问题（原始问题）
  const firstQuestion = questions[0] ?? null;

  return (
    <div className="flex flex-col h-screen bg-gray-900 text-gray-100">
      {/* 顶部固定栏 */}
      <header className="flex items-center justify-between px-4 py-3 bg-gray-950 border-b border-gray-700 flex-shrink-0">
        <h1 className="text-base font-semibold">💭 提问路线</h1>
        <button
          onClick={handleClear}
          className="text-sm text-gray-400 hover:text-red-400 transition-colors"
        >
          清空
        </button>
      </header>

      {/* 中间滚动区域 */}
      <main className="flex-1 overflow-y-auto px-3 py-3">
        {questions.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-500 text-sm text-center px-4">
            去 ChatGPT / Claude / DeepSeek / Copilot 开始聊天吧～
          </div>
        ) : (
          <Timeline questions={questions} />
        )}
      </main>

      {/* 底部原始问题固定区域 */}
      {firstQuestion && (
        <footer className="px-4 py-3 bg-gray-950 border-t border-gray-700 flex-shrink-0">
          <p className="text-xs text-yellow-400 truncate">
            🏁 原始问题：{firstQuestion.text}
          </p>
        </footer>
      )}
    </div>
  );
};

export default App;
