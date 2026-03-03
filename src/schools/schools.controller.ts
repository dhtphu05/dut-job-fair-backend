import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SchoolsService } from './schools.service';
import { CreateSchoolDto, UpdateSchoolDto } from './dto/school.dto';

@ApiTags('schools')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('schools')
export class SchoolsController {
    constructor(private readonly schoolsService: SchoolsService) { }

    @ApiOperation({ summary: 'Danh sách tất cả trường' })
    @Get() findAll() { return this.schoolsService.findAll(); }

    @ApiOperation({ summary: 'Chi tiết trường theo UUID' })
    @Get(':id') findOne(@Param('id', ParseUUIDPipe) id: string) { return this.schoolsService.findOne(id); }

    @ApiOperation({ summary: 'Tạo trường mới' })
    @Post() create(@Body() dto: CreateSchoolDto) { return this.schoolsService.create(dto); }

    @ApiOperation({ summary: 'Cập nhật thông tin trường' })
    @Patch(':id') update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateSchoolDto) { return this.schoolsService.update(id, dto); }

    @ApiOperation({ summary: 'Xóa trường' })
    @Delete(':id') remove(@Param('id', ParseUUIDPipe) id: string) { return this.schoolsService.remove(id); }
}
