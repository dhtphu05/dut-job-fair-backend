import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Checkin } from '../entities/checkin.entity';
import { Student } from '../entities/student.entity';
import { Booth } from '../entities/booth.entity';
import { CreateCheckinDto } from './dto/create-checkin.dto';

@Injectable()
export class CheckinService {
    constructor(
        @InjectRepository(Checkin)
        private readonly checkinRepo: Repository<Checkin>,
        @InjectRepository(Student)
        private readonly studentRepo: Repository<Student>,
        @InjectRepository(Booth)
        private readonly boothRepo: Repository<Booth>,
    ) { }

    async create(dto: CreateCheckinDto) {
        // 1. Validate student exists
        const student = await this.studentRepo.findOne({ where: { id: dto.studentId } });
        if (!student) throw new BadRequestException('Student not found');

        // 2. Validate booth exists
        const booth = await this.boothRepo.findOne({ where: { id: dto.boothId } });
        if (!booth) throw new BadRequestException('Booth not found');

        // 3. Prevent duplicate scan within last 5 minutes
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
        const recent = await this.checkinRepo
            .createQueryBuilder('c')
            .where('c.studentId = :sid', { sid: dto.studentId })
            .andWhere('c.boothId = :bid', { bid: dto.boothId })
            .andWhere('c.checkInTime > :limit', { limit: fiveMinutesAgo })
            .getOne();

        if (recent) {
            throw new BadRequestException(
                'Duplicate check-in: student already checked in at this booth recently',
            );
        }

        // 4. Create checkin record
        const checkin = this.checkinRepo.create({
            studentId: dto.studentId,
            boothId: dto.boothId,
            status: 'active',
        });

        const saved = await this.checkinRepo.save(checkin);
        return { id: saved.id, studentId: saved.studentId, boothId: saved.boothId, checkInTime: saved.checkInTime };
    }

    async findByStudent(studentId: string) {
        return this.checkinRepo.find({
            where: { studentId },
            relations: ['booth'],
            order: { checkInTime: 'DESC' },
        });
    }

    async findByBooth(boothId: string) {
        const checkins = await this.checkinRepo.find({
            where: { boothId },
            relations: ['student'],
            order: { checkInTime: 'DESC' },
        });
        const unique = new Set(checkins.map((c) => c.studentId)).size;
        return { total: checkins.length, unique, checkins };
    }
}
