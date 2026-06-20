import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { QuizEntity } from '../database/entities/quiz.entity';
import { QuestionEntity } from '../database/entities/question.entity';
import { AnswerEntity } from '../database/entities/answer.entity';
import { CreateQuizDto } from './dto/create-quiz.dto';
import { UpdateQuizDto } from './dto/update-quiz.dto';
import { CreateQuestionDto } from './dto/create-question.dto';
import { UpdateQuestionDto } from './dto/update-question.dto';
import { CreateAnswerDto } from './dto/create-answer.dto';
import { UpdateAnswerDto } from './dto/update-answer.dto';

@Injectable()
export class QuizzesService {
  constructor(
    @InjectRepository(QuizEntity) private readonly quizzes: Repository<QuizEntity>,
    @InjectRepository(QuestionEntity) private readonly questions: Repository<QuestionEntity>,
    @InjectRepository(AnswerEntity) private readonly answers: Repository<AnswerEntity>,
  ) {}

  findAllByHost(hostId: string) {
    return this.quizzes.find({ where: { hostId }, order: { createdAt: 'DESC' } });
  }

  async findOne(id: string) {
    const quiz = await this.quizzes.findOne({
      where: { id },
      relations: { questions: { answers: true } },
      order: { questions: { order: 'ASC' } },
    });
    if (!quiz) throw new NotFoundException('Quiz not found');
    return quiz;
  }

  create(hostId: string, dto: CreateQuizDto) {
    const quiz = this.quizzes.create({ hostId, ...dto });
    return this.quizzes.save(quiz);
  }

  async update(id: string, hostId: string, dto: UpdateQuizDto) {
    const quiz = await this.findOne(id);
    this.assertOwner(quiz, hostId);
    Object.assign(quiz, dto);
    return this.quizzes.save(quiz);
  }

  async remove(id: string, hostId: string) {
    const quiz = await this.findOne(id);
    this.assertOwner(quiz, hostId);
    await this.quizzes.remove(quiz);
  }

  async addQuestion(quizId: string, hostId: string, dto: CreateQuestionDto) {
    const quiz = await this.findOne(quizId);
    this.assertOwner(quiz, hostId);
    const question = this.questions.create({ quizId, ...dto, maxPoints: dto.maxPoints ?? 1000 });
    return this.questions.save(question);
  }

  async updateQuestion(id: string, hostId: string, dto: UpdateQuestionDto) {
    const question = await this.questions.findOne({ where: { id }, relations: { quiz: true } });
    if (!question) throw new NotFoundException('Question not found');
    this.assertOwner(question.quiz, hostId);
    Object.assign(question, dto);
    return this.questions.save(question);
  }

  async removeQuestion(id: string, hostId: string) {
    const question = await this.questions.findOne({ where: { id }, relations: { quiz: true } });
    if (!question) throw new NotFoundException('Question not found');
    this.assertOwner(question.quiz, hostId);
    await this.questions.remove(question);
  }

  async addAnswer(questionId: string, hostId: string, dto: CreateAnswerDto) {
    const question = await this.questions.findOne({ where: { id: questionId }, relations: { quiz: true } });
    if (!question) throw new NotFoundException('Question not found');
    this.assertOwner(question.quiz, hostId);
    const answer = this.answers.create({ questionId, ...dto });
    return this.answers.save(answer);
  }

  async updateAnswer(id: string, hostId: string, dto: UpdateAnswerDto) {
    const answer = await this.answers.findOne({
      where: { id },
      relations: { question: { quiz: true } },
    });
    if (!answer) throw new NotFoundException('Answer not found');
    this.assertOwner(answer.question.quiz, hostId);
    Object.assign(answer, dto);
    return this.answers.save(answer);
  }

  async removeAnswer(id: string, hostId: string) {
    const answer = await this.answers.findOne({
      where: { id },
      relations: { question: { quiz: true } },
    });
    if (!answer) throw new NotFoundException('Answer not found');
    this.assertOwner(answer.question.quiz, hostId);
    await this.answers.remove(answer);
  }

  private assertOwner(quiz: QuizEntity, hostId: string) {
    if (quiz.hostId !== hostId) throw new ForbiddenException();
  }
}
