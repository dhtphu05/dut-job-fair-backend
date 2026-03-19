import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../entities/user.entity';
import { StudentsService } from './students.service';
import { CreateStudentDto, UpdateStudentDto } from './dto/student.dto';

@ApiTags('students')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('students')
export class StudentsController {
  constructor(private readonly studentsService: StudentsService) {}

  @ApiOperation({ summary: 'Danh sách sinh viên (phân trang, tìm kiếm)' })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'pageSize', required: false, example: 20 })
  @ApiQuery({
    name: 'search',
    required: false,
    description: 'Tìm theo tên, MSSV, email',
  })
  @Get()
  findAll(
    @Query('page') p?: string,
    @Query('pageSize') ps?: string,
    @Query('search') search?: string,
  ) {
    return this.studentsService.findAll(p ? +p : 1, ps ? +ps : 20, search);
  }

  @ApiOperation({
    summary: 'Xuất CSV danh sách sinh viên đạt ngưỡng số lần check-in',
  })
  @ApiQuery({
    name: 'threshold',
    required: true,
    example: 5,
    description:
      'Sinh viên có tổng số lượt check-in >= threshold sẽ được xuất ra file',
  })
  @Get('export/eligible-checkins')
  async exportEligibleCheckins(
    @Query('threshold') threshold: string,
    @Res() res: Response,
  ) {
    const result =
      await this.studentsService.exportEligibleStudentsCsv(+threshold);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${result.fileName}"`,
    );
    res.status(200).send(`\uFEFF${result.csv}`);
  }

  @ApiOperation({
    summary: 'Xuất Excel danh sách sinh viên đạt ngưỡng số lần check-in',
  })
  @ApiQuery({
    name: 'threshold',
    required: true,
    example: 5,
    description:
      'Sinh viên có tổng số lượt check-in >= threshold sẽ được xuất ra file Excel',
  })
  @Get('export/eligible-checkins/excel')
  async exportEligibleCheckinsExcel(
    @Query('threshold') threshold: string,
    @Res() res: Response,
  ) {
    const result =
      await this.studentsService.exportEligibleStudentsExcel(+threshold);
    res.setHeader('Content-Type', 'application/vnd.ms-excel; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${result.fileName}"`,
    );
    res.status(200).send(`\uFEFF${result.xml}`);
  }

  @ApiOperation({ summary: 'Chi tiết một sinh viên theo UUID' })
  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.studentsService.findOne(id);
  }

  @ApiOperation({ summary: 'Tạo sinh viên mới (School Admin / System Admin)' })
  @UseGuards(RolesGuard)
  @Roles(UserRole.SCHOOL_ADMIN, UserRole.SYSTEM_ADMIN)
  @Post()
  create(@Body() dto: CreateStudentDto) {
    return this.studentsService.create(dto);
  }

  @ApiOperation({ summary: 'Cập nhật thông tin sinh viên' })
  @UseGuards(RolesGuard)
  @Roles(UserRole.SCHOOL_ADMIN, UserRole.SYSTEM_ADMIN)
  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateStudentDto,
  ) {
    return this.studentsService.update(id, dto);
  }

  @ApiOperation({ summary: 'Xóa sinh viên (System Admin only)' })
  @UseGuards(RolesGuard)
  @Roles(UserRole.SYSTEM_ADMIN)
  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.studentsService.remove(id);
  }
}
