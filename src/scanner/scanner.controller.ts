import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Request,
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
import { QrScanDto, ScanDto } from './dto/scan.dto';
import { ScannerService } from './scanner.service';
import { UserRole } from '../entities/user.entity';

type AuthenticatedScannerUser = {
  id: string;
  role: UserRole;
  boothId?: string | null;
};

@ApiTags('scanner')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('scanner')
export class ScannerController {
  constructor(private readonly scannerService: ScannerService) {}

  @ApiOperation({ summary: 'Quét QR check-in bằng MSSV + boothId' })
  @ApiResponse({
    status: 201,
    description: 'Kết quả scan: success | duplicate | error',
  })
  @Post('scan')
  scan(
    @Body() dto: ScanDto,
    @Request() req: { user: AuthenticatedScannerUser },
  ) {
    return this.scannerService.scan(dto, req.user);
  }

  @ApiOperation({
    summary: 'Quét QR check-in bằng payload JSON đầy đủ từ QR DUT',
  })
  @ApiResponse({
    status: 201,
    description: 'Kết quả scan: success | duplicate | error',
  })
  @Post('scan-qr')
  scanByQrData(
    @Body() dto: QrScanDto,
    @Request() req: { user: AuthenticatedScannerUser },
  ) {
    return this.scannerService.scanByQrData(dto, req.user);
  }

  @ApiOperation({ summary: 'Lấy thông tin sinh viên theo visitorId (UUID)' })
  @Get('visitor/:visitorId')
  getVisitor(@Param('visitorId', ParseUUIDPipe) visitorId: string) {
    return this.scannerService.getVisitor(visitorId);
  }

  @ApiOperation({ summary: 'Lịch sử check-in của một booth (có phân trang)' })
  @ApiQuery({
    name: 'boothId',
    required: true,
    description: 'UUID của gian hàng',
  })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'pageSize', required: false, example: 10 })
  @Get('scans')
  getScans(
    @Query('boothId', ParseUUIDPipe) boothId: string,
    @Request() req: { user: AuthenticatedScannerUser },
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.scannerService.getScans(
      boothId,
      req.user,
      page ? +page : 1,
      pageSize ? +pageSize : 10,
    );
  }

  @ApiOperation({ summary: 'Lấy 10 lượt check-in mới nhất của booth' })
  @ApiQuery({ name: 'boothId', required: true })
  @Get('recent-scans')
  getRecentScans(
    @Query('boothId', ParseUUIDPipe) boothId: string,
    @Request() req: { user: AuthenticatedScannerUser },
  ) {
    return this.scannerService.getRecentScans(boothId, req.user);
  }

  @ApiOperation({
    summary:
      'Danh sách toàn bộ sinh viên đã check-in tại booth (business-admin)',
  })
  @ApiQuery({
    name: 'boothId',
    required: true,
    description: 'UUID của gian hàng',
  })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'pageSize', required: false, example: 20 })
  @Get('checkins')
  getAllCheckins(
    @Query('boothId', ParseUUIDPipe) boothId: string,
    @Request() req: { user: AuthenticatedScannerUser },
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.scannerService.getAllCheckins(
      boothId,
      req.user,
      page ? +page : 1,
      pageSize ? +pageSize : 20,
    );
  }
}
