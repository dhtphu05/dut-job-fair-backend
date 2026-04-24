import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class CreateTotnghiepDto {
  @ApiProperty({ example: 'Tốt nghiệp 2026', description: 'Tên Totnghiep' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 'totnghiep@jobfair', description: 'Tên đăng nhập (email)' })
  @IsString()
  @IsNotEmpty()
  email: string;

  @ApiProperty({ example: 'password123', minLength: 6, description: 'Mật khẩu' })
  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  password: string;
}
