import { Injectable, ConflictException, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { UserEntity } from '../database/entities/user.entity';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(UserEntity)
    private readonly users: Repository<UserEntity>,
    private readonly jwt: JwtService,
  ) {}

  async register(email: string, password: string) {
    const existing = await this.users.findOneBy({ email });
    if (existing) throw new ConflictException('Email already registered');

    const passwordHash = await bcrypt.hash(password, 10);
    const user = this.users.create({ email, passwordHash });
    await this.users.save(user);

    return this.buildTokens(user);
  }

  async login(email: string, password: string) {
    const user = await this.users.findOneBy({ email });
    if (!user) throw new UnauthorizedException('Invalid credentials');

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) throw new UnauthorizedException('Invalid credentials');

    return this.buildTokens(user);
  }

  async refresh(userId: string) {
    const user = await this.users.findOneBy({ id: userId });
    if (!user) throw new UnauthorizedException();
    return this.buildTokens(user);
  }

  private buildTokens(user: UserEntity) {
    const payload = { sub: user.id, email: user.email };
    const accessToken = this.jwt.sign(payload, { expiresIn: '15m' });
    const refreshToken = this.jwt.sign(payload, {
      secret: process.env.JWT_REFRESH_SECRET ?? 'dev-refresh-secret',
      expiresIn: '7d',
    });
    return {
      accessToken,
      refreshToken,
      user: { id: user.id, email: user.email },
    };
  }

  verifyRefreshToken(token: string): { sub: string } {
    return this.jwt.verify(token, {
      secret: process.env.JWT_REFRESH_SECRET ?? 'dev-refresh-secret',
    });
  }
}
