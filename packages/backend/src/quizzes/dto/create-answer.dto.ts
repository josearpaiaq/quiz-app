import { IsString, IsBoolean } from 'class-validator';

export class CreateAnswerDto {
  @IsString()
  text: string;

  @IsBoolean()
  isCorrect: boolean;
}
