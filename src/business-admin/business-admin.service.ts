import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Booth } from '../entities/booth.entity';
import { Checkin } from '../entities/checkin.entity';
import { Student } from '../entities/student.entity';

@Injectable()
export class BusinessAdminService {
    constructor(
        @InjectRepository(Checkin)
        private readonly checkinRepo: Repository<Checkin>,
        @InjectRepository(Student)
        private readonly studentRepo: Repository<Student>,
        @InjectRepository(Booth)
        private readonly boothRepo: Repository<Booth>,
    ) { }

    // GET /business-admin/dashboard
    async getDashboard(businessId: string) {
        const booths = await this.boothRepo.find({ where: { businessId } });
        const boothIds = booths.map((b) => b.id);

        if (boothIds.length === 0) {
            return { stats: { totalVisitors: 0, uniqueVisitors: 0, totalBooths: 0 }, booths: [] };
        }

        const totalCheckins = await this.checkinRepo
            .createQueryBuilder('c')
            .where('c.boothId IN (:...ids)', { ids: boothIds })
            .getCount();

        const uniqueResult = await this.checkinRepo
            .createQueryBuilder('c')
            .select('COUNT(DISTINCT c.studentId)', 'count')
            .where('c.boothId IN (:...ids)', { ids: boothIds })
            .getRawOne<{ count: string }>();

        const recentScans = await this.checkinRepo.find({
            where: boothIds.map((id) => ({ boothId: id })),
            relations: ['student', 'booth'],
            order: { checkInTime: 'DESC' },
            take: 10,
        });

        return {
            stats: {
                totalVisitors: totalCheckins,
                uniqueVisitors: parseInt(uniqueResult?.count ?? '0'),
                totalBooths: booths.length,
            },
            booths: booths.map((b) => ({ id: b.id, name: b.name, location: b.location, capacity: b.capacity })),
            recentScans: recentScans.map((c) => ({
                id: c.id,
                student: { id: c.student?.id, fullName: c.student?.fullName, studentCode: c.student?.studentCode, major: c.student?.major },
                checkInTime: c.checkInTime,
                booth: c.booth?.name,
            })),
        };
    }

    // GET /business-admin/booth/:boothId  – statistics for a single booth
    async getBoothStats(boothId: string) {
        const booth = await this.boothRepo.findOne({ where: { id: boothId }, relations: ['business'] });
        if (!booth) throw new NotFoundException('Gian hàng không tồn tại');

        const [total, uniqueResult] = await Promise.all([
            this.checkinRepo.count({ where: { boothId } }),
            this.checkinRepo
                .createQueryBuilder('c')
                .select('COUNT(DISTINCT c.studentId)', 'count')
                .where('c.boothId = :id', { id: boothId })
                .getRawOne<{ count: string }>(),
        ]);

        const hourly = await this.checkinRepo
            .createQueryBuilder('c')
            .select("DATE_PART('hour', c.checkInTime)", 'hour')
            .addSelect('COUNT(*)', 'count')
            .where('c.boothId = :id', { id: boothId })
            .groupBy("DATE_PART('hour', c.checkInTime)")
            .orderBy('hour')
            .getRawMany<{ hour: string; count: string }>();

        return {
            booth: { id: booth.id, name: booth.name, location: booth.location },
            stats: {
                totalVisitors: total,
                uniqueVisitors: parseInt(uniqueResult?.count ?? '0'),
            },
            hourlyDistribution: hourly.map((h) => ({ hour: parseInt(h.hour), count: parseInt(h.count) })),
        };
    }

    // GET /business-admin/visitors?boothId=uuid&page=1&pageSize=20
    async getVisitors(boothId: string, page = 1, pageSize = 20) {
        const [checkins, total] = await this.checkinRepo.findAndCount({
            where: { boothId },
            relations: ['student', 'student.school'],
            order: { checkInTime: 'DESC' },
            skip: (page - 1) * pageSize,
            take: pageSize,
        });
        return {
            items: checkins.map((c) => ({
                checkinId: c.id,
                student: {
                    id: c.student?.id,
                    studentCode: c.student?.studentCode,
                    fullName: c.student?.fullName,
                    major: c.student?.major,
                    year: c.student?.year,
                    school: c.student?.school?.name,
                },
                checkInTime: c.checkInTime,
                durationMinutes: c.durationMinutes,
                status: c.status,
            })),
            total,
            page,
            pageSize,
            hasMore: page * pageSize < total,
        };
    }
}
