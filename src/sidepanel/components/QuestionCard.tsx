import React from 'react';
import type { QuestionRecord } from '../../types';

interface Props {
  record: QuestionRecord;
  depth: number;
  isCurrent: boolean;
  onJump: (id: string) => void;
}

const RELATION_STYLE: Record<QuestionRecord['relation'], string> = {
  root: 'border-yellow-400',
  deepen: 'border-blue-400',
  branch: 'border-purple-400',
  topic_shift: 'border-red-400',
};

const RELATION_TEXT: Record<QuestionRecord['relation'], string> = {
  root: '根问题',
  deepen: '深入追问',
  branch: '同主题分支',
  topic_shift: '话题跳转',
};

const QuestionCard: React.FC<Props> = ({ record, depth, isCurrent, onJump }) => {
  return (
    <div style={{ marginLeft: `${depth * 14}px` }} className="mb-2">
      <div className={`rounded-md border-l-4 ${RELATION_STYLE[record.relation]} bg-gray-800 p-2`}>
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-gray-400">{RELATION_TEXT[record.relation]}</p>
          {isCurrent && <span className="text-[10px] text-blue-300">当前</span>}
        </div>
        <p className="text-sm text-gray-100">{record.shortTitle ?? record.text}</p>
        {record.deviationWarning && <p className="text-xs text-red-300 mt-1">{record.deviationWarning}</p>}
        <button className="mt-2 text-xs text-cyan-300 hover:text-cyan-200" onClick={() => onJump(record.id)}>
          跳转到对话位置
        </button>
      </div>
    </div>
  );
};

export default QuestionCard;
