import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Booth, BoothType } from '../entities/booth.entity';
import { Checkin } from '../entities/checkin.entity';
import { Student } from '../entities/student.entity';
import { DEMO_EVENT_DATE, DEMO_EVENT_END, DEMO_EVENT_START } from '../seed-data/companies';

@Injectable()
export class SchoolAdminService {
  constructor(
    @InjectRepository(Checkin)
    private readonly checkinRepo: Repository<Checkin>,
    @InjectRepository(Student)
    private readonly studentRepo: Repository<Student>,
    @InjectRepository(Booth)
    private readonly boothRepo: Repository<Booth>,
  ) {}

  // GET /school-admin/dashboard
  async getDashboard() {
    const [totalStudents, totalCheckins, booths] = await Promise.all([
      this.studentRepo.count(),
      this.checkinRepo.count(),
      this.boothRepo.find({ relations: ['business'] }),
    ]);

    const totalBooths = booths.filter((b) => b.type === BoothType.BOOTH).length;
    const totalWorkshops = booths.filter(
      (b) => b.type === BoothType.WORKSHOP,
    ).length;

    const uniqueCheckinsResult = await this.checkinRepo
      .createQueryBuilder('c')
      .select('COUNT(DISTINCT c.studentId)', 'count')
      .getRawOne<{ count: string }>();

    const recentScans = await this.checkinRepo.find({
      relations: ['student', 'booth', 'booth.business'],
      order: { checkInTime: 'DESC' },
      take: 10,
    });

    const groupedByType = await this.checkinRepo
      .createQueryBuilder('c')
      .leftJoin('c.booth', 'booth')
      .select('booth.type', 'type')
      .addSelect('COUNT(*)', 'totalCheckins')
      .addSelect('COUNT(DISTINCT c.studentId)', 'uniqueVisitors')
      .groupBy('booth.type')
      .getRawMany<{
        type: BoothType;
        totalCheckins: string;
        uniqueVisitors: string;
      }>();

    const byTypeStats = {
      booth: { totalUnits: totalBooths, totalCheckins: 0, uniqueVisitors: 0 },
      workshop: {
        totalUnits: totalWorkshops,
        totalCheckins: 0,
        uniqueVisitors: 0,
      },
    };

    for (const row of groupedByType) {
      const key = row.type === BoothType.WORKSHOP ? 'workshop' : 'booth';
      byTypeStats[key] = {
        ...byTypeStats[key],
        totalCheckins: parseInt(row.totalCheckins),
        uniqueVisitors: parseInt(row.uniqueVisitors),
      };
    }

    return {
      stats: {
        totalStudents,
        totalCheckins,
        uniqueVisitors: parseInt(uniqueCheckinsResult?.count ?? '0'),
        totalBooths,
        totalWorkshops,
        byType: byTypeStats,
      },
      booths: booths.slice(0, 20).map((b) => ({
        id: b.id,
        name: b.name,
        business: b.business?.name,
        location: b.location,
        capacity: b.capacity,
        type: b.type,
      })),
      recentScans: recentScans.map((c) => ({
        id: c.id,
        student: {
          id: c.student?.id,
          fullName: c.student?.fullName,
          studentCode: c.student?.studentCode,
        },
        booth: {
          id: c.booth?.id,
          name: c.booth?.name,
          business: c.booth?.business?.name,
          type: c.booth?.type ?? BoothType.BOOTH,
        },
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
      .select('DATE(c.checkInTime)', 'date')
      .addSelect('COUNT(*)', 'count')
      .addSelect('COUNT(DISTINCT c.studentId)', 'uniqueStudents')
      .groupBy('DATE(c.checkInTime)')
      .orderBy('date')
      .getRawMany<{ date: string; count: string; uniqueStudents: string }>();

    const checkinTypeDistribution = await this.checkinRepo
      .createQueryBuilder('c')
      .leftJoin('c.booth', 'booth')
      .select('booth.type', 'type')
      .addSelect('COUNT(*)', 'count')
      .addSelect('COUNT(DISTINCT c.studentId)', 'uniqueStudents')
      .groupBy('booth.type')
      .getRawMany<{
        type: BoothType;
        count: string;
        uniqueStudents: string;
      }>();

    return {
      hourlyDistribution: hourly.map((h) => ({
        hour: parseInt(h.hour),
        count: parseInt(h.count),
      })),
      majorDistribution: majorDist.map((m) => ({
        major: m.major,
        count: parseInt(m.count),
      })),
      yearDistribution: yearDist.map((y) => ({
        year: parseInt(y.year),
        count: parseInt(y.count),
      })),
      departmentDistribution: deptDist.map((d) => ({
        department: d.department,
        count: parseInt(d.count),
      })),
      dailyDistribution: daily.map((d) => ({
        date: d.date,
        count: parseInt(d.count),
        uniqueStudents: parseInt(d.uniqueStudents),
      })),
      checkinTypeDistribution: checkinTypeDistribution.map((item) => ({
        type: item.type ?? BoothType.BOOTH,
        count: parseInt(item.count),
        uniqueStudents: parseInt(item.uniqueStudents),
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
          type: c.booth?.type ?? BoothType.BOOTH,
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
      .getRawMany<{
        boothId: string;
        totalScans: string;
        uniqueStudents: string;
      }>();

    const statsMap = new Map(stats.map((s) => [s.boothId, s]));

    return booths.map((b) => {
      const s = statsMap.get(b.id);
      return {
        id: b.id,
        name: b.name,
        business: b.business?.name ?? b.name,
        location: b.location,
        type: b.type,
        totalScans: parseInt(s?.totalScans ?? '0'),
        uniqueStudents: parseInt(s?.uniqueStudents ?? '0'),
      };
    });
  }

  // GET /school-admin/prizes
  async getPrizes() {
    const dayStart = DEMO_EVENT_START;
    const dayEnd = DEMO_EVENT_END;
    const earlyBirdRaw = await this.checkinRepo
      .createQueryBuilder('c')
      .select('c.studentId', 'studentId')
      .addSelect('MIN(c.checkInTime)', 'firstCheckin')
      .innerJoin('c.student', 's')
      .where('c.checkInTime >= :start AND c.checkInTime < :end', { start: dayStart, end: dayEnd })
      .groupBy('c.studentId')
      .orderBy('MIN(c.checkInTime)', 'ASC')
      .limit(50)
      .getRawMany<{ studentId: string; firstCheckin: string }>();

    const earlyBirdIds = earlyBirdRaw.map((r) => r.studentId);
    const earlyBirdStudents =
      earlyBirdIds.length > 0
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

    const activeMeta = await this.checkinRepo
      .createQueryBuilder('c')
      .select('c.studentId', 'studentId')
      .addSelect('COUNT(DISTINCT c.boothId)', 'boothCount')
      .groupBy('c.studentId')
      .having('COUNT(DISTINCT c.boothId) >= :min', { min: 3 })
      .orderBy('COUNT(DISTINCT c.boothId)', 'DESC')
      .getRawMany<{ studentId: string; boothCount: string }>();

    const activeIds = activeMeta.map((r) => r.studentId);
    const activeStudents =
      activeIds.length > 0 ? await this.studentRepo.findByIds(activeIds) : [];
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

    const attendancePool = await this.checkinRepo
      .createQueryBuilder('c')
      .select('DISTINCT c.studentId', 'studentId')
      .where('c.checkInTime >= :start AND c.checkInTime < :end', {
        start: dayStart,
        end: dayEnd,
      })
      .getRawMany<{ studentId: string }>();

    const attendanceIds = attendancePool.map((r) => r.studentId);
    const attendanceStudents =
      attendanceIds.length > 0 ? await this.studentRepo.findByIds(attendanceIds) : [];
    const attendanceList = attendanceStudents.map((s) => ({
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
        description: `50 sinh viên đến sớm nhất trong ngày ${DEMO_EVENT_DATE}`,
        quantity: 50,
        qualificationRule: `Check-in sớm nhất ngày ${DEMO_EVENT_DATE}`,
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
        id: 'prize-lucky-day',
        name: `Vé xổ số may mắn – Ngày ${DEMO_EVENT_DATE}`,
        type: 'lucky_draw' as const,
        description: `Tất cả sinh viên tham dự ngày ${DEMO_EVENT_DATE} đều có vé xổ số`,
        quantity: attendanceList.length,
        qualificationRule: `Tham dự ngày ${DEMO_EVENT_DATE}`,
        eligible: attendanceList,
        eligibleCount: attendanceList.length,
      },
    ];
  }
}
