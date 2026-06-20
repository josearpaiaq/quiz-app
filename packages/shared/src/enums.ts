export const SessionStatus = {
  WAITING: 'WAITING',
  ACTIVE: 'ACTIVE',
  FINISHED: 'FINISHED',
} as const;
export type SessionStatus = (typeof SessionStatus)[keyof typeof SessionStatus];

export const QuestionType = {
  SINGLE: 'SINGLE',
  MULTIPLE: 'MULTIPLE',
} as const;
export type QuestionType = (typeof QuestionType)[keyof typeof QuestionType];
