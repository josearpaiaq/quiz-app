import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
  ManyToOne, OneToMany, JoinColumn,
} from 'typeorm';
import { SessionEntity } from './session.entity';
import { ParticipantAnswerEntity } from './participant-answer.entity';

@Entity('participants')
export class ParticipantEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'session_id' })
  sessionId: string;

  @ManyToOne(() => SessionEntity, (s) => s.participants, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'session_id' })
  session: SessionEntity;

  @Column({ name: 'first_name' })
  firstName: string;

  @Column({ name: 'last_name' })
  lastName: string;

  @Column()
  nickname: string;

  @Column({ default: 0 })
  score: number;

  @CreateDateColumn({ name: 'joined_at' })
  joinedAt: Date;

  @OneToMany(() => ParticipantAnswerEntity, (pa) => pa.participant, { cascade: true })
  answers: ParticipantAnswerEntity[];
}
