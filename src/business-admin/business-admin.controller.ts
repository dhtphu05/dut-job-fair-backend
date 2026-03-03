import { Controller, Get, Param, ParseUUIDPipe, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../entities/user.entity';
import { BusinessAdminService } from './business-admin.service';

@ApiTags('business-admin')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.BUSINESS_ADMIN, UserRole.SYSTEM_ADMIN)
@Controller('business-admin')
export class BusinessAdminController {
    constructor(private readonly businessAdminService: BusinessAdminService) { }

    @ApiOperation({ summary: 'Dashboard tổng quan theo businessId' })
    @ApiQuery({ name: 'businessId', required: true })
    @Get('dashboard')
    getDashboard(@Query('businessId', ParseUUIDPipe) businessId: string) {
        return this.businessAdminService.getDashboard(businessId);
    }

    @ApiOperation({ summary: 'Thống kê chi tiết của một gian hàng' })
    @Get('booth/:boothId')
    getBoothStats(@Param('boothId', ParseUUIDPipe) boothId: string) {
        return this.businessAdminService.getBoothStats(boothId);
    }

    @ApiOperation({ summary: 'Danh sách sinh viên đã check-in vào booth (phân trang)' })
    @ApiQuery({ name: 'boothId', required: true })
    @ApiQuery({ name: 'page', required: false }) @ApiQuery({ name: 'pageSize', required: false })
    @Get('visitors')
    getVisitors(
        @Query('boothId', ParseUUIDPipe) boothId: string,
        @Query('page') p?: string,
        @Query('pageSize') ps?: string,
    ) {
        return this.businessAdminService.getVisitors(boothId, p ? +p : 1, ps ? +ps : 20);
    }
}
