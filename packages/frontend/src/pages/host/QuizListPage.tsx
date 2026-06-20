import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import { useAuth } from '../../hooks/useAuth';
import type { QuizEntity } from '@quiz/shared';

export function QuizListPage() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

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

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold">My Quizzes</h1>
          <div className="flex gap-3">
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
            <button
              onClick={() => createMutation.mutate()}
              className="bg-indigo-600 hover:bg-indigo-500 px-6 py-3 rounded-lg font-medium transition-colors text-white"
            >
              Create your first quiz
            </button>
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
    </div>
  );
}
