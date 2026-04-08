import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Booth } from '../entities/booth.entity';
import { Business } from '../entities/business.entity';
import { Checkin } from '../entities/checkin.entity';
import { Student } from '../entities/student.entity';
import { User } from '../entities/user.entity';
import { SchoolAdminController } from './school-admin.controller';
import { SchoolAdminService } from './school-admin.service';

@Module({
    imports: [TypeOrmModule.forFeature([Checkin, Student, Booth, Business, User])],
    providers: [SchoolAdminService],
    controllers: [SchoolAdminController],
})
export class SchoolAdminModule { }
