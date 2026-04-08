import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateWorkshopAccountDto {
  @ApiProperty({ example: 'cv-workshop@jobfair' })
  @IsString()
  @IsNotEmpty()
  email: string;

  @ApiProperty({ example: 'password123', minLength: 6 })
  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  password: string;

  @ApiPropertyOptional({
    example: 'Tài khoản hội thảo CV Ấn tượng',
    description: 'Nếu bỏ trống sẽ dùng tên hội thảo',
  })
  @IsOptional()
  @IsString()
  name?: string;
}
