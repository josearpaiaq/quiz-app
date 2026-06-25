import { useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { getSocket } from '../../lib/socket';
import { SOCKET_EVENTS } from '@quiz/shared';
import type {
  QuestionStartPayload, QuestionTickPayload, QuestionEndPayload,
  LeaderboardUpdatePayload, SessionFinishedPayload, RankingEntry,
  AnswerCountUpdatePayload,
} from '@quiz/shared';

type Phase = 'question' | 'results' | 'leaderboard' | 'finished';

const ANSWER_COLORS = ['bg-red-600', 'bg-blue-600', 'bg-yellow-500', 'bg-green-600'];

export function SessionControlPage() {
  const { code: _code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const navState = location.state as {
    sessionId?: string;
    firstQuestion?: QuestionStartPayload;
    totalPlayers?: number;
  } | null;

  const [phase, setPhase] = useState<Phase>('question');
  const [question, setQuestion] = useState<QuestionStartPayload | null>(navState?.firstQuestion ?? null);
  const [remainingMs, setRemainingMs] = useState(navState?.firstQuestion?.timeLimitMs ?? 0);
  const [correctIds, setCorrectIds] = useState<string[]>([]);
  const [rankings, setRankings] = useState<RankingEntry[]>([]);
  const [sessionId] = useState(navState?.sessionId ?? '');
  const [answeredCount, setAnsweredCount] = useState(0);
  const [totalPlayers, setTotalPlayers] = useState(navState?.totalPlayers ?? 0);

  useEffect(() => {
    const token = sessionStorage.getItem('access_token') ?? undefined;
    const socket = getSocket(token);

    socket.on(SOCKET_EVENTS.QUESTION_START, (data: QuestionStartPayload) => {
      setQuestion(data);
      setPhase('question');
      setRemainingMs(data.timeLimitMs);
      setAnsweredCount(0);
      setCorrectIds([]);
    });

    socket.on(SOCKET_EVENTS.QUESTION_TICK, (data: QuestionTickPayload) => {
      setRemainingMs(data.remainingMs);
    });

    socket.on(SOCKET_EVENTS.QUESTION_END, (data: QuestionEndPayload) => {
      setCorrectIds(data.correctAnswerIds);
      setPhase('results');
    });

    socket.on(SOCKET_EVENTS.LEADERBOARD_UPDATE, (data: LeaderboardUpdatePayload) => {
      setRankings(data.rankings);
      setPhase('leaderboard');
    });

    socket.on(SOCKET_EVENTS.SESSION_FINISHED, (data: SessionFinishedPayload) => {
      setRankings(data.finalRankings);
      setPhase('finished');
    });

    socket.on(SOCKET_EVENTS.ANSWER_COUNT_UPDATE, (data: AnswerCountUpdatePayload) => {
      setAnsweredCount(data.answeredCount);
      setTotalPlayers(data.totalPlayers);
    });

    return () => {
      socket.off(SOCKET_EVENTS.QUESTION_START);
      socket.off(SOCKET_EVENTS.QUESTION_TICK);
      socket.off(SOCKET_EVENTS.QUESTION_END);
      socket.off(SOCKET_EVENTS.LEADERBOARD_UPDATE);
      socket.off(SOCKET_EVENTS.SESSION_FINISHED);
      socket.off(SOCKET_EVENTS.ANSWER_COUNT_UPDATE);
    };
  }, []);

  function sendNext() {
    const token = sessionStorage.getItem('access_token') ?? undefined;
    const socket = getSocket(token);
    socket.emit(SOCKET_EVENTS.SESSION_NEXT, { sessionId });
  }

  if (!question) return (
    <div className="min-h-screen bg-base-200 flex items-center justify-center">
      <span className="loading loading-spinner loading-lg" />
    </div>
  );

  const pct = (remainingMs / question.timeLimitMs) * 100;

  // ─── Finished ─────────────────────────────────────────────────────────────
  if (phase === 'finished') return (
    <div className="min-h-screen bg-base-200 flex flex-col p-6 items-center">
      <h2 className="text-3xl font-bold text-center mt-8 mb-6">Final Rankings</h2>
      <div className="space-y-2 w-full max-w-md">
        {rankings.map((r) => (
          <div key={r.nickname} className="flex items-center gap-3 bg-base-100 rounded-lg px-4 py-3">
            <span className="text-base-content/40 w-6 text-sm">{r.rank}</span>
            <span className="flex-1 font-medium">{r.nickname}</span>
            <span className="text-primary font-mono font-bold">{r.score}</span>
          </div>
        ))}
      </div>
      <button onClick={() => navigate('/host')} className="btn btn-ghost mt-8">
        Back to quizzes
      </button>
    </div>
  );

  // ─── Question / results / leaderboard (dark game screen) ──────────────────
  return (
    <div className="min-h-screen bg-gray-950 text-white p-6 flex flex-col">
      <div className="flex items-center justify-between mb-4 text-sm text-gray-400">
        <span>Question {question.questionIndex + 1} / {question.totalQuestions}</span>
        <span className="text-white font-semibold">
          {answeredCount} of {totalPlayers > 0 ? totalPlayers : ''} answered
        </span>
        <span className="font-mono text-lg text-white">{Math.ceil(remainingMs / 1000)}s</span>
      </div>

      <div className="h-2 bg-gray-800 rounded-full mb-8">
        <div
          className="h-full bg-indigo-500 rounded-full transition-all duration-1000"
          style={{ width: `${pct}%` }}
        />
      </div>

      <div className="flex-1 max-w-2xl mx-auto w-full space-y-6">
        <h2 className="text-2xl font-bold">{question.text}</h2>

        {phase === 'question' && (
          <>
            <div className="grid grid-cols-2 gap-3">
              {question.answers.map((a, i) => (
                <div
                  key={a.id}
                  className={`${ANSWER_COLORS[i % 4]} rounded-xl px-5 py-4 flex items-center justify-center text-center min-h-[64px]`}
                >
                  <span className={`${a.text.length <= 20 ? 'text-lg font-bold' : a.text.length <= 40 ? 'text-base font-semibold' : 'text-sm font-medium'}`}>
                    {a.text}
                  </span>
                </div>
              ))}
            </div>
            <button onClick={sendNext} className="btn btn-ghost w-full text-gray-300 border-gray-700 hover:bg-gray-800">
              End question early
            </button>
          </>
        )}

        {(phase === 'results' || phase === 'leaderboard') && (
          <>
            <div className="grid grid-cols-2 gap-3">
              {question.answers.map((a, i) => (
                <div
                  key={a.id}
                  className={`rounded-xl px-5 py-4 flex items-center justify-center text-center min-h-[64px] font-medium ${
                    correctIds.includes(a.id)
                      ? 'bg-green-700 text-white'
                      : `${ANSWER_COLORS[i % 4]} opacity-30 text-white`
                  }`}
                >
                  <span className={`${a.text.length <= 20 ? 'text-lg font-bold' : a.text.length <= 40 ? 'text-base font-semibold' : 'text-sm font-medium'}`}>
                    {a.text} {correctIds.includes(a.id) && '✓'}
                  </span>
                </div>
              ))}
            </div>

            {phase === 'leaderboard' && (
              <>
                <div className="space-y-2">
                  {rankings.slice(0, 5).map((r) => (
                    <div key={r.nickname} className="flex items-center gap-3 bg-gray-800 rounded-lg px-4 py-3">
                      <span className="text-gray-500 w-6 text-sm">{r.rank}</span>
                      <span className="flex-1 font-medium">{r.nickname}</span>
                      <span className="text-indigo-400 font-mono">{r.score}</span>
                      {r.delta !== undefined && r.delta > 0 && (
                        <span className="text-green-400 text-sm">+{r.delta}</span>
                      )}
                    </div>
                  ))}
                </div>
                <button onClick={sendNext} className="btn btn-primary w-full">
                  {question.questionIndex + 1 < question.totalQuestions ? 'Next Question' : 'Finish'}
                </button>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
