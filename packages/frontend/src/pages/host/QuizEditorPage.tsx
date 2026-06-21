import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import { QuestionType } from '@quiz/shared';
import type { QuizEntity, QuestionEntity, AnswerEntity } from '@quiz/shared';

type FullQuiz = QuizEntity & { questions: (QuestionEntity & { answers: AnswerEntity[] })[] };

const TIME_OPTIONS = [5, 10, 20, 30, 60];

export function QuizEditorPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [selectedQ, setSelectedQ] = useState<string | null>(null);

  // Controlled state for editable fields
  const [titleValue, setTitleValue] = useState('');
  const [questionText, setQuestionText] = useState('');
  const [answerTexts, setAnswerTexts] = useState<Record<string, string>>({});

  const { data: quiz } = useQuery<FullQuiz>({
    queryKey: ['quiz', id],
    queryFn: () => api.get(`/quizzes/${id}`),
  });

  // Sync title when quiz first loads (not on every refetch to avoid overwriting mid-edit)
  useEffect(() => {
    if (quiz) setTitleValue(quiz.title);
  }, [quiz?.id]);

  const questions = quiz?.questions.slice().sort((a, b) => a.order - b.order) ?? [];
  const activeQ = questions.find((q) => q.id === selectedQ) ?? questions[0];

  // Reset question text and answer texts when switching questions
  useEffect(() => {
    if (!activeQ) return;
    setQuestionText(activeQ.text);
    setAnswerTexts(Object.fromEntries(activeQ.answers.map((a) => [a.id, a.text])));
  }, [activeQ?.id]);

  // Merge new/removed answer IDs without resetting existing typed values
  useEffect(() => {
    if (!activeQ) return;
    setAnswerTexts((prev) => {
      const next: Record<string, string> = {};
      for (const a of activeQ.answers) {
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

  const updateAnswer = useMutation({
    mutationFn: ({ aId, data }: { aId: string; data: any }) => api.put(`/answers/${aId}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['quiz', id] }),
  });

  const deleteAnswer = useMutation({
    mutationFn: (aId: string) => api.delete(`/answers/${aId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['quiz', id] }),
  });

  if (!quiz) {
    return (
      <div className="min-h-screen bg-gray-950 text-gray-400 flex items-center justify-center">
        Loading…
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-4 px-6 py-4 border-b border-gray-800">
        <button onClick={() => navigate('/host')} className="text-gray-400 hover:text-white text-lg">
          ←
        </button>
        <input
          className="bg-transparent text-xl font-bold flex-1 outline-none border-b border-transparent hover:border-gray-600 focus:border-indigo-500 transition-colors placeholder-gray-600 pb-0.5"
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
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar — question list */}
        <div className="w-64 border-r border-gray-800 flex flex-col">
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {questions.map((q, i) => (
              <button
                key={q.id}
                onClick={() => setSelectedQ(q.id)}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                  activeQ?.id === q.id ? 'bg-indigo-600' : 'bg-gray-800 hover:bg-gray-700'
                }`}
              >
                <span className="text-gray-400 text-xs mr-2">#{i + 1}</span>
                {q.text.slice(0, 40)}
              </button>
            ))}
          </div>
          <div className="p-3 border-t border-gray-800">
            <button
              onClick={() => addQuestion.mutate()}
              className="w-full bg-gray-800 hover:bg-gray-700 py-2 rounded-lg text-sm transition-colors"
            >
              + Add Question
            </button>
          </div>
        </div>

        {/* Editor panel — keyed on question ID so it resets cleanly when switching */}
        {activeQ ? (
          <div key={activeQ.id} className="flex-1 overflow-y-auto p-6 space-y-6">
            <div className="space-y-3">
              <textarea
                className="w-full bg-gray-800 rounded-lg px-4 py-3 text-lg outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
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

              <div className="flex gap-4 flex-wrap">
                {/* Type toggle */}
                <div className="flex rounded-lg overflow-hidden border border-gray-700">
                  {[QuestionType.SINGLE, QuestionType.MULTIPLE].map((t) => (
                    <button
                      key={t}
                      onClick={() => updateQuestion.mutate({ qId: activeQ.id, data: { type: t } })}
                      className={`px-4 py-2 text-sm font-medium capitalize transition-colors ${
                        activeQ.type === t ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white'
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
                  className="bg-gray-800 rounded-lg px-3 py-2 text-sm outline-none"
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
                  className="ml-auto text-red-400 hover:text-red-300 text-sm"
                >
                  Delete question
                </button>
              </div>
            </div>

            {/* Answers */}
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wide">Answers</h3>
              {activeQ.answers.map((a) => (
                <div key={a.id} className="flex items-center gap-3 bg-gray-800 rounded-lg px-4 py-3">
                  <input
                    type="checkbox"
                    checked={a.isCorrect}
                    onChange={(e) =>
                      updateAnswer.mutate({ aId: a.id, data: { isCorrect: e.target.checked } })
                    }
                    className="accent-green-500 w-4 h-4 shrink-0"
                  />
                  <input
                    className="flex-1 bg-transparent outline-none"
                    value={answerTexts[a.id] ?? a.text}
                    autoComplete="off"
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
                  <button
                    onClick={() => deleteAnswer.mutate(a.id)}
                    className="text-gray-600 hover:text-red-400 text-sm shrink-0"
                  >
                    ✕
                  </button>
                </div>
              ))}
              <button
                onClick={() => addAnswer.mutate(activeQ.id)}
                className="w-full bg-gray-800 hover:bg-gray-700 py-2 rounded-lg text-sm transition-colors"
              >
                + Add Answer
              </button>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-600">
            Select or add a question
          </div>
        )}
      </div>
    </div>
  );
}
