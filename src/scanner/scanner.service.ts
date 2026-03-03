import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Checkin } from '../entities/checkin.entity';
import { Student } from '../entities/student.entity';
import { Booth } from '../entities/booth.entity';
import { ScanDto } from './dto/scan.dto';

@Injectable()
export class ScannerService {
    constructor(
        @InjectRepository(Checkin)
        private readonly checkinRepo: Repository<Checkin>,
        @InjectRepository(Student)
        private readonly studentRepo: Repository<Student>,
        @InjectRepository(Booth)
        private readonly boothRepo: Repository<Booth>,
    ) { }

    // POST /scanner/scan  – QR scan with MSSV (student_code)
    async scan(dto: ScanDto) {
        // 1. Find student by MSSV
        const student = await this.studentRepo.findOne({
            where: { studentCode: dto.visitorCode },
            relations: ['school'],
        });
        if (!student) {
            return {
                success: false,
                status: 'error',
                message: `Sinh viên có mã ${dto.visitorCode} chưa đăng ký`,
            };
        }

        // 2. Find booth
        const booth = await this.boothRepo.findOne({
            where: { id: dto.boothId },
            relations: ['business'],
        });
        if (!booth) {
            return { success: false, status: 'error', message: 'Gian hàng không tồn tại' };
        }

        // 3. Duplicate check within 5 minutes
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
        const recent = await this.checkinRepo
            .createQueryBuilder('c')
            .where('c.studentId = :sid', { sid: student.id })
            .andWhere('c.boothId = :bid', { bid: dto.boothId })
            .andWhere('c.checkInTime > :limit', { limit: fiveMinutesAgo })
            .getOne();

        if (recent) {
            return {
                success: false,
                status: 'duplicate',
                message: 'Sinh viên đã check-in vào gian hàng này gần đây',
                scanId: recent.id,
                visitor: this.formatVisitor(student),
            };
        }

        // 4. Create checkin
        const checkin = await this.checkinRepo.save(
            this.checkinRepo.create({
                studentId: student.id,
                boothId: dto.boothId,
                notes: dto.notes,
                status: 'active',
            }),
        );

        return {
            success: true,
            status: 'success',
            message: `Check-in thành công: ${student.fullName}`,
            scanId: checkin.id,
            visitor: this.formatVisitor(student),
            booth: { id: booth.id, name: booth.name, business: booth.business?.name },
        };
    }

    // GET /scanner/visitor/:visitorId
    async getVisitor(visitorId: string) {
        const student = await this.studentRepo.findOne({
            where: { id: visitorId },
            relations: ['school'],
        });
        if (!student) throw new BadRequestException('Sinh viên không tồn tại');
        return this.formatVisitor(student);
    }

    // GET /scanner/scans?page=1&pageSize=10
    async getScans(boothId: string, page = 1, pageSize = 10) {
        const [checkins, total] = await this.checkinRepo.findAndCount({
            where: { boothId },
            relations: ['student', 'student.school'],
            order: { checkInTime: 'DESC' },
            skip: (page - 1) * pageSize,
            take: pageSize,
        });

        return {
            items: checkins.map((c) => ({
                id: c.id,
                visitor: this.formatVisitor(c.student),
                checkInTime: c.checkInTime,
                status: c.status,
                durationMinutes: c.durationMinutes,
            })),
            total,
            page,
            pageSize,
            hasMore: page * pageSize < total,
        };
    }

    // GET /scanner/recent-scans
    async getRecentScans(boothId: string, limit = 10) {
        const checkins = await this.checkinRepo.find({
            where: { boothId },
            relations: ['student'],
            order: { checkInTime: 'DESC' },
            take: limit,
        });

        return checkins.map((c) => ({
            id: c.id,
            visitor: this.formatVisitor(c.student),
            checkInTime: c.checkInTime,
            status: c.status,
        }));
    }

    private formatVisitor(student: Student) {
        return {
            id: student.id,
            studentCode: student.studentCode,
            fullName: student.fullName,
            email: student.email,
            major: student.major,
            year: student.year,
            school: student.school?.name,
        };
    }
}
