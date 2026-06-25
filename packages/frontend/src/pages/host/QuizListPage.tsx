import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import { useAuth } from '../../hooks/useAuth';
import type { QuizEntity } from '@quiz/shared';
import { Plus, LogOut, Trash } from 'lucide-react';

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
    <div className="min-h-screen bg-base-200 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8 gap-2">
          <h1 className="text-xl md:text-3xl font-bold">My Quizzes</h1>
          <div>
            {/* Desktop */}
            <div className="hidden sm:flex gap-2">
              <button
                onClick={() => setImportOpen(true)}
                className="btn btn-ghost btn-sm"
              >
                Import CSV / Excel
              </button>
              <button
                onClick={() => createMutation.mutate()}
                className="btn btn-primary btn-sm"
              >
                + New Quiz
              </button>
              <button onClick={async () => { await logout(); navigate('/login'); }} className="btn btn-ghost btn-sm">
                Sign out <LogOut />
              </button>
            </div>
            
            {/* Mobile dropdown */}
            <div className="dropdown dropdown-end sm:hidden">
              <div tabIndex={0} role="button" className="btn btn-ghost btn-sm text-lg">
                <Plus />
              </div>
              <ul
                tabIndex={0}
                className="dropdown-content menu bg-base-100 rounded-box z-10 w-48 p-2 shadow"
              >
                <li>
                  <button onClick={() => createMutation.mutate()} className="font-semibold">
                    + New Quiz
                  </button>
                </li>
                <li>
                  <button onClick={() => setImportOpen(true)}>
                    Import CSV / Excel
                  </button>
                </li>
              </ul>
            </div>
            <button 
              onClick={async () => { await logout(); navigate('/login'); }}
              className="btn btn-ghost btn-sm sm:hidden"
            >
              <LogOut />
            </button>
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-20">
            <span className="loading loading-spinner loading-lg" />
          </div>
        ) : quizzes.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-lg mb-4 text-base-content/60">No quizzes yet.</p>
            <div className="flex gap-3 justify-center">
              <button onClick={() => createMutation.mutate()} className="btn btn-primary">
                Create your first quiz
              </button>
              <button onClick={() => setImportOpen(true)} className="btn btn-ghost">
                Import from file
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {quizzes.map((quiz) => (
              <div key={quiz.id} className="card bg-base-100 shadow">
                <div className="card-body">
                  <h2 className="card-title truncate">{quiz.title}</h2>
                  {quiz.description && (
                    <p className="text-base-content/60 text-sm line-clamp-2">{quiz.description}</p>
                  )}
                  <div className="card-actions justify-end mt-2">
                    <button
                      onClick={() => navigate(`/host/quizzes/${quiz.id}/edit`)}
                      className="btn btn-ghost btn-sm"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => startSession.mutate(quiz.id)}
                      className="btn btn-success btn-sm text-white"
                    >
                      Start
                    </button>
                    <button
                      onClick={() => {
                        if (confirm('Delete this quiz?')) deleteMutation.mutate(quiz.id);
                      }}
                      className="btn btn-ghost btn-sm text-error"
                    >
                      <Trash size={15} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {importOpen && (
        <div
          className="modal modal-open"
          onClick={(e) => { if (e.target === e.currentTarget && !importMutation.isPending) closeImport(); }}
        >
          <div className="modal-box">
            <h2 className="text-xl font-bold mb-3">Import Quiz</h2>
            <p className="text-base-content/60 text-sm mb-4">
              Upload a CSV or Excel file with your questions.{' '}
              <button onClick={downloadTemplate} className="link link-primary">
                Download template
              </button>
            </p>

            <div className="flex flex-col gap-3">
              <div className="form-control">
                <label className="label">
                  <span className="label-text">Quiz title</span>
                </label>
                <input
                  type="text"
                  value={importTitle}
                  onChange={(e) => setImportTitle(e.target.value)}
                  placeholder="My Imported Quiz"
                  className="input input-bordered w-full"
                />
              </div>
              <div className="form-control">
                <label className="label">
                  <span className="label-text">File (.csv or .xlsx)</span>
                </label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.xlsx"
                  onChange={(e) => setImportFile(e.target.files?.[0] ?? null)}
                  disabled={importMutation.isPending}
                  className="file-input file-input-bordered w-full"
                />
              </div>
            </div>

            {importMutation.error && (
              <div className="alert alert-error mt-3">
                <p className="text-sm whitespace-pre-wrap">
                  {(importMutation.error as Error).message}
                </p>
              </div>
            )}

            <div className="modal-action">
              <button onClick={closeImport} disabled={importMutation.isPending} className="btn btn-ghost">
                Cancel
              </button>
              <button
                onClick={() => importMutation.mutate()}
                disabled={!importFile || importMutation.isPending}
                className="btn btn-primary"
              >
                {importMutation.isPending && (
                  <span className="loading loading-spinner loading-sm" />
                )}
                {importMutation.isPending ? 'Importing…' : 'Import'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
