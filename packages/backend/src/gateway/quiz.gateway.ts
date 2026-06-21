import {
  WebSocketGateway, WebSocketServer, SubscribeMessage,
  OnGatewayConnection, OnGatewayDisconnect, ConnectedSocket, MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, Repository } from 'typeorm';
import { SessionEntity } from '../database/entities/session.entity';
import { ParticipantEntity } from '../database/entities/participant.entity';
import { ParticipantAnswerEntity } from '../database/entities/participant-answer.entity';
import { QuizEntity } from '../database/entities/quiz.entity';
import { QuestionEntity } from '../database/entities/question.entity';
import { AnswerEntity } from '../database/entities/answer.entity';
import { ScoringService } from './scoring.service';
import { SessionStatus, SOCKET_EVENTS } from '@quiz/shared';

interface GatewaySessionState {
  sessionId: string;
  hostSocketId: string;
  phase: 'waiting' | 'question_open' | 'question_closed' | 'leaderboard' | 'finished';
  currentQuestionIdx: number;
  questionStartedAt: number | null;
  tickInterval: ReturnType<typeof setInterval> | null;
  answeredSocketIds: Set<string>;
  participantScores: Map<string, number>;
}

@WebSocketGateway({
  cors: {
    origin: process.env.FRONTEND_ORIGIN ?? 'http://localhost:5173',
    credentials: true,
  },
})
export class QuizGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server;

  private readonly sessions = new Map<string, GatewaySessionState>();
  private readonly socketToSession = new Map<string, string>();
  private readonly socketToParticipant = new Map<string, string>();

  constructor(
    private readonly jwt: JwtService,
    private readonly scoring: ScoringService,
    @InjectRepository(SessionEntity) private readonly sessionRepo: Repository<SessionEntity>,
    @InjectRepository(ParticipantEntity) private readonly participantRepo: Repository<ParticipantEntity>,
    @InjectRepository(ParticipantAnswerEntity) private readonly paRepo: Repository<ParticipantAnswerEntity>,
    @InjectRepository(QuizEntity) private readonly quizRepo: Repository<QuizEntity>,
    @InjectRepository(QuestionEntity) private readonly questionRepo: Repository<QuestionEntity>,
    @InjectRepository(AnswerEntity) private readonly answerRepo: Repository<AnswerEntity>,
  ) {}

  handleConnection() {}

  handleDisconnect(socket: Socket) {
    this.socketToSession.delete(socket.id);
    this.socketToParticipant.delete(socket.id);
  }

  @SubscribeMessage(SOCKET_EVENTS.SESSION_HOST_JOIN)
  async handleHostJoin(
    @ConnectedSocket() socket: Socket,
    @MessageBody() data: { code: string },
  ) {
    const hostId = this.resolveHostId(socket);
    if (!hostId) return socket.emit(SOCKET_EVENTS.ERROR, { message: 'Unauthorized' });

    const session = await this.sessionRepo.findOne({
      where: { code: data.code.toUpperCase() },
    });
    if (!session || session.hostId !== hostId) return;

    await socket.join(session.code);
    this.socketToSession.set(socket.id, session.code);

    let state = this.sessions.get(session.code);
    if (!state) {
      state = {
        sessionId: session.id,
        hostSocketId: socket.id,
        phase: 'waiting',
        currentQuestionIdx: -1,
        questionStartedAt: null,
        tickInterval: null,
        answeredSocketIds: new Set(),
        participantScores: new Map(),
      };
      this.sessions.set(session.code, state);
    }
    state.hostSocketId = socket.id;
  }

  @SubscribeMessage(SOCKET_EVENTS.SESSION_JOIN)
  async handleJoin(
    @ConnectedSocket() socket: Socket,
    @MessageBody() data: { code: string; firstName: string; lastName: string; nickname: string },
  ) {
    const session = await this.sessionRepo.findOne({
      where: { code: data.code.toUpperCase() },
    });

    if (!session) return socket.emit(SOCKET_EVENTS.ERROR, { message: 'Session not found' });
    if (session.status === SessionStatus.FINISHED)
      return socket.emit(SOCKET_EVENTS.ERROR, { message: 'Session already finished' });

    await socket.join(data.code.toUpperCase());

    // Check for rejoin — query DB directly to avoid race conditions
    const existing = await this.participantRepo.findOne({
      where: { sessionId: session.id, nickname: ILike(data.nickname) },
    });

    let state = this.sessions.get(session.code);
    if (!state) {
      state = {
        sessionId: session.id,
        hostSocketId: '',
        phase: 'waiting',
        currentQuestionIdx: -1,
        questionStartedAt: null,
        tickInterval: null,
        answeredSocketIds: new Set(),
        participantScores: new Map(),
      };
      this.sessions.set(session.code, state);
    }

    if (existing) {
      this.socketToParticipant.set(socket.id, existing.id);
      this.socketToSession.set(socket.id, session.code);
      state.participantScores.set(socket.id, existing.score);

      const totalPlayers = state.participantScores.size;
      this.server.to(session.code).emit(SOCKET_EVENTS.PLAYER_JOINED, {
        nickname: existing.nickname,
        firstName: existing.firstName,
        lastName: existing.lastName,
        totalPlayers,
        rejoined: true,
        score: existing.score,
      });

      // If session is already running, send current question state to the rejoining participant
      if (state.phase === 'question_open' && state.currentQuestionIdx >= 0) {
        const activeSession = await this.sessionRepo.findOne({
          where: { id: state.sessionId },
          relations: { quiz: { questions: { answers: true } } },
        });
        if (activeSession) {
          const questions = activeSession.quiz.questions.sort((a, b) => a.order - b.order);
          const question = questions[state.currentQuestionIdx];
          const elapsed = state.questionStartedAt ? Date.now() - state.questionStartedAt : 0;
          socket.emit(SOCKET_EVENTS.QUESTION_START, {
            questionId: question.id,
            text: question.text,
            type: question.type,
            answers: question.answers.map((a) => ({ id: a.id, text: a.text })),
            timeLimitMs: Math.max(1000, question.timeLimit * 1000 - elapsed),
            maxPoints: question.maxPoints,
            questionIndex: state.currentQuestionIdx,
            totalQuestions: questions.length,
          });
        }
      }
      return;
    }

    const participant = this.participantRepo.create({
      sessionId: session.id,
      firstName: data.firstName,
      lastName: data.lastName,
      nickname: data.nickname,
    });
    await this.participantRepo.save(participant);

    this.socketToParticipant.set(socket.id, participant.id);
    this.socketToSession.set(socket.id, session.code);
    state.participantScores.set(socket.id, 0);

    const totalPlayers = state.participantScores.size;
    this.server.to(session.code).emit(SOCKET_EVENTS.PLAYER_JOINED, {
      nickname: participant.nickname,
      firstName: participant.firstName,
      lastName: participant.lastName,
      totalPlayers,
    });
  }

  @SubscribeMessage(SOCKET_EVENTS.SESSION_START)
  async handleStart(
    @ConnectedSocket() socket: Socket,
    @MessageBody() data: { sessionId: string },
  ) {
    const session = await this.sessionRepo.findOne({
      where: { id: data.sessionId },
      relations: { quiz: { questions: { answers: true } } },
    });
    if (!session) return socket.emit(SOCKET_EVENTS.ERROR, { message: 'Session not found' });
    if (session.hostId !== this.resolveHostId(socket))
      return socket.emit(SOCKET_EVENTS.ERROR, { message: 'Unauthorized' });

    let state = this.sessions.get(session.code);
    if (!state) {
      state = {
        sessionId: session.id,
        hostSocketId: socket.id,
        phase: 'waiting',
        currentQuestionIdx: -1,
        questionStartedAt: null,
        tickInterval: null,
        answeredSocketIds: new Set(),
        participantScores: new Map(),
      };
      this.sessions.set(session.code, state);
    }

    state.hostSocketId = socket.id;
    socket.join(session.code);
    this.socketToSession.set(socket.id, session.code);

    session.status = SessionStatus.ACTIVE;
    session.startedAt = new Date();
    await this.sessionRepo.save(session);

    await this.advanceToNextQuestion(session, state);
  }

  @SubscribeMessage(SOCKET_EVENTS.SESSION_NEXT)
  async handleNext(
    @ConnectedSocket() socket: Socket,
    @MessageBody() data: { sessionId: string },
  ) {
    const session = await this.sessionRepo.findOne({
      where: { id: data.sessionId },
      relations: { quiz: { questions: { answers: true } } },
    });
    if (!session) return;

    const state = this.sessions.get(session.code);
    if (!state) return;

    if (state.tickInterval) {
      clearInterval(state.tickInterval);
      state.tickInterval = null;
    }

    if (state.phase === 'question_open') {
      await this.closeQuestion(session, state);
    } else if (state.phase === 'leaderboard') {
      await this.advanceToNextQuestion(session, state);
    }
  }

  @SubscribeMessage(SOCKET_EVENTS.ANSWER_SUBMIT)
  async handleAnswer(
    @ConnectedSocket() socket: Socket,
    @MessageBody() data: { questionId: string; answerIds: string[] },
  ) {
    const sessionCode = this.socketToSession.get(socket.id);
    if (!sessionCode) return;

    const state = this.sessions.get(sessionCode);
    if (!state || state.phase !== 'question_open') return;

    if (state.answeredSocketIds.has(socket.id)) return;
    state.answeredSocketIds.add(socket.id);

    const participantId = this.socketToParticipant.get(socket.id);
    if (!participantId) return;

    const responseTimeMs = state.questionStartedAt
      ? Date.now() - state.questionStartedAt
      : 0;

    const question = await this.questionRepo.findOne({
      where: { id: data.questionId },
      relations: { answers: true },
    });
    if (!question) return;

    const pointsEarned = this.scoring.calculate(
      question,
      question.answers,
      data.answerIds,
      responseTimeMs,
    );

    const participant = await this.participantRepo.findOneBy({ id: participantId });
    if (!participant) return;

    const previousScore = participant.score;
    participant.score += pointsEarned;
    await this.participantRepo.save(participant);

    const pa = this.paRepo.create({
      participantId,
      questionId: data.questionId,
      answerIds: data.answerIds,
      responseTimeMs,
      pointsEarned,
    });
    await this.paRepo.save(pa);

    state.participantScores.set(socket.id, participant.score);

    socket.emit(SOCKET_EVENTS.ANSWER_RESULT, {
      correct: pointsEarned > 0,
      pointsEarned,
      newScore: participant.score,
      responseTimeMs,
    });

    const answeredCount = state.answeredSocketIds.size;
    const totalParticipants = state.participantScores.size;
    this.server.to(state.hostSocketId).emit(SOCKET_EVENTS.ANSWER_COUNT_UPDATE, {
      answeredCount,
      totalPlayers: totalParticipants,
    });

    // If all connected participants answered, close early
    const room = this.server.sockets.adapter.rooms.get(sessionCode);
    const participantSockets = room
      ? [...room].filter((id) => id !== state.hostSocketId)
      : [];

    if (participantSockets.every((id) => state.answeredSocketIds.has(id))) {
      if (state.tickInterval) {
        clearInterval(state.tickInterval);
        state.tickInterval = null;
      }
      const session = await this.sessionRepo.findOne({
        where: { id: state.sessionId },
        relations: { quiz: { questions: { answers: true } } },
      });
      if (session) await this.closeQuestion(session, state);
    }
  }

  @SubscribeMessage(SOCKET_EVENTS.KICK_PARTICIPANT)
  async handleKick(
    @ConnectedSocket() socket: Socket,
    @MessageBody() data: { nickname: string },
  ) {
    const sessionCode = this.socketToSession.get(socket.id);
    if (!sessionCode) return;

    const state = this.sessions.get(sessionCode);
    if (!state || state.hostSocketId !== socket.id || state.phase !== 'waiting') return;

    const session = await this.sessionRepo.findOne({ where: { code: sessionCode } });
    if (!session) return;

    const participant = await this.participantRepo.findOne({
      where: { sessionId: session.id, nickname: ILike(data.nickname) },
    });
    if (!participant) return;

    for (const [sockId, partId] of this.socketToParticipant.entries()) {
      if (partId === participant.id) {
        this.socketToParticipant.delete(sockId);
        this.socketToSession.delete(sockId);
        state.participantScores.delete(sockId);
        break;
      }
    }

    await this.participantRepo.delete({ id: participant.id });

    const totalPlayers = state.participantScores.size;
    this.server.to(sessionCode).emit(SOCKET_EVENTS.PLAYER_KICKED, {
      nickname: participant.nickname,
      totalPlayers,
    });
  }

  private async advanceToNextQuestion(session: SessionEntity, state: GatewaySessionState) {
    const questions = session.quiz.questions.sort((a, b) => a.order - b.order);
    const nextIdx = state.currentQuestionIdx + 1;

    if (nextIdx >= questions.length) {
      await this.finishSession(session, state);
      return;
    }

    state.currentQuestionIdx = nextIdx;
    state.phase = 'question_open';
    state.answeredSocketIds = new Set();
    state.questionStartedAt = Date.now();

    session.currentQuestionIdx = nextIdx;
    await this.sessionRepo.save(session);

    const question = questions[nextIdx];
    const timeLimitMs = question.timeLimit * 1000;

    this.server.to(session.code).emit(SOCKET_EVENTS.QUESTION_START, {
      questionId: question.id,
      text: question.text,
      type: question.type,
      answers: question.answers.map((a) => ({ id: a.id, text: a.text })),
      timeLimitMs,
      maxPoints: question.maxPoints,
      questionIndex: nextIdx,
      totalQuestions: questions.length,
    });

    const tickEvery = 1000;
    let elapsed = 0;

    state.tickInterval = setInterval(async () => {
      elapsed += tickEvery;
      const remaining = timeLimitMs - elapsed;

      this.server.to(session.code).emit(SOCKET_EVENTS.QUESTION_TICK, {
        remainingMs: Math.max(0, remaining),
      });

      if (elapsed >= timeLimitMs) {
        clearInterval(state.tickInterval!);
        state.tickInterval = null;
        const freshSession = await this.sessionRepo.findOne({
          where: { id: session.id },
          relations: { quiz: { questions: { answers: true } } },
        });
        if (freshSession) await this.closeQuestion(freshSession, state);
      }
    }, tickEvery);
  }

  private async closeQuestion(session: SessionEntity, state: GatewaySessionState) {
    state.phase = 'question_closed';

    const questions = session.quiz.questions.sort((a, b) => a.order - b.order);
    const question = questions[state.currentQuestionIdx];
    const correctAnswerIds = question.answers.filter((a) => a.isCorrect).map((a) => a.id);

    this.server.to(session.code).emit(SOCKET_EVENTS.QUESTION_END, { correctAnswerIds });

    const participants = await this.participantRepo.find({
      where: { sessionId: session.id },
    });

    const leaderboard = this.scoring.buildLeaderboard(
      participants.map((p) => ({ nickname: p.nickname, score: p.score })),
    );

    state.phase = 'leaderboard';
    this.server.to(session.code).emit(SOCKET_EVENTS.LEADERBOARD_UPDATE, { rankings: leaderboard });
  }

  private async finishSession(session: SessionEntity, state: GatewaySessionState) {
    state.phase = 'finished';

    session.status = SessionStatus.FINISHED;
    session.finishedAt = new Date();
    await this.sessionRepo.save(session);

    const participants = await this.participantRepo.find({
      where: { sessionId: session.id },
    });

    const finalRankings = this.scoring.buildLeaderboard(
      participants.map((p) => ({ nickname: p.nickname, score: p.score })),
    );

    this.server.to(session.code).emit(SOCKET_EVENTS.SESSION_FINISHED, { finalRankings });
    this.sessions.delete(session.code);
  }

  private resolveHostId(socket: Socket): string | undefined {
    try {
      const token = socket.handshake.auth?.token as string | undefined;
      if (!token) return undefined;
      const payload = this.jwt.verify<{ sub: string }>(token, {
        secret: process.env.JWT_SECRET ?? 'dev-secret',
      });
      return payload.sub;
    } catch {
      return undefined;
    }
  }
}
