import { Injectable } from '@nestjs/common';
import { AnswerEntity } from '../database/entities/answer.entity';
import { QuestionEntity } from '../database/entities/question.entity';
import { QuestionType } from '@quiz/shared';

@Injectable()
export class ScoringService {
  calculate(
    question: QuestionEntity,
    correctAnswers: AnswerEntity[],
    selectedIds: string[],
    responseTimeMs: number,
  ): number {
    const correctIds = new Set(correctAnswers.filter((a) => a.isCorrect).map((a) => a.id));
    const selectedSet = new Set(selectedIds);

    let correct: boolean;

    if (question.type === QuestionType.SINGLE) {
      const [correctId] = [...correctIds];
      correct = selectedSet.size === 1 && selectedSet.has(correctId);
    } else {
      correct =
        selectedSet.size === correctIds.size &&
        [...selectedSet].every((id) => correctIds.has(id));
    }

    if (!correct) return 0;

    const timeLimitMs = question.timeLimit * 1000;
    const ratio = Math.max(0.5, 1 - responseTimeMs / timeLimitMs);
    return Math.round(question.maxPoints * ratio);
  }

  buildLeaderboard(
    scores: Array<{ nickname: string; score: number; previousScore?: number }>,
  ) {
    const sorted = [...scores].sort((a, b) => b.score - a.score);
    return sorted.map((p, i) => ({
      rank: i + 1,
      nickname: p.nickname,
      score: p.score,
      delta: p.previousScore !== undefined ? p.score - p.previousScore : undefined,
    }));
  }
}
