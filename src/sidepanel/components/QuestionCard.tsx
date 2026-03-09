/**
 * QuestionCard.tsx
 * 单条提问记录卡片，支持展开/收起文本。
 */

import React, { useState } from 'react';
import type { QuestionRecord } from '../../types';

interface Props {
  record: QuestionRecord;
  index: number;
  isFirst: boolean;
  isLast: boolean;
}

// 各平台对应的 emoji
const PLATFORM_EMOJI: Record<QuestionRecord['platform'], string> = {
  chatgpt: '🤖',
  claude: '🟠',
  deepseek: '🔵',
  unknown: '❓',
};

// 将 timestamp 格式化为 HH:mm:ss
function formatTime(timestamp: number): string {
  const d = new Date(timestamp);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

const QuestionCard: React.FC<Props> = ({ record, index, isFirst, isLast }) => {
  const [expanded, setExpanded] = useState(false);

  // 根据 isFirst / isLast 决定左边框颜色
  const borderColor = isFirst
    ? 'border-yellow-400'
    : isLast
    ? 'border-blue-400'
    : 'border-gray-600';

  return (
    <div
      className={`relative bg-gray-800 rounded-lg shadow-md p-3 border-l-4 ${borderColor} cursor-pointer select-none`}
      onClick={() => setExpanded((prev) => !prev)}
    >
      {/* 右上角徽章 */}
      {isFirst && (
        <span className="absolute top-2 right-2 text-xs text-yellow-400 font-medium">
          🏁 原始
        </span>
      )}
      {isLast && !isFirst && (
        <span className="absolute top-2 right-2 text-xs text-blue-400 font-medium">
          📍 当前
        </span>
      )}

      {/* 序号 + 平台 */}
      <div className="flex items-center gap-1 mb-1">
        <span className="text-xs text-gray-400">第 {index + 1} 问</span>
        <span className="text-xs">{PLATFORM_EMOJI[record.platform]}</span>
      </div>

      {/* 问题文字 */}
      <p
        className={`text-sm text-gray-100 break-words ${
          expanded ? '' : 'line-clamp-2'
        }`}
      >
        {record.text}
      </p>

      {/* 时间戳 */}
      <p className="text-xs text-gray-500 mt-1">{formatTime(record.timestamp)}</p>
    </div>
  );
};

export default QuestionCard;
