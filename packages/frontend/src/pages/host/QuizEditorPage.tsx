import { useQuery, useMutation, useQueryClient, useIsMutating, keepPreviousData } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import { useState, useEffect, useRef, useCallback } from 'react';
import { GripVertical } from 'lucide-react';
import { api } from '../../lib/api';
import { QuestionType } from '@quiz/shared';
import type { QuizEntity, QuestionEntity, AnswerEntity } from '@quiz/shared';

type FullQuiz = QuizEntity & { questions: (QuestionEntity & { answers: AnswerEntity[] })[] };

const TIME_OPTIONS = [5, 10, 20, 30, 60];

function sortedAnswers<T extends { order: number; createdAt?: Date | string }>(answers: T[]): T[] {
  return [...answers].sort((a, b) => {
    if (a.order !== b.order) return a.order - b.order;
    return new Date(a.createdAt ?? 0).getTime() - new Date(b.createdAt ?? 0).getTime();
  });
}

export function QuizEditorPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [selectedQ, setSelectedQ] = useState<string | null>(null);
  const [titleValue, setTitleValue] = useState('');
  const [questionText, setQuestionText] = useState('');
  const [answerTexts, setAnswerTexts] = useState<Record<string, string>>({});
  const [savingAnswerIds, setSavingAnswerIds] = useState<Set<string>>(new Set());
  const draggedIdRef = useRef<string | null>(null);
  const isMutating = useIsMutating();

  const { data: quiz } = useQuery<FullQuiz>({
    queryKey: ['quiz', id],
    queryFn: () => api.get(`/quizzes/${id}`),
    placeholderData: keepPreviousData,
  });

  useEffect(() => {
    if (quiz) setTitleValue(quiz.title);
  }, [quiz?.id]);

  const questions = quiz?.questions.slice().sort((a, b) => a.order - b.order) ?? [];
  const activeQ = questions.find((q) => q.id === selectedQ) ?? questions[0];

  useEffect(() => {
    if (!activeQ) return;
    setQuestionText(activeQ.text);
    setAnswerTexts(Object.fromEntries(sortedAnswers(activeQ.answers).map((a) => [a.id, a.text])));
  }, [activeQ?.id]);

  useEffect(() => {
    if (!activeQ) return;
    setAnswerTexts((prev) => {
      const next: Record<string, string> = {};
      for (const a of sortedAnswers(activeQ.answers)) {
        next[a.id] = a.id in prev ? prev[a.id] : a.text;
      }
      return next;
    });
  }, [activeQ?.answers.map((a) => a.id).join(',')]);

  const updateQuiz = useMutation({
    mutationFn: (data: { title?: string; description?: string }) => api.put(`/quizzes/${id}`, data),
  });

  const addQuestion = useMutation({
    mutationFn: () =>
      api.post(`/quizzes/${id}/questions`, {
        text: 'New question',
        type: QuestionType.SINGLE,
        timeLimit: 20,
        maxPoints: 1000,
        order: (quiz?.questions.length ?? 0),
      }),
    onSuccess: (q: any) => {
      qc.invalidateQueries({ queryKey: ['quiz', id] });
      setSelectedQ(q.id);
    },
  });

  const updateQuestion = useMutation({
    mutationFn: ({ qId, data }: { qId: string; data: any }) => api.put(`/questions/${qId}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['quiz', id] }),
  });

  const deleteQuestion = useMutation({
    mutationFn: (qId: string) => api.delete(`/questions/${qId}`),
    onSuccess: () => {
      setSelectedQ(null);
      qc.invalidateQueries({ queryKey: ['quiz', id] });
    },
  });

  const addAnswer = useMutation({
    mutationFn: (qId: string) => api.post(`/questions/${qId}/answers`, { text: 'Option', isCorrect: false }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['quiz', id] }),
  });

  const markSaving = useCallback((aId: string) => setSavingAnswerIds((s) => new Set(s).add(aId)), []);
  const unmarkSaving = useCallback((aId: string) => setSavingAnswerIds((s) => { const n = new Set(s); n.delete(aId); return n; }), []);

  const updateAnswer = useMutation({
    mutationFn: ({ aId, data }: { aId: string; data: any }) => api.put(`/answers/${aId}`, data),
    onMutate: ({ aId }) => markSaving(aId),
    onSettled: (_, __, { aId }) => unmarkSaving(aId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['quiz', id] }),
  });

  const deleteAnswer = useMutation({
    mutationFn: (aId: string) => api.delete(`/answers/${aId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['quiz', id] }),
  });

  const reorderAnswers = useMutation({
    mutationFn: ({ qId, answerIds }: { qId: string; answerIds: string[] }) =>
      api.patch(`/questions/${qId}/answers/reorder`, { answerIds }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['quiz', id] }),
  });

  function handleCorrectToggle(answerId: string, checked: boolean) {
    if (!activeQ) return;
    if (activeQ.type === QuestionType.SINGLE && checked) {
      activeQ.answers
        .filter((a) => a.isCorrect && a.id !== answerId)
        .forEach((a) => updateAnswer.mutate({ aId: a.id, data: { isCorrect: false } }));
    }
    updateAnswer.mutate({ aId: answerId, data: { isCorrect: checked } });
  }

  function handleTypeChange(type: QuestionType) {
    if (!activeQ) return;
    if (type === QuestionType.SINGLE) {
      const correct = activeQ.answers.filter((a) => a.isCorrect);
      if (correct.length > 1) {
        correct.slice(1).forEach((a) =>
          updateAnswer.mutate({ aId: a.id, data: { isCorrect: false } }),
        );
      }
    }
    updateQuestion.mutate({ qId: activeQ.id, data: { type } });
  }

  function handleDragStart(answerId: string) {
    draggedIdRef.current = answerId;
  }

  function handleDrop(targetId: string) {
    if (!activeQ || !draggedIdRef.current || draggedIdRef.current === targetId) return;
    const answers = sortedAnswers(activeQ.answers);
    const fromIndex = answers.findIndex((a) => a.id === draggedIdRef.current);
    const toIndex = answers.findIndex((a) => a.id === targetId);
    const reordered = [...answers];
    reordered.splice(fromIndex, 1);
    reordered.splice(toIndex, 0, answers[fromIndex]);
    draggedIdRef.current = null;
    reorderAnswers.mutate({ qId: activeQ.id, answerIds: reordered.map((a) => a.id) });
  }

  if (!quiz) {
    return (
      <div className="min-h-screen bg-base-200 flex items-center justify-center">
        <span className="loading loading-spinner loading-lg" />
      </div>
    );
  }

  return (
    <div className="h-screen overflow-hidden bg-base-200 flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-4 px-6 py-3 bg-base-100 border-b border-base-300">
        <button onClick={() => navigate('/host')} className="btn btn-ghost btn-sm btn-circle text-lg">
          ←
        </button>
        <input
          className="bg-transparent text-xl font-bold flex-1 outline-none border-b-2 border-transparent hover:border-base-300 focus:border-primary transition-colors placeholder-base-content/30 pb-0.5"
          value={titleValue}
          placeholder="Quiz title"
          autoComplete="off"
          onChange={(e) => setTitleValue(e.target.value)}
          onBlur={() => {
            if (titleValue.trim() && titleValue !== quiz.title) {
              updateQuiz.mutate({ title: titleValue.trim() });
            }
          }}
        />
        <div className={`flex items-center gap-1.5 text-xs text-base-content/40 transition-opacity duration-200 ${isMutating > 0 ? 'opacity-100' : 'opacity-0'}`}>
          <span className="loading loading-spinner loading-xs" />
          Saving…
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <div className="w-64 border-r border-base-300 bg-base-100 flex flex-col">
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {questions.map((q, i) => (
              <button
                key={q.id}
                onClick={() => setSelectedQ(q.id)}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                  activeQ?.id === q.id
                    ? 'bg-primary text-primary-content'
                    : 'bg-base-200 hover:bg-base-300'
                }`}
              >
                <span className="opacity-50 text-xs mr-2">#{i + 1}</span>
                {q.text.slice(0, 40)}
              </button>
            ))}
          </div>
          <div className="p-3 border-t border-base-300">
            <button
              onClick={() => addQuestion.mutate()}
              className="btn btn-ghost btn-sm w-full"
            >
              + Add Question
            </button>
          </div>
        </div>

        {/* Editor panel */}
        {activeQ ? (
          <div key={activeQ.id} className="flex-1 overflow-y-auto p-6 space-y-6">
            <div className="space-y-3">
              <textarea
                className="textarea textarea-bordered w-full text-lg resize-none"
                rows={3}
                value={questionText}
                autoComplete="off"
                onChange={(e) => setQuestionText(e.target.value)}
                onBlur={() => {
                  if (questionText !== activeQ.text) {
                    updateQuestion.mutate({ qId: activeQ.id, data: { text: questionText } });
                  }
                }}
              />

              <div className="flex gap-3 flex-wrap items-center">
                {/* Type toggle */}
                <div className="join">
                  {[QuestionType.SINGLE, QuestionType.MULTIPLE].map((t) => (
                    <button
                      key={t}
                      onClick={() => handleTypeChange(t)}
                      className={`btn btn-sm join-item capitalize ${
                        activeQ.type === t ? 'btn-primary' : 'btn-ghost'
                      }`}
                    >
                      {t.toLowerCase()}
                    </button>
                  ))}
                </div>

                {/* Time limit */}
                <select
                  value={activeQ.timeLimit}
                  onChange={(e) =>
                    updateQuestion.mutate({ qId: activeQ.id, data: { timeLimit: Number(e.target.value) } })
                  }
                  className="select select-bordered select-sm"
                >
                  {TIME_OPTIONS.map((t) => (
                    <option key={t} value={t}>
                      {t}s
                    </option>
                  ))}
                </select>

                <button
                  onClick={() => {
                    if (confirm('Delete question?')) deleteQuestion.mutate(activeQ.id);
                  }}
                  className="btn btn-ghost btn-sm text-amber-700 ml-auto"
                >
                  Delete question
                </button>
              </div>
            </div>

            {/* Answers */}
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-base-content/60 uppercase tracking-wide">
                Answers
              </h3>
              {sortedAnswers(activeQ.answers).map((a, i) => (
                <div
                  key={a.id}
                  draggable
                  onDragStart={() => handleDragStart(a.id)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => handleDrop(a.id)}
                  className="flex items-center gap-3 bg-base-100 border border-base-300 rounded-lg px-3 py-3 cursor-grab active:cursor-grabbing"
                >
                  <GripVertical size={16} className="text-base-content/30 shrink-0" />
                  <span className="text-xs text-base-content/40 w-4 shrink-0 select-none">{i + 1}</span>
                  <input
                    type={activeQ.type === QuestionType.SINGLE ? 'radio' : 'checkbox'}
                    name={activeQ.type === QuestionType.SINGLE ? `correct-${activeQ.id}` : undefined}
                    checked={a.isCorrect}
                    onChange={(e) => handleCorrectToggle(a.id, e.target.checked)}
                    className={activeQ.type === QuestionType.SINGLE
                      ? 'radio radio-success radio-sm shrink-0'
                      : 'checkbox checkbox-success checkbox-sm shrink-0'}
                  />
                  <input
                    className="flex-1 bg-transparent outline-none"
                    value={answerTexts[a.id] ?? a.text}
                    autoComplete="off"
                    onMouseDown={(e) => e.stopPropagation()}
                    onChange={(e) =>
                      setAnswerTexts((prev) => ({ ...prev, [a.id]: e.target.value }))
                    }
                    onBlur={() => {
                      const current = answerTexts[a.id] ?? a.text;
                      if (current !== a.text) {
                        updateAnswer.mutate({ aId: a.id, data: { text: current } });
                      }
                    }}
                  />
                  {savingAnswerIds.has(a.id)
                    ? <span className="loading loading-spinner loading-xs text-base-content/30 shrink-0" />
                    : (
                      <button
                        onClick={() => deleteAnswer.mutate(a.id)}
                        className="btn btn-ghost btn-xs text-error shrink-0"
                      >
                        ✕
                      </button>
                    )
                  }
                </div>
              ))}
              <button
                onClick={() => addAnswer.mutate(activeQ.id)}
                className="btn btn-ghost btn-sm w-full"
              >
                + Add Answer
              </button>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-base-content/40">
            Select or add a question
          </div>
        )}
      </div>
    </div>
  );
}
