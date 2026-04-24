import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateTotnghiepAccountDto {
  @ApiProperty({ example: 'totnghiep@jobfair' })
  @IsString()
  @IsNotEmpty()
  email: string;

  @ApiProperty({ example: 'password123', minLength: 6 })
  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  password: string;

  @ApiPropertyOptional({
    example: 'Tài khoản Totnghiep 2026',
    description: 'Nếu bỏ trống sẽ dùng tên Totnghiep',
  })
  @IsOptional()
  @IsString()
  name?: string;
}

export class UpdateTotnghiepAccountDto {
  @ApiPropertyOptional({ example: 'new-email@jobfair', description: 'Tên đăng nhập (email) mới' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  email?: string;

  @ApiPropertyOptional({ example: 'newpassword123', minLength: 6, description: 'Mật khẩu mới (nếu muốn đổi)' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  password?: string;

  @ApiPropertyOptional({ example: 'Tên mới của tài khoản', description: 'Tên hiển thị mới' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;
}
