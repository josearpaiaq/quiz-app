import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import { useAuth } from '../../hooks/useAuth';
import type { QuizEntity } from '@quiz/shared';

const TEMPLATE_CSV = [
  'question,type,time_limit,max_points,answer1,answer1_correct,answer2,answer2_correct,answer3,answer3_correct,answer4,answer4_correct',
  'What is 2+2?,SINGLE,30,1000,3,false,4,true,5,false,6,false',
  'Which of these are prime numbers?,MULTIPLE,45,1000,2,true,4,false,7,true,9,false',
].join('\n');

function downloadTemplate() {
  const blob = new Blob([TEMPLATE_CSV], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'quiz-template.csv';
  a.click();
  URL.revokeObjectURL(url);
}

export function QuizListPage() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [importOpen, setImportOpen] = useState(false);
  const [importTitle, setImportTitle] = useState('');
  const [importFile, setImportFile] = useState<File | null>(null);

  const { data: quizzes = [], isLoading } = useQuery<QuizEntity[]>({
    queryKey: ['quizzes'],
    queryFn: () => api.get('/quizzes'),
  });

  const createMutation = useMutation({
    mutationFn: () => api.post<QuizEntity>('/quizzes', { title: 'New Quiz' }),
    onSuccess: (quiz) => {
      qc.invalidateQueries({ queryKey: ['quizzes'] });
      navigate(`/host/quizzes/${quiz.id}/edit`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/quizzes/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['quizzes'] }),
  });

  const startSession = useMutation({
    mutationFn: (quizId: string) =>
      api.post<{ sessionId: string; code: string }>('/sessions', { quizId }),
    onSuccess: (data) => navigate(`/host/sessions/${data.code}/lobby`),
  });

  const importMutation = useMutation({
    mutationFn: () => {
      const form = new FormData();
      form.append('title', importTitle);
      form.append('file', importFile!);
      return api.postForm<QuizEntity>('/quizzes/import', form);
    },
    onSuccess: (quiz) => {
      qc.invalidateQueries({ queryKey: ['quizzes'] });
      closeImport();
      navigate(`/host/quizzes/${quiz.id}/edit`);
    },
  });

  function closeImport() {
    setImportOpen(false);
    setImportTitle('');
    setImportFile(null);
    importMutation.reset();
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold">My Quizzes</h1>
          <div className="flex gap-3">
            <button
              onClick={() => setImportOpen(true)}
              className="bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded-lg font-medium transition-colors text-sm"
            >
              Import CSV / Excel
            </button>
            <button
              onClick={() => createMutation.mutate()}
              className="bg-indigo-600 hover:bg-indigo-500 px-4 py-2 rounded-lg font-medium transition-colors"
            >
              + New Quiz
            </button>
            <button onClick={logout} className="text-gray-400 hover:text-white transition-colors text-sm">
              Sign out
            </button>
          </div>
        </div>

        {isLoading ? (
          <p className="text-gray-400">Loading…</p>
        ) : quizzes.length === 0 ? (
          <div className="text-center py-20 text-gray-500">
            <p className="text-lg mb-4">No quizzes yet.</p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => createMutation.mutate()}
                className="bg-indigo-600 hover:bg-indigo-500 px-6 py-3 rounded-lg font-medium transition-colors text-white"
              >
                Create your first quiz
              </button>
              <button
                onClick={() => setImportOpen(true)}
                className="bg-gray-700 hover:bg-gray-600 px-6 py-3 rounded-lg font-medium transition-colors text-white"
              >
                Import from file
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {quizzes.map((quiz) => (
              <div key={quiz.id} className="bg-gray-900 rounded-xl p-5 flex flex-col gap-3">
                <h2 className="font-semibold text-lg truncate">{quiz.title}</h2>
                {quiz.description && (
                  <p className="text-gray-400 text-sm line-clamp-2">{quiz.description}</p>
                )}
                <div className="flex gap-2 mt-auto">
                  <button
                    onClick={() => navigate(`/host/quizzes/${quiz.id}/edit`)}
                    className="flex-1 bg-gray-800 hover:bg-gray-700 px-3 py-2 rounded-lg text-sm transition-colors"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => startSession.mutate(quiz.id)}
                    className="flex-1 bg-green-600 hover:bg-green-500 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
                  >
                    Start
                  </button>
                  <button
                    onClick={() => {
                      if (confirm('Delete this quiz?')) deleteMutation.mutate(quiz.id);
                    }}
                    className="bg-gray-800 hover:bg-red-900 px-3 py-2 rounded-lg text-sm transition-colors"
                  >
                    🗑
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {importOpen && (
        <div
          className="fixed inset-0 bg-black/60 flex items-center justify-center z-50"
          onClick={(e) => { if (e.target === e.currentTarget) closeImport(); }}
        >
          <div className="bg-gray-900 rounded-xl p-6 w-full max-w-md mx-4 flex flex-col gap-4">
            <h2 className="text-xl font-bold">Import Quiz</h2>
            <p className="text-gray-400 text-sm">
              Upload a CSV or Excel file with your questions.{' '}
              <button
                onClick={downloadTemplate}
                className="text-indigo-400 hover:text-indigo-300 underline"
              >
                Download template
              </button>
            </p>

            <div className="flex flex-col gap-1">
              <label className="text-sm text-gray-400">Quiz title</label>
              <input
                type="text"
                value={importTitle}
                onChange={(e) => setImportTitle(e.target.value)}
                placeholder="My Imported Quiz"
                className="bg-gray-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-sm text-gray-400">File (.csv or .xlsx)</label>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.xlsx"
                onChange={(e) => setImportFile(e.target.files?.[0] ?? null)}
                className="text-sm text-gray-300 file:mr-3 file:py-1 file:px-3 file:rounded-lg file:border-0 file:bg-gray-700 file:text-gray-200 file:cursor-pointer hover:file:bg-gray-600"
              />
            </div>

            {importMutation.error && (
              <div className="bg-red-900/40 border border-red-700 rounded-lg px-3 py-2">
                <p className="text-red-300 text-sm whitespace-pre-wrap">
                  {(importMutation.error as Error).message}
                </p>
              </div>
            )}

            <div className="flex gap-3 justify-end pt-1">
              <button
                onClick={closeImport}
                className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => importMutation.mutate()}
                disabled={!importFile || importMutation.isPending}
                className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                {importMutation.isPending ? 'Importing…' : 'Import'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
