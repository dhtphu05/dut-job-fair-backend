import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateSchoolDto {
    @ApiProperty({ example: 'Trường Đại học Bách khoa - ĐH Đà Nẵng' })
    @IsString() @IsNotEmpty() name: string;

    @ApiPropertyOptional({ example: 'DUT' })
    @IsString() @IsOptional() code?: string;

    @ApiPropertyOptional({ example: '54 Nguyễn Lương Bằng, Đà Nẵng' })
    @IsString() @IsOptional() address?: string;
}

export class UpdateSchoolDto {
    @ApiPropertyOptional() @IsString() @IsOptional() name?: string;
    @ApiPropertyOptional() @IsString() @IsOptional() code?: string;
    @ApiPropertyOptional() @IsString() @IsOptional() address?: string;
}
