import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Booth } from '../entities/booth.entity';
import { Checkin } from '../entities/checkin.entity';
import { Student } from '../entities/student.entity';
import { ScannerController } from './scanner.controller';
import { ScannerService } from './scanner.service';

@Module({
    imports: [TypeOrmModule.forFeature([Checkin, Student, Booth])],
    providers: [ScannerService],
    controllers: [ScannerController],
})
export class ScannerModule { }
