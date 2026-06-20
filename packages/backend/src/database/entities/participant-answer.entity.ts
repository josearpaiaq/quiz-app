import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
  ManyToOne, JoinColumn,
} from 'typeorm';
import { ParticipantEntity } from './participant.entity';
import { QuestionEntity } from './question.entity';

@Entity('participant_answers')
export class ParticipantAnswerEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'participant_id' })
  participantId: string;

  @ManyToOne(() => ParticipantEntity, (p) => p.answers, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'participant_id' })
  participant: ParticipantEntity;

  @Column({ name: 'question_id' })
  questionId: string;

  @ManyToOne(() => QuestionEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'question_id' })
  question: QuestionEntity;

  @Column({ name: 'answer_ids', type: 'jsonb' })
  answerIds: string[];

  @Column({ name: 'response_time_ms' })
  responseTimeMs: number;

  @Column({ name: 'points_earned' })
  pointsEarned: number;

  @CreateDateColumn({ name: 'answered_at' })
  answeredAt: Date;
}
