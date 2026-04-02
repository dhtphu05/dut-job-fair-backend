import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateBusinessDto {
    @ApiProperty({ example: 'FPT Software' })
    @IsString() @IsNotEmpty() name: string;

    @ApiPropertyOptional({ example: 'fpt_abc123' })
    @IsString() @IsOptional() publicId?: string;

    @ApiPropertyOptional({ example: 'https://res.cloudinary.com/example/image/upload/logo.png' })
    @IsString() @IsOptional() logoUrl?: string;

    @ApiPropertyOptional({ example: 'Công nghệ thông tin' })
    @IsString() @IsOptional() industry?: string;

    @ApiPropertyOptional({ example: 'https://fpt-software.com' })
    @IsString() @IsOptional() website?: string;

    @ApiPropertyOptional({ example: 'Công ty phần mềm hàng đầu Việt Nam' })
    @IsString() @IsOptional() description?: string;
}

export class UpdateBusinessDto {
    @ApiPropertyOptional() @IsString() @IsOptional() name?: string;
    @ApiPropertyOptional() @IsString() @IsOptional() publicId?: string;
    @ApiPropertyOptional() @IsString() @IsOptional() logoUrl?: string;
    @ApiPropertyOptional() @IsString() @IsOptional() industry?: string;
    @ApiPropertyOptional() @IsString() @IsOptional() website?: string;
    @ApiPropertyOptional() @IsString() @IsOptional() description?: string;
}
