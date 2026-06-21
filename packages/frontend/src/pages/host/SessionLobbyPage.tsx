import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { getSocket } from '../../lib/socket';
import { SOCKET_EVENTS } from '@quiz/shared';
import type { PlayerJoinedPayload } from '@quiz/shared';

export function SessionLobbyPage() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const [players, setPlayers] = useState<string[]>([]);
  const [sessionId, setSessionId] = useState('');

  const { data: session } = useQuery({
    queryKey: ['session', code],
    queryFn: () => api.get<any>(`/sessions/${code}`),
    enabled: !!code,
  });

  useEffect(() => {
    if (session) {
      setSessionId(session.id);
      setPlayers(session.participants?.map((p: any) => p.nickname) ?? []);
    }
  }, [session]);

  useEffect(() => {
    if (!code) return;
    const token = sessionStorage.getItem('access_token') ?? undefined;
    const socket = getSocket(token);

    socket.emit(SOCKET_EVENTS.SESSION_HOST_JOIN, { code });

    const onJoined = (data: PlayerJoinedPayload) => {
      setPlayers((prev) => {
        if (prev.includes(data.nickname)) return prev;
        return [...prev, data.nickname];
      });
    };

    socket.on(SOCKET_EVENTS.PLAYER_JOINED, onJoined);
    return () => { socket.off(SOCKET_EVENTS.PLAYER_JOINED, onJoined); };
  }, [code]);

  function startSession() {
    const token = sessionStorage.getItem('access_token') ?? undefined;
    const socket = getSocket(token);
    socket.emit(SOCKET_EVENTS.SESSION_START, { sessionId });
    socket.once(SOCKET_EVENTS.QUESTION_START, (data) => {
      navigate(`/host/sessions/${code}/control`, { state: { sessionId, firstQuestion: data } });
    });
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col items-center justify-center p-6">
      <p className="text-gray-400 mb-2 uppercase tracking-widest text-sm">Room code</p>
      <h1 className="text-8xl font-mono font-bold tracking-widest text-indigo-400 mb-12">{code}</h1>

      <div className="w-full max-w-lg">
        <p className="text-gray-400 text-sm mb-4">{players.length} player{players.length !== 1 ? 's' : ''} joined</p>
        <div className="flex flex-wrap gap-2 min-h-16 mb-8">
          {players.map((p) => (
            <span key={p} className="bg-gray-800 px-4 py-2 rounded-full text-sm font-medium">{p}</span>
          ))}
        </div>

        <button
          onClick={startSession}
          disabled={players.length === 0 || !sessionId}
          className="w-full bg-green-600 hover:bg-green-500 disabled:opacity-40 disabled:cursor-not-allowed py-4 rounded-xl text-lg font-bold transition-colors"
        >
          Start Quiz
        </button>
      </div>
    </div>
  );
}
