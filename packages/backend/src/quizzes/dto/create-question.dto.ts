import { IsString, IsEnum, IsInt, IsOptional, Min } from 'class-validator';
import { QuestionType } from '@quiz/shared';

export class CreateQuestionDto {
  @IsString()
  text: string;

  @IsEnum(QuestionType)
  type: QuestionType;

  @IsInt()
  timeLimit: number;

  @IsInt()
  @IsOptional()
  @Min(1)
  maxPoints?: number;

  @IsInt()
  order: number;
}
