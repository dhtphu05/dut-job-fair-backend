import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class CreateWorkshopDto {
  @ApiProperty({ example: 'Hội thảo CV Ấn tượng', description: 'Tên workshop' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 'cv-workshop@jobfair', description: 'Tên đăng nhập (email)' })
  @IsString()
  @IsNotEmpty()
  email: string;

  @ApiProperty({ example: 'password123', minLength: 6, description: 'Mật khẩu' })
  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  password: string;
}
