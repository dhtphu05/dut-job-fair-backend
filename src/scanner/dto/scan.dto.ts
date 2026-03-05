import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export class ScanDto {
    @ApiProperty({
        example: '20T1020001',
        description: 'Mã sinh viên (MSSV) của sinh viên cần check-in',
    })
    @IsString()
    @IsNotEmpty()
    visitorCode: string;

    @ApiProperty({ example: 'uuid-of-booth', description: 'UUID của gian hàng' })
    @IsUUID('4')
    @IsNotEmpty()
    boothId: string;

    @ApiPropertyOptional({ example: 'Có hẹn phỏng vấn' })
    @IsOptional()
    @IsString()
    notes?: string;
}

/**
 * DTO cho endpoint POST /scanner/scan-qr
 * Nhận đúng payload JSON được mã hoá trong QR của DUT
 */
export class QrScanDto {
    @ApiProperty({ example: 'Đoàn Hoàng Thiên Phú', description: 'Họ tên sinh viên' })
    @IsString()
    @IsNotEmpty()
    ho_ten: string;

    @ApiProperty({ example: '102230313', description: 'Mã số sinh viên (MSSV)' })
    @IsString()
    @IsNotEmpty()
    ma_so_sinh_vien: string;

    @ApiProperty({ example: '23T_DT4', description: 'Lớp học' })
    @IsString()
    @IsNotEmpty()
    lop: string;

    @ApiPropertyOptional({ example: 'user@gmail.com' })
    @IsOptional()
    @IsEmail()
    email?: string;

    @ApiPropertyOptional({ example: '0385544281' })
    @IsOptional()
    @IsString()
    phone?: string;

    @ApiProperty({ example: 'uuid-of-booth', description: 'UUID của gian hàng doanh nghiệp' })
    @IsUUID('4')
    @IsNotEmpty()
    boothId: string;

    @ApiPropertyOptional({ example: 'Ghi chú thêm' })
    @IsOptional()
    @IsString()
    notes?: string;
}
