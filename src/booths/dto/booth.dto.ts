import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsNotEmpty, IsOptional, IsString, IsUUID, Min } from 'class-validator';

export class CreateBoothDto {
    @ApiProperty({ example: 'uuid-of-business' })
    @IsUUID('4') @IsNotEmpty() businessId: string;

    @ApiProperty({ example: 'Gian hàng FPT Software - Khu A' })
    @IsString() @IsNotEmpty() name: string;

    @ApiPropertyOptional({ example: 'Khu A - Hội trường B1' })
    @IsString() @IsOptional() location?: string;

    @ApiPropertyOptional({ example: 50, description: 'Sức chứa tối đa' })
    @IsInt() @Min(0) @IsOptional() @Type(() => Number) capacity?: number;
}

export class UpdateBoothDto {
    @ApiPropertyOptional() @IsString() @IsOptional() name?: string;
    @ApiPropertyOptional() @IsString() @IsOptional() location?: string;
    @ApiPropertyOptional() @IsInt() @Min(0) @IsOptional() @Type(() => Number) capacity?: number;
}
