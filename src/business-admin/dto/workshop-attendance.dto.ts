import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEmail, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateWorkshopAttendanceDto {
  @ApiProperty({ example: 'Nguyễn Văn A' })
  @IsString()
  @IsNotEmpty()
  fullName: string;

  @ApiProperty({ example: '102230000', description: 'Mã số sinh viên' })
  @IsString()
  @IsNotEmpty()
  @MinLength(5)
  studentCode: string;

  @ApiPropertyOptional({ example: '23T_DT3', description: 'Lớp' })
  @IsOptional()
  @IsString()
  className?: string;

  @ApiPropertyOptional({
    example: 'Khoa Công nghệ Thông tin',
    description: 'Khoa',
  })
  @IsOptional()
  @IsString()
  department?: string;

  @ApiPropertyOptional({ example: '0123456789', description: 'Số điện thoại' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ example: 'example@gmail.com' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({
    example: '2026-04-01T08:15:23+07:00',
    description: 'Thời gian điểm danh thủ công, nếu bỏ trống sẽ dùng thời gian hiện tại',
  })
  @IsOptional()
  @IsDateString()
  checkInTime?: string;
}
