import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { CheckCircle2, XCircle, Clock } from 'lucide-react';
import { getSocket, joinSession, disconnectSocket } from '../../lib/socket';
import { SOCKET_EVENTS, QuestionType } from '@quiz/shared';
import type {
  QuestionStartPayload, QuestionTickPayload, QuestionEndPayload,
  AnswerResultPayload, LeaderboardUpdatePayload, SessionFinishedPayload,
  RankingEntry,
} from '@quiz/shared';

type Phase = 'waiting' | 'question' | 'submitted' | 'leaderboard' | 'finished' | 'error';

function getAnswerFontClass(text: string): string {
  if (text.length <= 10) return 'text-2xl font-bold';
  if (text.length <= 20) return 'text-xl font-bold';
  if (text.length <= 40) return 'text-base font-semibold';
  return 'text-sm font-medium';
}

const ANSWER_COLORS = ['bg-red-600', 'bg-blue-600', 'bg-yellow-500', 'bg-green-600'];

export function ParticipantSessionPage() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();

  const [phase, setPhase] = useState<Phase>('waiting');
  const [question, setQuestion] = useState<QuestionStartPayload | null>(null);
  const [remainingMs, setRemainingMs] = useState(0);
  const [selected, setSelected] = useState<string[]>([]);
  const [result, setResult] = useState<AnswerResultPayload | null>(null);
  const [rankings, setRankings] = useState<RankingEntry[]>([]);
  const [nickname, setNickname] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [totalPlayers, setTotalPlayers] = useState(0);

  useEffect(() => {
    const info = JSON.parse(sessionStorage.getItem('participant_info') ?? '{}');
    if (!info.nickname) { navigate('/'); return; }
    setNickname(info.nickname);

    const socket = getSocket();
    joinSession(code!, info);

    socket.on(SOCKET_EVENTS.PLAYER_JOINED, (data: any) => {
      setTotalPlayers(data.totalPlayers);
      if (data.rejoined && data.nickname?.toLowerCase() === info.nickname?.toLowerCase()) {
        setPhase('waiting');
      }
    });

    socket.on(SOCKET_EVENTS.PLAYER_KICKED, (data: { nickname: string; totalPlayers: number }) => {
      setTotalPlayers(data.totalPlayers);
      if (data.nickname.toLowerCase() === info.nickname.toLowerCase()) navigate('/');
    });

    socket.on(SOCKET_EVENTS.QUESTION_START, (data: QuestionStartPayload) => {
      setQuestion(data);
      setSelected([]);
      setResult(null);
      setRemainingMs(data.timeLimitMs);
      setPhase('question');
    });

    socket.on(SOCKET_EVENTS.QUESTION_TICK, (data: QuestionTickPayload) => {
      setRemainingMs(data.remainingMs);
    });

    socket.on(SOCKET_EVENTS.QUESTION_END, (_data: QuestionEndPayload) => {
      setRemainingMs(0);
    });

    socket.on(SOCKET_EVENTS.ANSWER_RESULT, (data: AnswerResultPayload) => {
      setResult(data);
    });

    socket.on(SOCKET_EVENTS.LEADERBOARD_UPDATE, (data: LeaderboardUpdatePayload) => {
      setRankings(data.rankings);
      setPhase('leaderboard');
    });

    socket.on(SOCKET_EVENTS.SESSION_FINISHED, (data: SessionFinishedPayload) => {
      setRankings(data.finalRankings);
      setPhase('finished');
    });

    socket.on(SOCKET_EVENTS.ERROR, (data: { message: string }) => {
      setErrorMsg(data.message);
      setPhase('error');
    });

    return () => {
      socket.off(SOCKET_EVENTS.PLAYER_JOINED);
      socket.off(SOCKET_EVENTS.PLAYER_KICKED);
      socket.off(SOCKET_EVENTS.QUESTION_START);
      socket.off(SOCKET_EVENTS.QUESTION_TICK);
      socket.off(SOCKET_EVENTS.QUESTION_END);
      socket.off(SOCKET_EVENTS.ANSWER_RESULT);
      socket.off(SOCKET_EVENTS.LEADERBOARD_UPDATE);
      socket.off(SOCKET_EVENTS.SESSION_FINISHED);
      socket.off(SOCKET_EVENTS.ERROR);
    };
  }, [code, navigate]);

  function toggleAnswer(id: string) {
    if (!question) return;
    if (question.type === QuestionType.SINGLE) {
      setSelected([id]);
    } else {
      setSelected((prev) =>
        prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
      );
    }
  }

  function submitAnswer() {
    if (!question || selected.length === 0) return;
    const socket = getSocket();
    socket.emit(SOCKET_EVENTS.ANSWER_SUBMIT, {
      questionId: question.questionId,
      answerIds: selected,
    });
    setPhase('submitted');
  }

  useEffect(() => {
    if (question?.type === QuestionType.SINGLE && selected.length === 1 && phase === 'question') {
      submitAnswer();
    }
  }, [selected]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Waiting ──────────────────────────────────────────────────────────────
  if (phase === 'waiting') return (
    <div className="min-h-screen bg-base-200 flex flex-col items-center justify-center gap-4 p-6">
      <div className="avatar placeholder">
        <div className="bg-primary text-primary-content rounded-full w-16">
          <span className="text-2xl font-bold">{nickname[0]?.toUpperCase()}</span>
        </div>
      </div>
      <h2 className="text-2xl font-bold">{nickname}</h2>
      <div className="badge badge-outline">
        {totalPlayers} player{totalPlayers !== 1 ? 's' : ''} in lobby
      </div>
      <p className="text-base-content/40 text-sm mt-2">Waiting for host to start…</p>
    </div>
  );

  // ─── Error ────────────────────────────────────────────────────────────────
  if (phase === 'error') return (
    <div className="min-h-screen bg-base-200 flex flex-col items-center justify-center gap-4 p-6">
      <div className="alert alert-error max-w-sm">
        <XCircle size={20} />
        <span>{errorMsg}</span>
      </div>
      <button onClick={() => navigate('/')} className="btn btn-ghost">Back to join</button>
    </div>
  );

  // ─── Active question (intentionally dark — game UX) ───────────────────────
  if (phase === 'question' || phase === 'submitted') return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col">
      <div className="h-2 bg-gray-700">
        <div
          className="h-full bg-indigo-500 transition-all duration-1000"
          style={{ width: `${(remainingMs / (question?.timeLimitMs ?? 1)) * 100}%` }}
        />
      </div>

      <div className="flex-1 flex flex-col p-6 gap-6">
        <div className="flex items-center justify-between text-sm text-gray-400">
          <span>{question?.questionIndex != null ? `Q${question.questionIndex + 1}/${question.totalQuestions}` : ''}</span>
          <span className="font-mono text-white text-lg">{Math.ceil(remainingMs / 1000)}s</span>
        </div>

        <h2 className="text-xl font-bold text-center">{question?.text}</h2>

        <div className="grid grid-cols-2 gap-3 flex-1">
          {question?.answers.map((a, i) => {
            const isSelected = selected.includes(a.id);
            return (
              <button
                key={a.id}
                onClick={() => phase === 'question' && toggleAnswer(a.id)}
                disabled={phase === 'submitted'}
                className={`${ANSWER_COLORS[i % 4]} rounded-xl p-4 flex items-center justify-center text-center transition-all ${
                  isSelected ? 'ring-4 ring-white' : phase === 'question' && selected.length > 0 ? 'opacity-40' : ''
                } disabled:cursor-default`}
              >
                <span className={getAnswerFontClass(a.text)}>
                  {isSelected && <span className="mr-1">✓</span>}
                  {a.text}
                </span>
              </button>
            );
          })}
        </div>

        {question?.type === QuestionType.MULTIPLE && phase === 'question' && selected.length > 0 && (
          <button onClick={submitAnswer} className="btn btn-neutral w-full text-lg">
            Confirm ({selected.length} selected)
          </button>
        )}

        {phase === 'submitted' && (
          <p className="text-center text-gray-400 text-sm">Answer submitted — waiting for results…</p>
        )}
      </div>
    </div>
  );

  // ─── Leaderboard + personal result ────────────────────────────────────────
  if (phase === 'leaderboard') {
    const myRank = rankings.find((r) => r.nickname.toLowerCase() === nickname.toLowerCase());
    const answered = selected.length > 0;
    const speedPct = result && question
      ? Math.round((result.pointsEarned / question.maxPoints) * 100)
      : 0;
    const responseSeconds = result ? (result.responseTimeMs / 1000).toFixed(1) : null;

    return (
      <div className="min-h-screen bg-base-200 flex flex-col p-4 gap-4">
        {/* Personal result card */}
        {answered ? (
          <div className={`card shadow-sm border ${
            result?.correct ? 'bg-success/10 border-success' : 'bg-error/10 border-error'
          }`}>
            <div className="card-body items-center text-center py-5 gap-1">
              {result?.correct
                ? <CheckCircle2 size={44} className="text-success" />
                : <XCircle size={44} className="text-error" />
              }
              <h3 className="text-xl font-bold mt-1">
                {result ? (result.correct ? 'Correct!' : 'Incorrect') : '…'}
              </h3>
              {result?.correct ? (
                <>
                  <p className="text-4xl font-mono font-bold text-success mt-1">
                    +{result.pointsEarned}
                  </p>
                  <p className="text-base-content/50 text-sm">
                    {responseSeconds}s · Speed {speedPct}%
                  </p>
                </>
              ) : (
                responseSeconds && (
                  <p className="text-base-content/50 text-sm">Answered in {responseSeconds}s</p>
                )
              )}
              <p className="text-base-content/60 text-sm mt-1">
                Total:{' '}
                <span className="font-mono font-bold text-base-content">
                  {result?.newScore ?? 0}
                </span>{' '}
                pts
              </p>
            </div>
          </div>
        ) : (
          <div className="card bg-base-100 shadow-sm border border-base-300">
            <div className="card-body items-center text-center py-5 gap-1">
              <Clock size={44} className="text-base-content/30" />
              <h3 className="text-lg font-bold mt-1">Time's up!</h3>
              <p className="text-base-content/50 text-sm">You didn't answer in time</p>
            </div>
          </div>
        )}

        {/* Rankings */}
        <div className="space-y-2">
          <h2 className="text-xs font-semibold text-base-content/40 uppercase tracking-wider">
            Leaderboard
          </h2>
          {rankings.slice(0, 5).map((r) => {
            const isMe = r.nickname.toLowerCase() === nickname.toLowerCase();
            return (
              <div
                key={r.nickname}
                className={`flex items-center gap-3 rounded-lg px-4 py-3 ${
                  isMe ? 'bg-primary text-primary-content font-bold' : 'bg-base-100'
                }`}
              >
                <span className={`w-5 text-sm ${isMe ? 'text-primary-content/60' : 'text-base-content/40'}`}>
                  {r.rank}
                </span>
                <span className="flex-1">{r.nickname}</span>
                <span className="font-mono">{r.score}</span>
                {r.delta !== undefined && r.delta > 0 && (
                  <span className={`text-sm ${isMe ? 'text-primary-content/80' : 'text-success'}`}>
                    +{r.delta}
                  </span>
                )}
              </div>
            );
          })}
          {myRank && myRank.rank > 5 && (
            <div className="flex items-center gap-3 rounded-lg px-4 py-3 bg-primary text-primary-content font-bold">
              <span className="w-5 text-sm text-primary-content/60">{myRank.rank}</span>
              <span className="flex-1">{myRank.nickname}</span>
              <span className="font-mono">{myRank.score}</span>
            </div>
          )}
        </div>

        <p className="text-center text-base-content/30 text-xs">Next question coming up…</p>
      </div>
    );
  }

  // ─── Finished ─────────────────────────────────────────────────────────────
  if (phase === 'finished') {
    const myRank = rankings.find((r) => r.nickname.toLowerCase() === nickname.toLowerCase());
    return (
      <div className="min-h-screen bg-base-200 flex flex-col p-6 items-center">
        <h2 className="text-3xl font-bold text-center mb-2 mt-8">Game Over!</h2>
        {myRank && (
          <p className="text-primary text-xl mb-8">
            You finished #{myRank.rank} with {myRank.score} pts
          </p>
        )}
        <div className="space-y-2 w-full max-w-sm">
          {rankings.map((r) => {
            const isMe = r.nickname.toLowerCase() === nickname.toLowerCase();
            return (
              <div
                key={r.nickname}
                className={`flex items-center gap-3 rounded-lg px-4 py-3 ${
                  isMe ? 'bg-primary text-primary-content font-bold' : 'bg-base-100'
                }`}
              >
                <span className={`w-5 text-sm ${isMe ? 'text-primary-content/60' : 'text-base-content/40'}`}>
                  {r.rank}
                </span>
                <span className="flex-1">{r.nickname}</span>
                <span className="font-mono">{r.score}</span>
              </div>
            );
          })}
        </div>
        <button
          onClick={() => { disconnectSocket(); navigate('/'); }}
          className="btn btn-ghost mt-8"
        >
          Play again
        </button>
      </div>
    );
  }

  return null;
}
