/**
 * Timeline.tsx
 * 垂直时间线，渲染所有 QuestionCard，并在列表末尾自动滚动。
 */

import React, { useEffect, useRef } from 'react';
import type { QuestionRecord } from '../../types';
import QuestionCard from './QuestionCard';

interface Props {
  questions: QuestionRecord[];
}

const Timeline: React.FC<Props> = ({ questions }) => {
  // 哨兵元素，用于滚动到底部
  const bottomRef = useRef<HTMLDivElement>(null);

  // 每次 questions 长度变化时，滚动到最新一条
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [questions.length]);

  return (
    <div className="flex flex-col gap-0">
      {questions.map((q, i) => (
        <React.Fragment key={q.id}>
          <QuestionCard
            record={q}
            index={i}
            isFirst={i === 0}
            isLast={i === questions.length - 1}
          />
          {/* 卡片之间的连接竖线（最后一条不需要） */}
          {i < questions.length - 1 && (
            <div className="flex justify-center">
              <div className="w-0.5 h-4 bg-gray-600" />
            </div>
          )}
        </React.Fragment>
      ))}
      {/* 哨兵元素，滚动定位用 */}
      <div ref={bottomRef} />
    </div>
  );
};

export default Timeline;
