import {
  Controller, Get, Post, Put, Delete, Body, Param,
  UseGuards, Request, HttpCode,
} from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { QuizzesService } from './quizzes.service';
import { CreateQuizDto } from './dto/create-quiz.dto';
import { UpdateQuizDto } from './dto/update-quiz.dto';
import { CreateQuestionDto } from './dto/create-question.dto';
import { UpdateQuestionDto } from './dto/update-question.dto';
import { CreateAnswerDto } from './dto/create-answer.dto';
import { UpdateAnswerDto } from './dto/update-answer.dto';

@UseGuards(JwtAuthGuard)
@Controller()
export class QuizzesController {
  constructor(private readonly service: QuizzesService) {}

  // Quizzes
  @Get('quizzes')
  list(@Request() req: any) {
    return this.service.findAllByHost(req.user.id);
  }

  @Post('quizzes')
  create(@Request() req: any, @Body() dto: CreateQuizDto) {
    return this.service.create(req.user.id, dto);
  }

  @Get('quizzes/:id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Put('quizzes/:id')
  update(@Param('id') id: string, @Request() req: any, @Body() dto: UpdateQuizDto) {
    return this.service.update(id, req.user.id, dto);
  }

  @Delete('quizzes/:id')
  @HttpCode(204)
  remove(@Param('id') id: string, @Request() req: any) {
    return this.service.remove(id, req.user.id);
  }

  // Questions
  @Post('quizzes/:id/questions')
  addQuestion(@Param('id') quizId: string, @Request() req: any, @Body() dto: CreateQuestionDto) {
    return this.service.addQuestion(quizId, req.user.id, dto);
  }

  @Put('questions/:id')
  updateQuestion(@Param('id') id: string, @Request() req: any, @Body() dto: UpdateQuestionDto) {
    return this.service.updateQuestion(id, req.user.id, dto);
  }

  @Delete('questions/:id')
  @HttpCode(204)
  removeQuestion(@Param('id') id: string, @Request() req: any) {
    return this.service.removeQuestion(id, req.user.id);
  }

  // Answers
  @Post('questions/:id/answers')
  addAnswer(@Param('id') questionId: string, @Request() req: any, @Body() dto: CreateAnswerDto) {
    return this.service.addAnswer(questionId, req.user.id, dto);
  }

  @Put('answers/:id')
  updateAnswer(@Param('id') id: string, @Request() req: any, @Body() dto: UpdateAnswerDto) {
    return this.service.updateAnswer(id, req.user.id, dto);
  }

  @Delete('answers/:id')
  @HttpCode(204)
  removeAnswer(@Param('id') id: string, @Request() req: any) {
    return this.service.removeAnswer(id, req.user.id);
  }
}
