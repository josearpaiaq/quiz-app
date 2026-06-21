import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as xlsx from 'xlsx';
import { QuizEntity } from '../database/entities/quiz.entity';
import { QuestionEntity } from '../database/entities/question.entity';
import { AnswerEntity } from '../database/entities/answer.entity';
import { CreateQuizDto } from './dto/create-quiz.dto';
import { UpdateQuizDto } from './dto/update-quiz.dto';
import { CreateQuestionDto } from './dto/create-question.dto';
import { UpdateQuestionDto } from './dto/update-question.dto';
import { CreateAnswerDto } from './dto/create-answer.dto';
import { UpdateAnswerDto } from './dto/update-answer.dto';
import { QuestionType } from '@quiz/shared';

interface ParsedQuestion {
  text: string;
  type: QuestionType;
  timeLimit: number;
  maxPoints: number;
  answers: { text: string; isCorrect: boolean }[];
}

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
      order: { questions: { order: 'ASC', answers: { order: 'ASC', createdAt: 'ASC' } } },
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
    const count = await this.answers.count({ where: { questionId } });
    const answer = this.answers.create({ questionId, ...dto, order: count });
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

  async reorderAnswers(questionId: string, hostId: string, answerIds: string[]) {
    const question = await this.questions.findOne({ where: { id: questionId }, relations: { quiz: true } });
    if (!question) throw new NotFoundException('Question not found');
    this.assertOwner(question.quiz, hostId);
    await Promise.all(answerIds.map((id, index) => this.answers.update({ id }, { order: index })));
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

  async importFromSpreadsheet(
    hostId: string,
    title: string,
    file: Express.Multer.File,
  ): Promise<QuizEntity> {
    if (!file) throw new BadRequestException('File is required');

    const isCSV = file.originalname.toLowerCase().endsWith('.csv');
    const wb = isCSV
      ? xlsx.read(file.buffer.toString('utf-8'), { type: 'string' })
      : xlsx.read(file.buffer, { type: 'buffer' });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const rows = xlsx.utils.sheet_to_json<Record<string, string>>(sheet, { defval: '', raw: false });

    if (rows.length === 0) throw new BadRequestException('Spreadsheet has no data rows');

    const errors: string[] = [];
    const parsed: ParsedQuestion[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2;

      const questionText = row['question']?.trim();
      if (!questionText) {
        errors.push(`Row ${rowNum}: "question" column is required`);
        continue;
      }

      const rawType = row['type']?.trim().toUpperCase();
      const type: QuestionType =
        rawType === QuestionType.MULTIPLE ? QuestionType.MULTIPLE : QuestionType.SINGLE;

      const timeLimit = parseInt(row['time_limit'] || '30', 10);
      if (isNaN(timeLimit) || timeLimit < 5) {
        errors.push(`Row ${rowNum}: "time_limit" must be a number >= 5`);
        continue;
      }

      const maxPoints = parseInt(row['max_points'] || '1000', 10);
      if (isNaN(maxPoints) || maxPoints < 1) {
        errors.push(`Row ${rowNum}: "max_points" must be a number >= 1`);
        continue;
      }

      const answers: { text: string; isCorrect: boolean }[] = [];
      for (let a = 1; a <= 4; a++) {
        const text = row[`answer${a}`]?.trim();
        if (!text) continue;
        const raw = row[`answer${a}_correct`]?.trim().toLowerCase();
        answers.push({ text, isCorrect: raw === 'true' || raw === '1' || raw === 'yes' });
      }

      if (answers.length < 2) {
        errors.push(`Row ${rowNum}: at least 2 answers are required`);
        continue;
      }
      if (!answers.some((a) => a.isCorrect)) {
        errors.push(`Row ${rowNum}: at least 1 answer must be marked correct`);
        continue;
      }
      if (type === QuestionType.SINGLE && answers.filter((a) => a.isCorrect).length > 1) {
        errors.push(`Row ${rowNum}: SINGLE type can only have 1 correct answer`);
        continue;
      }

      parsed.push({ text: questionText, type, timeLimit, maxPoints, answers });
    }

    if (errors.length > 0) throw new BadRequestException(errors.join('\n'));

    const quiz = await this.quizzes.save(
      this.quizzes.create({ hostId, title: title?.trim() || 'Imported Quiz' }),
    );

    for (let i = 0; i < parsed.length; i++) {
      const { answers: ans, ...qData } = parsed[i];
      const question = await this.questions.save(
        this.questions.create({ quizId: quiz.id, ...qData, order: i + 1 }),
      );
      await this.answers.save(ans.map((a, idx) => this.answers.create({ questionId: question.id, ...a, order: idx })));
    }

    return this.findOne(quiz.id);
  }

  private assertOwner(quiz: QuizEntity, hostId: string) {
    if (quiz.hostId !== hostId) throw new ForbiddenException();
  }
}
