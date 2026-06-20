import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SessionEntity } from '../database/entities/session.entity';
import { ParticipantEntity } from '../database/entities/participant.entity';
import { ParticipantAnswerEntity } from '../database/entities/participant-answer.entity';
import { QuizEntity } from '../database/entities/quiz.entity';
import { QuestionEntity } from '../database/entities/question.entity';
import { AnswerEntity } from '../database/entities/answer.entity';
import { QuizGateway } from './quiz.gateway';
import { ScoringService } from './scoring.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      SessionEntity,
      ParticipantEntity,
      ParticipantAnswerEntity,
      QuizEntity,
      QuestionEntity,
      AnswerEntity,
    ]),
    AuthModule,
  ],
  providers: [QuizGateway, ScoringService],
})
export class QuizGatewayModule {}
