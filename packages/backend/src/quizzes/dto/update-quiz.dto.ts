import { IsString, IsOptional, MinLength } from 'class-validator';

export class UpdateQuizDto {
  @IsString()
  @MinLength(1)
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  description?: string;
}
