import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getSocket, joinSession, disconnectSocket } from '../../lib/socket';
import { SOCKET_EVENTS, QuestionType } from '@quiz/shared';
import type {
  QuestionStartPayload, QuestionTickPayload, QuestionEndPayload,
  AnswerResultPayload, LeaderboardUpdatePayload, SessionFinishedPayload,
  RankingEntry,
} from '@quiz/shared';

type Phase = 'waiting' | 'question' | 'submitted' | 'result' | 'leaderboard' | 'finished' | 'error';

export function ParticipantSessionPage() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();

  const [phase, setPhase] = useState<Phase>('waiting');
  const [question, setQuestion] = useState<QuestionStartPayload | null>(null);
  const [remainingMs, setRemainingMs] = useState(0);
  const [selected, setSelected] = useState<string[]>([]);
  const [result, setResult] = useState<AnswerResultPayload | null>(null);
  const [correctIds, setCorrectIds] = useState<string[]>([]);
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

    socket.on(SOCKET_EVENTS.QUESTION_START, (data: QuestionStartPayload) => {
      setQuestion(data);
      setSelected([]);
      setResult(null);
      setCorrectIds([]);
      setRemainingMs(data.timeLimitMs);
      setPhase('question');
    });

    socket.on(SOCKET_EVENTS.QUESTION_TICK, (data: QuestionTickPayload) => {
      setRemainingMs(data.remainingMs);
    });

    socket.on(SOCKET_EVENTS.QUESTION_END, (data: QuestionEndPayload) => {
      setCorrectIds(data.correctAnswerIds);
    });

    socket.on(SOCKET_EVENTS.ANSWER_RESULT, (data: AnswerResultPayload) => {
      setResult(data);
      setPhase('result');
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

  // Auto-submit when a SINGLE answer is selected
  useEffect(() => {
    if (question?.type === QuestionType.SINGLE && selected.length === 1 && phase === 'question') {
      submitAnswer();
    }
  }, [selected]); // eslint-disable-line react-hooks/exhaustive-deps

  const ANSWER_COLORS = ['bg-red-600', 'bg-blue-600', 'bg-yellow-500', 'bg-green-600'];

  if (phase === 'waiting') return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col items-center justify-center gap-4">
      <div className="w-12 h-12 rounded-full bg-indigo-600 flex items-center justify-center text-xl font-bold">
        {nickname[0]?.toUpperCase()}
      </div>
      <h2 className="text-2xl font-bold">{nickname}</h2>
      <p className="text-gray-400">{totalPlayers} player{totalPlayers !== 1 ? 's' : ''} in lobby</p>
      <p className="text-gray-500 text-sm mt-4">Waiting for host to start…</p>
    </div>
  );

  if (phase === 'error') return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col items-center justify-center gap-4">
      <p className="text-red-400 text-xl">{errorMsg}</p>
      <button onClick={() => navigate('/')} className="text-indigo-400 underline">Back to join</button>
    </div>
  );

  if (phase === 'question' || phase === 'submitted') return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col">
      {/* Timer bar */}
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
                className={`${ANSWER_COLORS[i % 4]} rounded-xl p-4 text-left font-medium transition-all ${
                  isSelected ? 'ring-4 ring-white' : phase === 'question' && selected.length > 0 ? 'opacity-40' : ''
                } disabled:cursor-default`}
              >
                {isSelected && <span className="mr-2">✓</span>}
                {a.text}
              </button>
            );
          })}
        </div>

        {question?.type === QuestionType.MULTIPLE && phase === 'question' && selected.length > 0 && (
          <button
            onClick={submitAnswer}
            className="w-full bg-white text-gray-900 font-bold py-4 rounded-xl text-lg"
          >
            Confirm ({selected.length} selected)
          </button>
        )}

        {/* SINGLE auto-submits via useEffect below */}

        {phase === 'submitted' && (
          <p className="text-center text-gray-400">Answer submitted — waiting for others…</p>
        )}
      </div>
    </div>
  );

  if (phase === 'result') return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col items-center justify-center gap-6 p-6">
      <div className={`text-6xl ${result?.correct ? '🎉' : '😢'}`}>
        {result?.correct ? '🎉' : '😢'}
      </div>
      <h2 className="text-3xl font-bold">{result?.correct ? 'Correct!' : 'Incorrect'}</h2>
      {result?.correct && (
        <p className="text-indigo-400 text-2xl font-mono">+{result.pointsEarned} pts</p>
      )}
      <p className="text-gray-400">Score: {result?.newScore ?? 0}</p>

      {/* Show correct answers */}
      {question && (
        <div className="w-full max-w-sm space-y-2 mt-4">
          {question.answers.map((a) => (
            <div
              key={a.id}
              className={`rounded-lg px-4 py-3 text-sm ${
                correctIds.includes(a.id) ? 'bg-green-700 font-bold' : 'bg-gray-800 text-gray-400'
              }`}
            >
              {correctIds.includes(a.id) && '✓ '}{a.text}
            </div>
          ))}
        </div>
      )}

      <p className="text-gray-500 text-sm mt-4">Waiting for leaderboard…</p>
    </div>
  );

  if (phase === 'leaderboard') {
    const myRank = rankings.find((r) => r.nickname.toLowerCase() === nickname.toLowerCase());
    return (
      <div className="min-h-screen bg-gray-950 text-white flex flex-col p-6">
        <h2 className="text-2xl font-bold text-center mb-6">Leaderboard</h2>
        <div className="space-y-2 max-w-sm mx-auto w-full">
          {rankings.slice(0, 5).map((r) => (
            <div
              key={r.nickname}
              className={`flex items-center gap-3 rounded-lg px-4 py-3 ${
                r.nickname.toLowerCase() === nickname.toLowerCase()
                  ? 'bg-indigo-700 font-bold'
                  : 'bg-gray-800'
              }`}
            >
              <span className="text-gray-400 w-5 text-sm">{r.rank}</span>
              <span className="flex-1">{r.nickname}</span>
              <span className="font-mono">{r.score}</span>
              {r.delta !== undefined && r.delta > 0 && (
                <span className="text-green-400 text-sm">+{r.delta}</span>
              )}
            </div>
          ))}
        </div>
        {myRank && myRank.rank > 5 && (
          <div className="flex items-center gap-3 rounded-lg px-4 py-3 bg-indigo-700 font-bold mt-4 max-w-sm mx-auto w-full">
            <span className="w-5 text-sm">{myRank.rank}</span>
            <span className="flex-1">{myRank.nickname}</span>
            <span className="font-mono">{myRank.score}</span>
          </div>
        )}
        <p className="text-center text-gray-500 text-sm mt-6">Next question coming up…</p>
      </div>
    );
  }

  if (phase === 'finished') {
    const myRank = rankings.find((r) => r.nickname.toLowerCase() === nickname.toLowerCase());
    return (
      <div className="min-h-screen bg-gray-950 text-white flex flex-col p-6 items-center">
        <h2 className="text-3xl font-bold text-center mb-2 mt-8">Game Over!</h2>
        {myRank && (
          <p className="text-indigo-400 text-xl mb-8">
            You finished #{myRank.rank} with {myRank.score} pts
          </p>
        )}
        <div className="space-y-2 w-full max-w-sm">
          {rankings.map((r) => (
            <div
              key={r.nickname}
              className={`flex items-center gap-3 rounded-lg px-4 py-3 ${
                r.nickname.toLowerCase() === nickname.toLowerCase()
                  ? 'bg-indigo-700 font-bold'
                  : 'bg-gray-800'
              }`}
            >
              <span className="text-gray-400 w-5 text-sm">{r.rank}</span>
              <span className="flex-1">{r.nickname}</span>
              <span className="font-mono">{r.score}</span>
            </div>
          ))}
        </div>
        <button
          onClick={() => { disconnectSocket(); navigate('/'); }}
          className="mt-8 bg-gray-800 hover:bg-gray-700 px-6 py-3 rounded-xl font-medium transition-colors"
        >
          Play again
        </button>
      </div>
    );
  }

  return null;
}
