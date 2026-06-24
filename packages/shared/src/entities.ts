import { QuestionType, SessionStatus } from './enums';

export interface UserEntity {
  id: string;
  email: string;
  createdAt: Date;
}

export interface QuizEntity {
  id: string;
  hostId: string;
  title: string;
  description: string | null;
  createdAt: Date;
}

export interface QuestionEntity {
  id: string;
  quizId: string;
  text: string;
  type: QuestionType;
  timeLimit: number;
  maxPoints: number;
  order: number;
}

export interface AnswerEntity {
  id: string;
  questionId: string;
  text: string;
  isCorrect: boolean;
  order: number;
  createdAt: Date;
}

export interface SessionEntity {
  id: string;
  quizId: string;
  hostId: string;
  code: string;
  status: SessionStatus;
  currentQuestionIdx: number;
  startedAt: Date | null;
  finishedAt: Date | null;
  createdAt: Date;
}

export interface ParticipantEntity {
  id: string;
  sessionId: string;
  nickname: string;
  score: number;
  joinedAt: Date;
}

export interface ParticipantAnswerEntity {
  id: string;
  participantId: string;
  questionId: string;
  answerIds: string[];
  responseTimeMs: number;
  pointsEarned: number;
  answeredAt: Date;
}
