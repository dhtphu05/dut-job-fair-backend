import {
    Body,
    Controller,
    Get,
    Param,
    ParseUUIDPipe,
    Post,
    Query,
    UseGuards,
} from '@nestjs/common';
import {
    ApiBearerAuth,
    ApiOperation,
    ApiQuery,
    ApiResponse,
    ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ScanDto } from './dto/scan.dto';
import { ScannerService } from './scanner.service';

@ApiTags('scanner')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('scanner')
export class ScannerController {
    constructor(private readonly scannerService: ScannerService) { }

    @ApiOperation({ summary: 'Quét QR check-in bằng MSSV + boothId' })
    @ApiResponse({ status: 201, description: 'Kết quả scan: success | duplicate | error' })
    @Post('scan')
    scan(@Body() dto: ScanDto) {
        return this.scannerService.scan(dto);
    }

    @ApiOperation({ summary: 'Lấy thông tin sinh viên theo visitorId (UUID)' })
    @Get('visitor/:visitorId')
    getVisitor(@Param('visitorId', ParseUUIDPipe) visitorId: string) {
        return this.scannerService.getVisitor(visitorId);
    }

    @ApiOperation({ summary: 'Lịch sử check-in của một booth (có phân trang)' })
    @ApiQuery({ name: 'boothId', required: true, description: 'UUID của gian hàng' })
    @ApiQuery({ name: 'page', required: false, example: 1 })
    @ApiQuery({ name: 'pageSize', required: false, example: 10 })
    @Get('scans')
    getScans(
        @Query('boothId', ParseUUIDPipe) boothId: string,
        @Query('page') page?: string,
        @Query('pageSize') pageSize?: string,
    ) {
        return this.scannerService.getScans(boothId, page ? +page : 1, pageSize ? +pageSize : 10);
    }

    @ApiOperation({ summary: 'Lấy 10 lượt check-in mới nhất của booth' })
    @ApiQuery({ name: 'boothId', required: true })
    @Get('recent-scans')
    getRecentScans(@Query('boothId', ParseUUIDPipe) boothId: string) {
        return this.scannerService.getRecentScans(boothId);
    }
}
