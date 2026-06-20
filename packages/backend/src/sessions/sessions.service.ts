import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SessionEntity } from '../database/entities/session.entity';
import { QuizEntity } from '../database/entities/quiz.entity';

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

@Injectable()
export class SessionsService {
  constructor(
    @InjectRepository(SessionEntity) private readonly sessions: Repository<SessionEntity>,
    @InjectRepository(QuizEntity) private readonly quizzes: Repository<QuizEntity>,
  ) {}

  async create(quizId: string, hostId: string) {
    const quiz = await this.quizzes.findOneBy({ id: quizId });
    if (!quiz) throw new NotFoundException('Quiz not found');
    if (quiz.hostId !== hostId) throw new ForbiddenException();

    const code = await this.generateUniqueCode();
    const session = this.sessions.create({ quizId, hostId, code });
    const saved = await this.sessions.save(session);
    return { sessionId: saved.id, code: saved.code };
  }

  async findByCode(code: string) {
    const session = await this.sessions.findOne({
      where: { code: code.toUpperCase() },
      relations: { participants: true },
    });
    if (!session) throw new NotFoundException('Session not found');
    return session;
  }

  private async generateUniqueCode(): Promise<string> {
    while (true) {
      const code = Array.from({ length: 6 }, () =>
        CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)],
      ).join('');

      const existing = await this.sessions.findOneBy({ code });
      if (!existing) return code;
    }
  }
}
