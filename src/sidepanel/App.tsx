import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { ConversationRoute, LLMSettings, MessageType } from '../types';
import Timeline from './components/Timeline';

const DEFAULT_SETTINGS: LLMSettings = {
  endpoint: 'https://api.openai.com/v1/chat/completions',
  apiKey: '',
  model: 'gpt-4o-mini',
  enabled: false,
};

function download(filename: string, content: BlobPart, mime = 'text/plain;charset=utf-8') {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function exportPng(conversation: ConversationRoute): void {
  const canvas = document.createElement('canvas');
  canvas.width = 900;
  canvas.height = Math.max(600, 80 + conversation.questions.length * 56);
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  ctx.fillStyle = '#111827';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#f9fafb';
  ctx.font = 'bold 24px sans-serif';
  ctx.fillText(`Chat MindMap - ${conversation.title}`, 24, 42);

  ctx.font = '16px sans-serif';
  conversation.questions.forEach((q, i) => {
    const y = 90 + i * 50;
    const prefix = q.relation === 'topic_shift' ? '↺' : q.relation === 'branch' ? '├' : q.relation === 'deepen' ? '↳' : '●';
    ctx.fillStyle = q.relation === 'topic_shift' ? '#fca5a5' : '#d1d5db';
    ctx.fillText(`${prefix} ${q.shortTitle ?? q.text.slice(0, 40)}`, 24, y);
  });

  canvas.toBlob((blob) => {
    if (!blob) return;
    download(`${conversation.id.replace(/[:/]/g, '_')}.png`, blob, 'image/png');
  }, 'image/png');
}

const App: React.FC = () => {
  const [active, setActive] = useState<ConversationRoute | null>(null);
  const [history, setHistory] = useState<ConversationRoute[]>([]);
  const [settings, setSettings] = useState<LLMSettings>(DEFAULT_SETTINGS);
  const [showSettings, setShowSettings] = useState(false);
  const apiKeyRef = useRef<HTMLInputElement>(null);

  const reload = () => {
    const msg: MessageType = { type: 'GET_ACTIVE_CONVERSATION' };
    chrome.runtime.sendMessage(msg).then((resp: { conversation: ConversationRoute | null; conversations: ConversationRoute[]; llmSettings?: LLMSettings }) => {
      setActive(resp.conversation);
      setHistory((resp.conversations ?? []).sort((a, b) => b.updatedAt - a.updatedAt));
      setSettings(resp.llmSettings ?? DEFAULT_SETTINGS);
    }).catch(() => {});
  };

  useEffect(() => {
    reload();
    const listener = (changes: { [key: string]: chrome.storage.StorageChange }) => {
      if (changes.conversations || changes.activeConversationId || changes.llmSettings) reload();
    };
    chrome.storage.onChanged.addListener(listener);
    return () => chrome.storage.onChanged.removeListener(listener);
  }, []);

  const warningCount = useMemo(() => active?.questions.filter((q) => q.deviationWarning).length ?? 0, [active]);

  const clearCurrent = () => {
    const msg: MessageType = { type: 'CLEAR_ACTIVE_CONVERSATION' };
    chrome.runtime.sendMessage(msg).then(() => reload()).catch(() => {});
  };

  const jumpTo = (questionId: string) => {
    const msg: MessageType = { type: 'JUMP_TO_QUESTION', payload: { questionId } };
    chrome.runtime.sendMessage(msg).catch(() => {});
  };

  const exportMarkdown = () => {
    if (!active) return;
    const content = [`# ${active.title}`, '', ...active.questions.map((q) => `- [${q.relation}] ${q.shortTitle ?? q.text}`)].join('\n');
    download(`${active.id.replace(/[:/]/g, '_')}.md`, content);
  };

  const saveSettings = () => {
    const msg: MessageType = {
      type: 'SAVE_LLM_SETTINGS',
      payload: {
        ...settings,
        apiKey: apiKeyRef.current?.value ?? settings.apiKey,
      },
    };
    chrome.runtime.sendMessage(msg).then(() => setShowSettings(false)).catch(() => {});
  };

  return (
    <div className="h-screen bg-gray-900 text-gray-100 flex flex-col">
      <header className="px-3 py-2 border-b border-gray-700 bg-gray-950 flex items-center justify-between">
        <div>
          <h1 className="text-sm font-semibold">💭 Chat MindMap</h1>
          <p className="text-[11px] text-gray-400">支持 ChatGPT / Claude / Gemini / DeepSeek / Copilot</p>
        </div>
        <button className="text-xs text-gray-300" onClick={() => setShowSettings((v) => !v)}>LLM设置</button>
      </header>

      {showSettings && (
        <div className="px-3 py-2 border-b border-gray-700 text-xs space-y-2">
          <label className="flex items-center gap-2"><input type="checkbox" checked={settings.enabled} onChange={(e) => setSettings((s) => ({ ...s, enabled: e.target.checked }))} />启用 LLM 标题提炼</label>
          <input className="w-full bg-gray-800 px-2 py-1 rounded" value={settings.endpoint} onChange={(e) => setSettings((s) => ({ ...s, endpoint: e.target.value }))} placeholder="API Endpoint" />
          <input className="w-full bg-gray-800 px-2 py-1 rounded" value={settings.model} onChange={(e) => setSettings((s) => ({ ...s, model: e.target.value }))} placeholder="Model" />
          <input ref={apiKeyRef} className="w-full bg-gray-800 px-2 py-1 rounded" defaultValue={settings.apiKey} placeholder="API Key" type="password" />
          <button className="text-cyan-300" onClick={saveSettings}>保存配置</button>
        </div>
      )}

      <main className="flex-1 overflow-y-auto p-3">
        {!active || active.questions.length === 0 ? (
          <p className="text-sm text-gray-500">开始聊天后会自动生成问题树和话题偏离提示。</p>
        ) : (
          <>
            <h2 className="text-sm font-medium mb-2">{active.title}</h2>
            {warningCount > 0 && <p className="text-xs text-red-300 mb-2">检测到 {warningCount} 次可能偏离原始问题</p>}
            <Timeline questions={active.questions} onJump={jumpTo} />
          </>
        )}
      </main>

      <footer className="border-t border-gray-700 p-2 bg-gray-950 space-y-2">
        <div className="flex gap-2 text-xs">
          <button className="text-gray-300" onClick={clearCurrent}>清空当前</button>
          <button className="text-gray-300" onClick={exportMarkdown} disabled={!active}>导出 Markdown</button>
          <button className="text-gray-300" onClick={() => active && exportPng(active)} disabled={!active}>导出 PNG</button>
        </div>
        <div>
          <p className="text-[11px] text-gray-400 mb-1">历史会话（本地存储）</p>
          <div className="max-h-20 overflow-y-auto space-y-1">
            {history.map((item) => (
              <div key={item.id} className="text-[11px] text-gray-300 truncate">• {item.title} ({item.questions.length})</div>
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
};

export default App;
