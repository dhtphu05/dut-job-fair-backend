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

    // GET /school-admin/prizes
    async getPrizes() {
        // ── Prize 1: Early Bird ──────────────────────────────────────────────
        // First 50 students by their earliest check-in time (Day 1: 2026-03-04)
        const day1Start = new Date('2026-03-04T01:00:00.000Z');
        const day1End   = new Date('2026-03-04T10:00:00.000Z');

        const earlyBirdRaw = await this.checkinRepo
            .createQueryBuilder('c')
            .select('c.studentId', 'studentId')
            .addSelect('MIN(c.checkInTime)', 'firstCheckin')
            .innerJoin('c.student', 's')
            .where('c.checkInTime >= :start AND c.checkInTime < :end', { start: day1Start, end: day1End })
            .groupBy('c.studentId')
            .orderBy('MIN(c.checkInTime)', 'ASC')
            .limit(50)
            .getRawMany<{ studentId: string; firstCheckin: string }>();

        const earlyBirdIds = earlyBirdRaw.map((r) => r.studentId);
        const earlyBirdStudents = earlyBirdIds.length > 0
            ? await this.studentRepo.findByIds(earlyBirdIds)
            : [];
        const earlyBirdMap = new Map(earlyBirdStudents.map((s) => [s.id, s]));
        const earlyBirdList = earlyBirdRaw.map((r) => {
            const s = earlyBirdMap.get(r.studentId);
            return {
                studentCode: s?.studentCode ?? '',
                fullName: s?.fullName ?? '',
                major: s?.major ?? null,
                department: s?.department ?? null,
                className: s?.className ?? null,
                firstCheckin: r.firstCheckin,
            };
        });

        // ── Prize 2: Sinh viên tích cực (3+ booths) ─────────────────────────
        const activeMeta = await this.checkinRepo
            .createQueryBuilder('c')
            .select('c.studentId', 'studentId')
            .addSelect('COUNT(DISTINCT c.boothId)', 'boothCount')
            .groupBy('c.studentId')
            .having('COUNT(DISTINCT c.boothId) >= :min', { min: 3 })
            .orderBy('COUNT(DISTINCT c.boothId)', 'DESC')
            .getRawMany<{ studentId: string; boothCount: string }>();

        const activeIds = activeMeta.map((r) => r.studentId);
        const activeStudents = activeIds.length > 0 ? await this.studentRepo.findByIds(activeIds) : [];
        const activeMap = new Map(activeStudents.map((s) => [s.id, s]));
        const activeList = activeMeta.map((r) => {
            const s = activeMap.get(r.studentId);
            return {
                studentCode: s?.studentCode ?? '',
                fullName: s?.fullName ?? '',
                major: s?.major ?? null,
                department: s?.department ?? null,
                className: s?.className ?? null,
                boothCount: parseInt(r.boothCount),
            };
        });

        // ── Prize 3: Vé xổ số Ngày 1 (all Day-1 attendees) ──────────────────
        const day2Start = new Date('2026-03-05T01:00:00.000Z');

        const day1Pool = await this.checkinRepo
            .createQueryBuilder('c')
            .select('DISTINCT c.studentId', 'studentId')
            .where('c.checkInTime >= :start AND c.checkInTime < :end', { start: day1Start, end: day1End })
            .getRawMany<{ studentId: string }>();

        const day1Ids = day1Pool.map((r) => r.studentId);
        const day1Students = day1Ids.length > 0 ? await this.studentRepo.findByIds(day1Ids) : [];
        const day1List = day1Students.map((s) => ({
            studentCode: s.studentCode,
            fullName: s.fullName,
            major: s.major ?? null,
            department: s.department ?? null,
            className: s.className ?? null,
        }));

        // ── Prize 4: Vé xổ số Ngày 2 (all Day-2 attendees) ──────────────────
        const day2End = new Date('2026-03-05T06:00:00.000Z');

        const day2Pool = await this.checkinRepo
            .createQueryBuilder('c')
            .select('DISTINCT c.studentId', 'studentId')
            .where('c.checkInTime >= :start AND c.checkInTime < :end', { start: day2Start, end: day2End })
            .getRawMany<{ studentId: string }>();

        const day2Ids = day2Pool.map((r) => r.studentId);
        const day2Students = day2Ids.length > 0 ? await this.studentRepo.findByIds(day2Ids) : [];
        const day2List = day2Students.map((s) => ({
            studentCode: s.studentCode,
            fullName: s.fullName,
            major: s.major ?? null,
            department: s.department ?? null,
            className: s.className ?? null,
        }));

        return [
            {
                id: 'prize-early-bird',
                name: 'Quà tặng Sơ cấp (Early Bird)',
                type: 'early_bird' as const,
                description: '50 sinh viên đến sớm nhất trong ngày 04/03',
                quantity: 50,
                qualificationRule: 'Check-in sớm nhất ngày 04/03',
                eligible: earlyBirdList,
                eligibleCount: earlyBirdList.length,
            },
            {
                id: 'prize-active',
                name: 'Sinh viên tích cực',
                type: 'booth_special' as const,
                description: 'Sinh viên thăm quan từ 3 gian hàng trở lên',
                quantity: activeList.length,
                qualificationRule: 'Thăm quan ≥ 3 gian hàng',
                eligible: activeList,
                eligibleCount: activeList.length,
            },
            {
                id: 'prize-lucky-day1',
                name: 'Vé xổ số may mắn – Ngày 04/03',
                type: 'lucky_draw' as const,
                description: 'Tất cả sinh viên tham dự Ngày 1 (04/03) đều có vé xổ số',
                quantity: day1List.length,
                qualificationRule: 'Tham dự ngày 04/03',
                eligible: day1List,
                eligibleCount: day1List.length,
            },
            {
                id: 'prize-lucky-day2',
                name: 'Vé xổ số may mắn – Ngày 05/03',
                type: 'lucky_draw' as const,
                description: 'Tất cả sinh viên tham dự Ngày 2 (05/03) đều có vé xổ số',
                quantity: day2List.length,
                qualificationRule: 'Tham dự ngày 05/03',
                eligible: day2List,
                eligibleCount: day2List.length,
            },
        ];
    }
}
