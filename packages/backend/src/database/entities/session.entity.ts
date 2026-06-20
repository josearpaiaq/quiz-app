import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
  ManyToOne, OneToMany, JoinColumn,
} from 'typeorm';
import { QuizEntity } from './quiz.entity';
import { ParticipantEntity } from './participant.entity';
import { SessionStatus } from '@quiz/shared';

@Entity('sessions')
export class SessionEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'quiz_id' })
  quizId: string;

  @ManyToOne(() => QuizEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'quiz_id' })
  quiz: QuizEntity;

  @Column({ name: 'host_id' })
  hostId: string;

  @Column({ unique: true, length: 6 })
  code: string;

  @Column({ type: 'varchar', length: 10, default: SessionStatus.WAITING })
  status: SessionStatus;

  @Column({ name: 'current_question_idx', default: -1 })
  currentQuestionIdx: number;

  @Column({ name: 'started_at', type: 'timestamp', nullable: true })
  startedAt: Date | null;

  @Column({ name: 'finished_at', type: 'timestamp', nullable: true })
  finishedAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @OneToMany(() => ParticipantEntity, (p) => p.session, { cascade: true })
  participants: ParticipantEntity[];
}
