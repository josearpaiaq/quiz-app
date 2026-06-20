import {
  Entity, PrimaryGeneratedColumn, Column,
  ManyToOne, OneToMany, JoinColumn,
} from 'typeorm';
import { QuizEntity } from './quiz.entity';
import { AnswerEntity } from './answer.entity';
import { QuestionType } from '@quiz/shared';

@Entity('questions')
export class QuestionEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'quiz_id' })
  quizId: string;

  @ManyToOne(() => QuizEntity, (quiz) => quiz.questions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'quiz_id' })
  quiz: QuizEntity;

  @Column({ type: 'text' })
  text: string;

  @Column({ type: 'varchar', length: 8 })
  type: QuestionType;

  @Column({ name: 'time_limit' })
  timeLimit: number;

  @Column({ name: 'max_points', default: 1000 })
  maxPoints: number;

  @Column()
  order: number;

  @OneToMany(() => AnswerEntity, (a) => a.question, { cascade: true })
  answers: AnswerEntity[];
}
