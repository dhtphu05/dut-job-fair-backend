import { Body, Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { CheckinService } from './checkin.service';
import { CreateCheckinDto } from './dto/create-checkin.dto';

@Controller('checkins')
export class CheckinController {
    constructor(private readonly checkinService: CheckinService) { }

    // POST /api/checkins  – QR scan creates checkin
    @Post()
    create(@Body() dto: CreateCheckinDto) {
        return this.checkinService.create(dto);
    }

    // GET /api/checkins/student/:studentId
    @Get('student/:studentId')
    findByStudent(@Param('studentId', ParseUUIDPipe) studentId: string) {
        return this.checkinService.findByStudent(studentId);
    }

    // GET /api/checkins/booth/:boothId
    @Get('booth/:boothId')
    findByBooth(@Param('boothId', ParseUUIDPipe) boothId: string) {
        return this.checkinService.findByBooth(boothId);
    }
}
