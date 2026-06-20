import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { UserEntity } from './entities/user.entity';
import { QuizEntity } from './entities/quiz.entity';
import { QuestionEntity } from './entities/question.entity';
import { AnswerEntity } from './entities/answer.entity';
import { SessionEntity } from './entities/session.entity';
import { ParticipantEntity } from './entities/participant.entity';
import { ParticipantAnswerEntity } from './entities/participant-answer.entity';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      url: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      entities: [
        UserEntity,
        QuizEntity,
        QuestionEntity,
        AnswerEntity,
        SessionEntity,
        ParticipantEntity,
        ParticipantAnswerEntity,
      ],
      synchronize: process.env.NODE_ENV !== 'production',
    }),
  ],
  exports: [TypeOrmModule],
})
export class DatabaseModule {}
