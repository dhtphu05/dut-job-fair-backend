import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';

export class CreateBusinessAccountDto {
    @ApiProperty({ example: 'fpt@jobfair.dut' })
    @IsEmail()
    @IsNotEmpty()
    email: string;

    @ApiProperty({ example: 'FPT Software' })
    @IsString()
    @IsNotEmpty()
    name: string;

    @ApiProperty({ example: 'secret123', minLength: 6 })
    @IsString()
    @IsNotEmpty()
    @MinLength(6)
    password: string;
}
