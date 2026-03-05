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

        // Department distribution
        const deptDist = await this.studentRepo
            .createQueryBuilder('s')
            .select('s.department', 'department')
            .addSelect('COUNT(*)', 'count')
            .where('s.department IS NOT NULL')
            .groupBy('s.department')
            .orderBy('count', 'DESC')
            .getRawMany<{ department: string; count: string }>();

        // Daily distribution (group by calendar date)
        const daily = await this.checkinRepo
            .createQueryBuilder('c')
            .select("DATE(c.checkInTime)", 'date')
            .addSelect('COUNT(*)', 'count')
            .addSelect('COUNT(DISTINCT c.studentId)', 'uniqueStudents')
            .groupBy("DATE(c.checkInTime)")
            .orderBy('date')
            .getRawMany<{ date: string; count: string; uniqueStudents: string }>();

        return {
            hourlyDistribution: hourly.map((h) => ({ hour: parseInt(h.hour), count: parseInt(h.count) })),
            majorDistribution: majorDist.map((m) => ({ major: m.major, count: parseInt(m.count) })),
            yearDistribution: yearDist.map((y) => ({ year: parseInt(y.year), count: parseInt(y.count) })),
            departmentDistribution: deptDist.map((d) => ({ department: d.department, count: parseInt(d.count) })),
            dailyDistribution: daily.map((d) => ({
                date: d.date,
                count: parseInt(d.count),
                uniqueStudents: parseInt(d.uniqueStudents),
            })),
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
            items: students.map((s) => ({
                id: s.id,
                studentCode: s.studentCode,
                fullName: s.fullName,
                email: s.email,
                phone: s.phone,
                major: s.major,
                department: (s as any).department ?? null,
                className: (s as any).className ?? null,
                year: s.year,
                gpa: s.gpa,
                school: s.school?.name ?? null,
            })),
            total,
            page,
            pageSize,
            hasMore: page * pageSize < total,
        };
    }

    // GET /school-admin/checkins?page=1&pageSize=30
    async getCheckins(page = 1, pageSize = 30) {
        const [checkins, total] = await this.checkinRepo.findAndCount({
            relations: ['student', 'booth', 'booth.business'],
            order: { checkInTime: 'DESC' },
            skip: (page - 1) * pageSize,
            take: pageSize,
        });
        return {
            items: checkins.map((c) => ({
                id: c.id,
                checkInTime: c.checkInTime,
                durationMinutes: c.durationMinutes,
                status: c.status,
                student: {
                    id: c.student?.id,
                    studentCode: c.student?.studentCode,
                    fullName: c.student?.fullName,
                    major: c.student?.major,
                    department: (c.student as any)?.department ?? null,
                    className: (c.student as any)?.className ?? null,
                    year: c.student?.year,
                },
                booth: {
                    id: c.booth?.id,
                    name: c.booth?.name,
                    business: c.booth?.business?.name ?? null,
                },
            })),
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

    // GET /school-admin/booth-stats
    async getBoothStats() {
        const booths = await this.boothRepo.find({
            relations: ['business'],
            order: { createdAt: 'ASC' },
        });

        const stats = await this.checkinRepo
            .createQueryBuilder('c')
            .select('c.boothId', 'boothId')
            .addSelect('COUNT(*)', 'totalScans')
            .addSelect('COUNT(DISTINCT c.studentId)', 'uniqueStudents')
            .groupBy('c.boothId')
            .getRawMany<{ boothId: string; totalScans: string; uniqueStudents: string }>();

        const statsMap = new Map(stats.map((s) => [s.boothId, s]));

        return booths.map((b) => {
            const s = statsMap.get(b.id);
            return {
                id: b.id,
                name: b.name,
                business: b.business?.name ?? b.name,
                location: b.location,
                totalScans: parseInt(s?.totalScans ?? '0'),
                uniqueStudents: parseInt(s?.uniqueStudents ?? '0'),
            };
        });
    }
}
