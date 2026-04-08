import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, IsUUID, Min } from 'class-validator';
import { BoothType } from '../../entities/booth.entity';

export class CreateBoothDto {
    @ApiProperty({ example: 'uuid-of-business' })
    @IsUUID('4') @IsNotEmpty() businessId: string;

    @ApiProperty({ example: 'Gian hàng FPT Software - Khu A' })
    @IsString() @IsNotEmpty() name: string;

    @ApiPropertyOptional({ example: 'Khu A - Hội trường B1' })
    @IsString() @IsOptional() location?: string;

    @ApiPropertyOptional({ example: 50, description: 'Sức chứa tối đa' })
    @IsInt() @Min(0) @IsOptional() @Type(() => Number) capacity?: number;

    @ApiPropertyOptional({ enum: BoothType, default: BoothType.BOOTH })
    @IsEnum(BoothType) @IsOptional() type?: BoothType;
}

export class UpdateBoothDto {
    @ApiPropertyOptional() @IsString() @IsOptional() name?: string;
    @ApiPropertyOptional() @IsString() @IsOptional() location?: string;
    @ApiPropertyOptional() @IsInt() @Min(0) @IsOptional() @Type(() => Number) capacity?: number;
    @ApiPropertyOptional({ enum: BoothType }) @IsEnum(BoothType) @IsOptional() type?: BoothType;
}
