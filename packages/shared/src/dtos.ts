import { QuestionType } from './enums';

// Auth
export interface RegisterDto {
  email: string;
  password: string;
}

export interface LoginDto {
  email: string;
  password: string;
}

export interface AuthResponseDto {
  accessToken: string;
  user: { id: string; email: string };
}

// Quiz
export interface CreateQuizDto {
  title: string;
  description?: string;
}

export interface UpdateQuizDto {
  title?: string;
  description?: string;
}

// Question
export interface CreateQuestionDto {
  text: string;
  type: QuestionType;
  timeLimit: number;
  maxPoints?: number;
  order: number;
}

export interface UpdateQuestionDto {
  text?: string;
  type?: QuestionType;
  timeLimit?: number;
  maxPoints?: number;
  order?: number;
}

// Answer
export interface CreateAnswerDto {
  text: string;
  isCorrect: boolean;
}

export interface UpdateAnswerDto {
  text?: string;
  isCorrect?: boolean;
}

// Session
export interface CreateSessionDto {
  quizId: string;
}

export interface CreateSessionResponseDto {
  sessionId: string;
  code: string;
}
