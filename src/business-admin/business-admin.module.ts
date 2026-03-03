import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Booth } from '../entities/booth.entity';
import { Checkin } from '../entities/checkin.entity';
import { Student } from '../entities/student.entity';
import { BusinessAdminController } from './business-admin.controller';
import { BusinessAdminService } from './business-admin.service';

@Module({
    imports: [TypeOrmModule.forFeature([Checkin, Student, Booth])],
    providers: [BusinessAdminService],
    controllers: [BusinessAdminController],
})
export class BusinessAdminModule { }
