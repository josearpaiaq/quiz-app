import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { QuizEntity } from '../database/entities/quiz.entity';
import { QuestionEntity } from '../database/entities/question.entity';
import { AnswerEntity } from '../database/entities/answer.entity';
import { QuizzesService } from './quizzes.service';
import { QuizzesController } from './quizzes.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([QuizEntity, QuestionEntity, AnswerEntity]),
    AuthModule,
  ],
  controllers: [QuizzesController],
  providers: [QuizzesService],
})
export class QuizzesModule {}
