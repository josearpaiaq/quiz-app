import { IsString, IsBoolean, IsOptional } from 'class-validator';

export class UpdateAnswerDto {
  @IsString()
  @IsOptional()
  text?: string;

  @IsBoolean()
  @IsOptional()
  isCorrect?: boolean;
}
