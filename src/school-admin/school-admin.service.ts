import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Booth } from '../entities/booth.entity';
import { Checkin } from '../entities/checkin.entity';
import { Student } from '../entities/student.entity';

@Injectable()
export class SchoolAdminService {
    constructor(
        @InjectRepository(Checkin)
        private readonly checkinRepo: Repository<Checkin>,
        @InjectRepository(Student)
        private readonly studentRepo: Repository<Student>,
        @InjectRepository(Booth)
        private readonly boothRepo: Repository<Booth>,
    ) { }

    // GET /school-admin/dashboard
    async getDashboard() {
        const [totalStudents, totalCheckins, totalBooths] = await Promise.all([
            this.studentRepo.count(),
            this.checkinRepo.count(),
            this.boothRepo.count(),
        ]);

        const uniqueCheckinsResult = await this.checkinRepo
            .createQueryBuilder('c')
            .select('COUNT(DISTINCT c.studentId)', 'count')
            .getRawOne<{ count: string }>();

        const recentScans = await this.checkinRepo.find({
            relations: ['student', 'booth', 'booth.business'],
            order: { checkInTime: 'DESC' },
            take: 10,
        });

        const booths = await this.boothRepo.find({
            relations: ['business'],
            take: 20,
        });

        return {
            stats: {
                totalStudents,
                totalCheckins,
                uniqueVisitors: parseInt(uniqueCheckinsResult?.count ?? '0'),
                totalBooths,
            },
            booths: booths.map((b) => ({
                id: b.id,
                name: b.name,
                business: b.business?.name,
                location: b.location,
                capacity: b.capacity,
            })),
            recentScans: recentScans.map((c) => ({
                id: c.id,
                student: { id: c.student?.id, fullName: c.student?.fullName, studentCode: c.student?.studentCode },
                booth: { id: c.booth?.id, name: c.booth?.name, business: c.booth?.business?.name },
                checkInTime: c.checkInTime,
                status: c.status,
            })),
        };
    }

    // GET /school-admin/stats
    async getStats() {
        // Hourly distribution
        const hourly = await this.checkinRepo
            .createQueryBuilder('c')
            .select("DATE_PART('hour', c.checkInTime)", 'hour')
            .addSelect('COUNT(*)', 'count')
            .groupBy("DATE_PART('hour', c.checkInTime)")
            .orderBy('hour')
            .getRawMany<{ hour: string; count: string }>();

        // Major distribution
        const majorDist = await this.studentRepo
            .createQueryBuilder('s')
            .select('s.major', 'major')
            .addSelect('COUNT(*)', 'count')
            .where('s.major IS NOT NULL')
            .groupBy('s.major')
            .orderBy('count', 'DESC')
            .getRawMany<{ major: string; count: string }>();

        // Year distribution
        const yearDist = await this.studentRepo
            .createQueryBuilder('s')
            .select('s.year', 'year')
            .addSelect('COUNT(*)', 'count')
            .where('s.year IS NOT NULL')
            .groupBy('s.year')
            .orderBy('year')
            .getRawMany<{ year: string; count: string }>();

        return {
            hourlyDistribution: hourly.map((h) => ({ hour: parseInt(h.hour), count: parseInt(h.count) })),
            majorDistribution: majorDist.map((m) => ({ major: m.major, count: parseInt(m.count) })),
            yearDistribution: yearDist.map((y) => ({ year: parseInt(y.year), count: parseInt(y.count) })),
        };
    }

    // GET /school-admin/visitors?page=1&pageSize=20
    async getVisitors(page = 1, pageSize = 20) {
        const [students, total] = await this.studentRepo.findAndCount({
            relations: ['school'],
            order: { createdAt: 'DESC' },
            skip: (page - 1) * pageSize,
            take: pageSize,
        });
        return {
            items: students,
            total,
            page,
            pageSize,
            hasMore: page * pageSize < total,
        };
    }

    // GET /school-admin/booths
    async getBooths() {
        return this.boothRepo.find({
            relations: ['business'],
            order: { createdAt: 'ASC' },
        });
    }
}
