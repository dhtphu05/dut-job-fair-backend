import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

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
