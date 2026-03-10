import React, { useMemo } from 'react';
import type { QuestionRecord } from '../../types';
import QuestionCard from './QuestionCard';

interface Props {
  questions: QuestionRecord[];
  onJump: (record: QuestionRecord) => void;
}

const Timeline: React.FC<Props> = ({ questions, onJump }) => {
  const flatTree = useMemo(() => {
    const children = new Map<string | null, QuestionRecord[]>();
    questions.forEach((q) => {
      const list = children.get(q.parentId) ?? [];
      list.push(q);
      children.set(q.parentId, list);
    });

    const result: Array<{ q: QuestionRecord; depth: number }> = [];
    const walk = (parentId: string | null, depth: number) => {
      const list = children.get(parentId) ?? [];
      list.forEach((item) => {
        result.push({ q: item, depth });
        walk(item.id, depth + 1);
      });
    };

    walk(null, 0);
    return result;
  }, [questions]);

  const currentId = questions[questions.length - 1]?.id;

  return (
    <div className="py-2">
      {flatTree.map(({ q, depth }) => (
        <QuestionCard key={q.id} record={q} depth={depth} isCurrent={q.id === currentId} onJump={onJump} />
      ))}
    </div>
  );
};

export default Timeline;
