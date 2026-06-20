import { IsString, IsEnum, IsInt, IsOptional, Min } from 'class-validator';
import { QuestionType } from '@quiz/shared';

export class UpdateQuestionDto {
  @IsString()
  @IsOptional()
  text?: string;

  @IsEnum(QuestionType)
  @IsOptional()
  type?: QuestionType;

  @IsInt()
  @IsOptional()
  timeLimit?: number;

  @IsInt()
  @IsOptional()
  @Min(1)
  maxPoints?: number;

  @IsInt()
  @IsOptional()
  order?: number;
}
