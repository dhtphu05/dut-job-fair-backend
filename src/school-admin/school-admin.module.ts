import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Booth } from '../entities/booth.entity';
import { Checkin } from '../entities/checkin.entity';
import { Student } from '../entities/student.entity';
import { SchoolAdminController } from './school-admin.controller';
import { SchoolAdminService } from './school-admin.service';

@Module({
    imports: [TypeOrmModule.forFeature([Checkin, Student, Booth])],
    providers: [SchoolAdminService],
    controllers: [SchoolAdminController],
})
export class SchoolAdminModule { }
