import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { LoginPage } from './pages/host/LoginPage';
import { QuizListPage } from './pages/host/QuizListPage';
import { QuizEditorPage } from './pages/host/QuizEditorPage';
import { SessionLobbyPage } from './pages/host/SessionLobbyPage';
import { SessionControlPage } from './pages/host/SessionControlPage';
import { JoinPage } from './pages/participant/JoinPage';
import { ParticipantSessionPage } from './pages/participant/ParticipantSessionPage';

const queryClient = new QueryClient();

function RequireAuth({ children }: { children: React.ReactNode }) {
  const token = sessionStorage.getItem('access_token');
  return token ? <>{children}</> : <Navigate to="/host/login" replace />;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          {/* Host */}
          <Route path="/host/login" element={<LoginPage />} />
          <Route path="/host" element={<RequireAuth><QuizListPage /></RequireAuth>} />
          <Route path="/host/quizzes/:id/edit" element={<RequireAuth><QuizEditorPage /></RequireAuth>} />
          <Route path="/host/sessions/:code/lobby" element={<RequireAuth><SessionLobbyPage /></RequireAuth>} />
          <Route path="/host/sessions/:code/control" element={<RequireAuth><SessionControlPage /></RequireAuth>} />

          {/* Participant */}
          <Route path="/" element={<JoinPage />} />
          <Route path="/session/:code" element={<ParticipantSessionPage />} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
