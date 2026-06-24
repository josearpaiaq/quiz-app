import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Copy, Check } from 'lucide-react';
import { api } from '../../lib/api';
import { getSocket } from '../../lib/socket';
import { SOCKET_EVENTS } from '@quiz/shared';
import type { PlayerJoinedPayload, PlayerKickedPayload } from '@quiz/shared';

interface Player {
  nickname: string;
}

export function SessionLobbyPage() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const [players, setPlayers] = useState<Player[]>([]);
  const [sessionId, setSessionId] = useState('');
  const [copied, setCopied] = useState(false);

  function copyJoinLink() {
    const url = `${window.location.origin}/?code=${code}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const { data: session } = useQuery({
    queryKey: ['session', code],
    queryFn: () => api.get<any>(`/sessions/${code}`),
    enabled: !!code,
  });

  useEffect(() => {
    if (session) {
      setSessionId(session.id);
      setPlayers(
        session.participants?.map((p: any) => ({ nickname: p.nickname })) ?? [],
      );
    }
  }, [session]);

  useEffect(() => {
    if (!code) return;
    const token = sessionStorage.getItem('access_token') ?? undefined;
    const socket = getSocket(token);

    socket.emit(SOCKET_EVENTS.SESSION_HOST_JOIN, { code });

    const onJoined = (data: PlayerJoinedPayload) => {
      setPlayers((prev) => {
        if (prev.some((p) => p.nickname === data.nickname)) return prev;
        return [...prev, { nickname: data.nickname }];
      });
    };

    const onKicked = (data: PlayerKickedPayload) => {
      setPlayers((prev) => prev.filter((p) => p.nickname !== data.nickname));
    };

    socket.on(SOCKET_EVENTS.PLAYER_JOINED, onJoined);
    socket.on(SOCKET_EVENTS.PLAYER_KICKED, onKicked);
    return () => {
      socket.off(SOCKET_EVENTS.PLAYER_JOINED, onJoined);
      socket.off(SOCKET_EVENTS.PLAYER_KICKED, onKicked);
    };
  }, [code]);

  function kickPlayer(nickname: string) {
    const token = sessionStorage.getItem('access_token') ?? undefined;
    const socket = getSocket(token);
    socket.emit(SOCKET_EVENTS.KICK_PARTICIPANT, { nickname });
  }

  function startSession() {
    const token = sessionStorage.getItem('access_token') ?? undefined;
    const socket = getSocket(token);
    socket.emit(SOCKET_EVENTS.SESSION_START, { sessionId });
    socket.once(SOCKET_EVENTS.QUESTION_START, (data) => {
      navigate(`/host/sessions/${code}/control`, {
        state: { sessionId, firstQuestion: data, totalPlayers: players.length },
      });
    });
  }

  return (
    <div className="min-h-screen bg-base-200 flex flex-col items-center justify-center p-6">
      <p className="text-base-content/60 mb-2 uppercase tracking-widest text-sm">Room code</p>
      <h1 className="text-8xl font-mono font-bold tracking-widest text-primary mb-4">{code}</h1>
      <button
        onClick={copyJoinLink}
        className={`btn btn-sm gap-2 mb-10 transition-all ${copied ? 'btn-success' : 'btn-ghost'}`}
      >
        {copied ? <Check size={15} /> : <Copy size={15} />}
        {copied ? 'Link copied!' : 'Copy join link'}
      </button>

      <div className="w-full max-w-lg">
        <p className="text-base-content/60 text-sm mb-4">
          {players.length} player{players.length !== 1 ? 's' : ''} joined
        </p>
        <div className="flex flex-wrap gap-3 min-h-16 mb-8">
          {players.map((p) => (
            <div
              key={p.nickname}
              className="relative bg-base-100 shadow px-5 py-2 rounded-full flex flex-col items-center justify-center min-w-[110px]"
            >
              <span className="font-bold text-base leading-tight text-center">{p.nickname}</span>
              <button
                onClick={() => kickPlayer(p.nickname)}
                title="Remove player"
                className="btn btn-circle btn-xs btn-error absolute -top-2 -right-2"
              >
                ×
              </button>
            </div>
          ))}
        </div>

        <button
          onClick={startSession}
          disabled={players.length === 0 || !sessionId}
          className="btn btn-success btn-lg w-full text-white"
        >
          Start Quiz
        </button>
      </div>
    </div>
  );
}
