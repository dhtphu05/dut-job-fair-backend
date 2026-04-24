import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post, Patch, Query, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { Response } from 'express';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../entities/user.entity';
import { SchoolAdminService } from './school-admin.service';
import { CreateWorkshopAccountDto, UpdateWorkshopAccountDto } from './dto/workshop-management.dto';
import { CreateTotnghiepAccountDto, UpdateTotnghiepAccountDto } from './dto/totnghiep-management.dto';
import { CreateBusinessAccountDto } from './dto/business-account.dto';
import { CreateWorkshopDto } from './dto/create-workshop.dto';
import { CreateTotnghiepDto } from './dto/create-totnghiep.dto';

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

    @ApiOperation({ summary: 'Xuất danh sách sinh viên tham gia gian hàng doanh nghiệp' })
    @Get('booth-visitors/export/excel')
    async exportBusinessBoothVisitorsExcel(@Res() res: Response) {
        const result = await this.schoolAdminService.exportBusinessBoothVisitorsExcel();
        res.setHeader('Content-Type', 'application/vnd.ms-excel; charset=utf-8');
        res.setHeader(
            'Content-Disposition',
            `attachment; filename="${result.fileName}"`,
        );
        res.status(200).send(`\uFEFF${result.xml}`);
    }

    @ApiOperation({ summary: 'Thống kê số lượt quét và sinh viên theo từng gian hàng' })
    @Get('booth-stats')
    getBoothStats() { return this.schoolAdminService.getBoothStats(); }

    @ApiOperation({ summary: 'Danh sách tất cả workshop kèm trạng thái tài khoản' })
    @Get('workshops')
    getWorkshops() { return this.schoolAdminService.getWorkshops(); }

    @ApiOperation({ summary: 'Chi tiết thống kê của một workshop' })
    @Get('workshops/:boothId')
    getWorkshopDetail(@Param('boothId', ParseUUIDPipe) boothId: string) {
        return this.schoolAdminService.getWorkshopDetail(boothId);
    }

    @ApiOperation({ summary: 'Tạo workshop mới (Business + Booth)' })
    @Post('workshops')
    createWorkshop(@Body() dto: CreateWorkshopDto) {
        return this.schoolAdminService.createWorkshop(dto);
    }

    @ApiOperation({ summary: 'Tạo tài khoản cho workshop' })
    @Post('workshops/:boothId/account')
    createWorkshopAccount(
        @Param('boothId', ParseUUIDPipe) boothId: string,
        @Body() dto: CreateWorkshopAccountDto,
    ) {
        return this.schoolAdminService.createWorkshopAccount(boothId, dto);
    }

    @ApiOperation({ summary: 'Cập nhật tài khoản cho workshop (đổi email, password)' })
    @Patch('workshops/:boothId/account')
    updateWorkshopAccount(
        @Param('boothId', ParseUUIDPipe) boothId: string,
        @Body() dto: UpdateWorkshopAccountDto,
    ) {
        return this.schoolAdminService.updateWorkshopAccount(boothId, dto);
    }

    @ApiOperation({ summary: 'Danh sách tất cả Totnghiep kèm trạng thái tài khoản' })
    @Get('totnghieps')
    getTotnghieps() { return this.schoolAdminService.getTotnghieps(); }

    @ApiOperation({ summary: 'Chi tiết thống kê của một Totnghiep' })
    @Get('totnghieps/:boothId')
    getTotnghiepDetail(@Param('boothId', ParseUUIDPipe) boothId: string) {
        return this.schoolAdminService.getTotnghiepDetail(boothId);
    }

    @ApiOperation({ summary: 'Tạo Totnghiep mới (Business + Booth)' })
    @Post('totnghieps')
    createTotnghiep(@Body() dto: CreateTotnghiepDto) {
        return this.schoolAdminService.createTotnghiep(dto);
    }

    @ApiOperation({ summary: 'Tạo tài khoản cho Totnghiep' })
    @Post('totnghieps/:boothId/account')
    createTotnghiepAccount(
        @Param('boothId', ParseUUIDPipe) boothId: string,
        @Body() dto: CreateTotnghiepAccountDto,
    ) {
        return this.schoolAdminService.createTotnghiepAccount(boothId, dto);
    }

    @ApiOperation({ summary: 'Cập nhật tài khoản cho Totnghiep (đổi email, password)' })
    @Patch('totnghieps/:boothId/account')
    updateTotnghiepAccount(
        @Param('boothId', ParseUUIDPipe) boothId: string,
        @Body() dto: UpdateTotnghiepAccountDto,
    ) {
        return this.schoolAdminService.updateTotnghiepAccount(boothId, dto);
    }

    @ApiOperation({ summary: 'Danh sách giải thưởng kèm sinh viên đủ điều kiện' })
    @Get('prizes')
    getPrizes() { return this.schoolAdminService.getPrizes(); }

    @ApiOperation({ summary: 'Danh sách các tài khoản doanh nghiệp' })
    @Get('business-accounts')
    getBusinessAccounts() { return this.schoolAdminService.getBusinessAccounts(); }

    @ApiOperation({ summary: 'Tạo tài khoản doanh nghiệp (kèm tạo Business + Booth tự động)' })
    @Post('business-accounts')
    createBusinessAccount(@Body() dto: CreateBusinessAccountDto) {
        return this.schoolAdminService.createBusinessAccount(dto);
    }

    @ApiOperation({ summary: 'Xoá tài khoản doanh nghiệp và toàn bộ dữ liệu đi kèm' })
    @Delete('business-accounts/:userId')
    deleteBusinessAccount(@Param('userId', ParseUUIDPipe) userId: string) {
        return this.schoolAdminService.deleteBusinessAccount(userId);
    }
}
