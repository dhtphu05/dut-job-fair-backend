import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsInt, IsNotEmpty, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateStudentDto {
    @ApiProperty({ example: '20T1020001', description: 'Mã số sinh viên (MSSV)' })
    @IsString() @IsNotEmpty() studentCode: string;

    @ApiProperty({ example: 'Nguyễn Văn A' })
    @IsString() @IsNotEmpty() fullName: string;

    @ApiPropertyOptional({ example: 'nguyenvana@dut.edu.vn' })
    @IsEmail() @IsOptional() email?: string;

    @ApiPropertyOptional({ example: '0912345678' })
    @IsString() @IsOptional() phone?: string;

    @ApiPropertyOptional({ example: 'Kỹ thuật phần mềm' })
    @IsString() @IsOptional() major?: string;

    @ApiPropertyOptional({ example: 3, minimum: 1, maximum: 6 })
    @IsInt() @Min(1) @Max(6) @IsOptional() @Type(() => Number) year?: number;

    @ApiPropertyOptional({ example: 3.5, description: 'GPA 0-4' })
    @IsOptional() @Type(() => Number) gpa?: number;

    @ApiPropertyOptional({ example: 'uuid-of-school' })
    @IsUUID('4') @IsOptional() schoolId?: string;
}

export class UpdateStudentDto {
    @ApiPropertyOptional({ example: 'Nguyễn Văn B' })
    @IsString() @IsOptional() fullName?: string;

    @ApiPropertyOptional({ example: 'nguyenvanb@dut.edu.vn' })
    @IsEmail() @IsOptional() email?: string;

    @ApiPropertyOptional() @IsString() @IsOptional() phone?: string;
    @ApiPropertyOptional() @IsString() @IsOptional() major?: string;

    @ApiPropertyOptional({ minimum: 1, maximum: 6 })
    @IsInt() @Min(1) @Max(6) @IsOptional() @Type(() => Number) year?: number;

    @ApiPropertyOptional() @IsOptional() @Type(() => Number) gpa?: number;

    @ApiPropertyOptional() @IsUUID('4') @IsOptional() schoolId?: string;
}
