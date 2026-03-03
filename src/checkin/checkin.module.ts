import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Checkin } from '../entities/checkin.entity';
import { Student } from '../entities/student.entity';
import { Booth } from '../entities/booth.entity';
import { CheckinService } from './checkin.service';
import { CheckinController } from './checkin.controller';

@Module({
    imports: [TypeOrmModule.forFeature([Checkin, Student, Booth])],
    providers: [CheckinService],
    controllers: [CheckinController],
})
export class CheckinModule { }
