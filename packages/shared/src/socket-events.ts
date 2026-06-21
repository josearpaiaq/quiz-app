import { QuestionType } from './enums';

// ─── Client → Server ─────────────────────────────────────────────────────────

export interface SessionJoinPayload {
  code: string;
  firstName: string;
  lastName: string;
  nickname: string;
}

export interface SessionHostJoinPayload {
  code: string;
}

export interface SessionStartPayload {
  sessionId: string;
}

export interface SessionNextPayload {
  sessionId: string;
}

export interface AnswerSubmitPayload {
  questionId: string;
  answerIds: string[];
}

// ─── Server → Client ─────────────────────────────────────────────────────────

export interface PlayerJoinedPayload {
  nickname: string;
  totalPlayers: number;
  rejoined?: boolean;
  score?: number;
}

export interface AnswerOption {
  id: string;
  text: string;
}

export interface QuestionStartPayload {
  questionId: string;
  text: string;
  type: QuestionType;
  answers: AnswerOption[];
  timeLimitMs: number;
  maxPoints: number;
  questionIndex: number;
  totalQuestions: number;
}

export interface QuestionTickPayload {
  remainingMs: number;
}

export interface QuestionEndPayload {
  correctAnswerIds: string[];
}

export interface AnswerResultPayload {
  correct: boolean;
  pointsEarned: number;
  newScore: number;
}

export interface RankingEntry {
  rank: number;
  nickname: string;
  score: number;
  delta?: number;
}

export interface LeaderboardUpdatePayload {
  rankings: RankingEntry[];
}

export interface SessionFinishedPayload {
  finalRankings: RankingEntry[];
}

export interface SocketErrorPayload {
  message: string;
}

// ─── Event name constants ─────────────────────────────────────────────────────

export const SOCKET_EVENTS = {
  // C → S
  SESSION_JOIN: 'session:join',
  SESSION_HOST_JOIN: 'session:host_join',
  SESSION_START: 'session:start',
  SESSION_NEXT: 'session:next',
  ANSWER_SUBMIT: 'answer:submit',

  // S → C
  PLAYER_JOINED: 'player:joined',
  QUESTION_START: 'question:start',
  QUESTION_TICK: 'question:tick',
  QUESTION_END: 'question:end',
  ANSWER_RESULT: 'answer:result',
  LEADERBOARD_UPDATE: 'leaderboard:update',
  SESSION_FINISHED: 'session:finished',
  ERROR: 'error',
} as const;
