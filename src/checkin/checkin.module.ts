import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Checkin } from '../entities/checkin.entity';
import { Student } from '../entities/student.entity';
import { Booth } from '../entities/booth.entity';
import { Business } from '../entities/business.entity';
import { CheckinService } from './checkin.service';
import { CheckinController } from './checkin.controller';

@Module({
    imports: [TypeOrmModule.forFeature([Checkin, Student, Booth, Business])],
    providers: [CheckinService],
    controllers: [CheckinController],
})
export class CheckinModule { }
