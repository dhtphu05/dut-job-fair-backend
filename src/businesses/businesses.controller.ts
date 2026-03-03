import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { BusinessesService } from './businesses.service';
import { CreateBusinessDto, UpdateBusinessDto } from './dto/business.dto';

@ApiTags('businesses')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('businesses')
export class BusinessesController {
    constructor(private readonly businessesService: BusinessesService) { }

    @ApiOperation({ summary: 'Danh sách doanh nghiệp (phân trang)' })
    @ApiQuery({ name: 'page', required: false }) @ApiQuery({ name: 'pageSize', required: false })
    @Get() findAll(@Query('page') p?: string, @Query('pageSize') ps?: string) {
        return this.businessesService.findAll(p ? +p : 1, ps ? +ps : 20);
    }

    @ApiOperation({ summary: 'Chi tiết doanh nghiệp' })
    @Get(':id') findOne(@Param('id', ParseUUIDPipe) id: string) { return this.businessesService.findOne(id); }

    @ApiOperation({ summary: 'Tạo doanh nghiệp mới' })
    @Post() create(@Body() dto: CreateBusinessDto) { return this.businessesService.create(dto); }

    @ApiOperation({ summary: 'Cập nhật doanh nghiệp' })
    @Patch(':id') update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateBusinessDto) { return this.businessesService.update(id, dto); }

    @ApiOperation({ summary: 'Xóa doanh nghiệp' })
    @Delete(':id') remove(@Param('id', ParseUUIDPipe) id: string) { return this.businessesService.remove(id); }
}
