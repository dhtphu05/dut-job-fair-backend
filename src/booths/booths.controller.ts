import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { BoothsService } from './booths.service';
import { CreateBoothDto, UpdateBoothDto } from './dto/booth.dto';

@ApiTags('booths')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('booths')
export class BoothsController {
    constructor(private readonly boothsService: BoothsService) { }

    @ApiOperation({ summary: 'Danh sách gian hàng (lọc theo businessId)' })
    @ApiQuery({ name: 'businessId', required: false, description: 'Lọc theo UUID doanh nghiệp' })
    @Get() findAll(@Query('businessId') businessId?: string) {
        return this.boothsService.findAll(businessId);
    }

    @ApiOperation({ summary: 'Chi tiết gian hàng' })
    @Get(':id') findOne(@Param('id', ParseUUIDPipe) id: string) { return this.boothsService.findOne(id); }

    @ApiOperation({ summary: 'Tạo gian hàng mới (auto tạo qrCode)' })
    @Post() create(@Body() dto: CreateBoothDto) { return this.boothsService.create(dto); }

    @ApiOperation({ summary: 'Cập nhật gian hàng' })
    @Patch(':id') update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateBoothDto) { return this.boothsService.update(id, dto); }

    @ApiOperation({ summary: 'Xóa gian hàng' })
    @Delete(':id') remove(@Param('id', ParseUUIDPipe) id: string) { return this.boothsService.remove(id); }
}
