import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';
import { UserRole } from '../../entities/user.entity';

export class LoginDto {
    @ApiProperty({ example: 'admin@dut.edu.vn', description: 'Email đăng nhập' })
    @IsEmail({}, { message: 'Email không hợp lệ' })
    email: string;

    @ApiProperty({ example: 'secret123', minLength: 6 })
    @IsString()
    @IsNotEmpty()
    @MinLength(6)
    password: string;
}

export class RegisterDto {
    @ApiProperty({ example: 'admin@dut.edu.vn' })
    @IsEmail()
    email: string;

    @ApiProperty({ example: 'secret123', minLength: 6 })
    @IsString()
    @IsNotEmpty()
    @MinLength(6)
    password: string;

    @ApiProperty({ example: 'Nguyễn Văn A' })
    @IsString()
    @IsNotEmpty()
    name: string;

    @ApiPropertyOptional({ enum: UserRole, default: UserRole.STUDENT })
    @IsOptional()
    role?: UserRole;

    @ApiPropertyOptional({ description: 'UUID doanh nghiệp – bắt buộc với business_admin' })
    @IsOptional()
    @IsUUID()
    businessId?: string;
}

export class RefreshTokenDto {
    @ApiProperty({ description: 'JWT refresh token' })
    @IsString()
    @IsNotEmpty()
    refreshToken: string;
}

export class AuthResponseDto {
    @ApiProperty() id: string;
    @ApiProperty() email: string;
    @ApiProperty() name: string;
    @ApiProperty({ enum: UserRole }) role: UserRole;
    @ApiProperty() accessToken: string;
    @ApiProperty() refreshToken: string;
    @ApiPropertyOptional() boothId?: string | null;
}
