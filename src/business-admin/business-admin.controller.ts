import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post, Query, Request, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../entities/user.entity';
import { BusinessAdminService } from './business-admin.service';
import { CreateWorkshopAttendanceDto } from './dto/workshop-attendance.dto';

type AuthenticatedBusinessAdminUser = {
    id: string;
    role: UserRole;
    boothId?: string | null;
};

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

    @ApiOperation({
        summary: 'Danh sách điểm danh dành riêng cho account workshop',
    })
    @ApiQuery({
        name: 'boothId',
        required: false,
        description: 'Chỉ dùng cho system admin khi muốn xem báo cáo của một workshop cụ thể',
    })
    @Get('workshop-attendance')
    getWorkshopAttendance(
        @Request() req: { user: AuthenticatedBusinessAdminUser },
        @Query('boothId') boothId?: string,
    ) {
        return this.businessAdminService.getWorkshopAttendanceReport(req.user, boothId);
    }

    @ApiOperation({
        summary: 'Xuất CSV điểm danh dành riêng cho account workshop',
    })
    @ApiQuery({
        name: 'boothId',
        required: false,
        description: 'Chỉ dùng cho system admin khi muốn xuất báo cáo của một workshop cụ thể',
    })
    @Get('workshop-attendance/export')
    async exportWorkshopAttendance(
        @Request() req: { user: AuthenticatedBusinessAdminUser },
        @Query('boothId') boothId: string | undefined,
        @Res() res: Response,
    ) {
        const result = await this.businessAdminService.exportWorkshopAttendanceCsv(
            req.user,
            boothId,
        );
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader(
            'Content-Disposition',
            `attachment; filename="${result.fileName}"`,
        );
        res.status(200).send(`\uFEFF${result.csv}`);
    }

    @ApiOperation({
        summary: 'Xuất Excel điểm danh dành riêng cho account workshop',
    })
    @ApiQuery({
        name: 'boothId',
        required: false,
        description: 'Chỉ dùng cho system admin khi muốn xuất báo cáo của một workshop cụ thể',
    })
    @Get('workshop-attendance/export/excel')
    async exportWorkshopAttendanceExcel(
        @Request() req: { user: AuthenticatedBusinessAdminUser },
        @Query('boothId') boothId: string | undefined,
        @Res() res: Response,
    ) {
        const result = await this.businessAdminService.exportWorkshopAttendanceExcel(
            req.user,
            boothId,
        );
        res.setHeader('Content-Type', 'application/vnd.ms-excel; charset=utf-8');
        res.setHeader(
            'Content-Disposition',
            `attachment; filename="${result.fileName}"`,
        );
        res.status(200).send(`\uFEFF${result.xml}`);
    }

    @ApiOperation({
        summary: 'Thêm thủ công một sinh viên vào danh sách điểm danh hội thảo',
    })
    @ApiQuery({
        name: 'boothId',
        required: false,
        description: 'Chỉ dùng cho system admin khi muốn thao tác trên một hội thảo cụ thể',
    })
    @Post('workshop-attendance/manual')
    createWorkshopAttendanceManual(
        @Request() req: { user: AuthenticatedBusinessAdminUser },
        @Query('boothId') boothId: string | undefined,
        @Body() dto: CreateWorkshopAttendanceDto,
    ) {
        return this.businessAdminService.createWorkshopAttendanceManual(
            req.user,
            dto,
            boothId,
        );
    }

    @ApiOperation({
        summary: 'Xoá một sinh viên khỏi danh sách điểm danh hội thảo',
    })
    @ApiQuery({
        name: 'boothId',
        required: false,
        description: 'Chỉ dùng cho system admin khi muốn thao tác trên một hội thảo cụ thể',
    })
    @Delete('workshop-attendance/:studentCode')
    deleteWorkshopAttendance(
        @Request() req: { user: AuthenticatedBusinessAdminUser },
        @Param('studentCode') studentCode: string,
        @Query('boothId') boothId?: string,
    ) {
        return this.businessAdminService.deleteWorkshopAttendance(
            req.user,
            studentCode,
            boothId,
        );
    }
}
