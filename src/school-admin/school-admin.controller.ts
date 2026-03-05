import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../entities/user.entity';
import { SchoolAdminService } from './school-admin.service';

@ApiTags('school-admin')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SCHOOL_ADMIN, UserRole.SYSTEM_ADMIN)
@Controller('school-admin')
export class SchoolAdminController {
    constructor(private readonly schoolAdminService: SchoolAdminService) { }

    @ApiOperation({ summary: 'Dashboard tổng quan – stats, booths, recent scans' })
    @Get('dashboard')
    getDashboard() { return this.schoolAdminService.getDashboard(); }

    @ApiOperation({ summary: 'Thống kê chi tiết: giờ, ngành, năm học' })
    @Get('stats')
    getStats() { return this.schoolAdminService.getStats(); }

    @ApiOperation({ summary: 'Danh sách tất cả gian hàng' })
    @Get('booths')
    getBooths() { return this.schoolAdminService.getBooths(); }

    @ApiOperation({ summary: 'Danh sách sinh viên đã đăng ký (phân trang)' })
    @ApiQuery({ name: 'page', required: false }) @ApiQuery({ name: 'pageSize', required: false })
    @Get('visitors')
    getVisitors(@Query('page') p?: string, @Query('pageSize') ps?: string) {
        return this.schoolAdminService.getVisitors(p ? +p : 1, ps ? +ps : 20);
    }

    @ApiOperation({ summary: 'Danh sách lượt check-in toàn sự kiện (phân trang)' })
    @ApiQuery({ name: 'page', required: false }) @ApiQuery({ name: 'pageSize', required: false })
    @Get('checkins')
    getCheckins(@Query('page') p?: string, @Query('pageSize') ps?: string) {
        return this.schoolAdminService.getCheckins(p ? +p : 1, ps ? +ps : 30);
    }

    @ApiOperation({ summary: 'Thống kê số lượt quét và sinh viên theo từng gian hàng' })
    @Get('booth-stats')
    getBoothStats() { return this.schoolAdminService.getBoothStats(); }
}
