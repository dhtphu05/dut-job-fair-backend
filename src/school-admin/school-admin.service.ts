import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { Booth, BoothType } from '../entities/booth.entity';
import { Business, BusinessType } from '../entities/business.entity';
import { Checkin } from '../entities/checkin.entity';
import { Student } from '../entities/student.entity';
import { User, UserRole } from '../entities/user.entity';
import { DEMO_EVENT_DATE, DEMO_EVENT_END, DEMO_EVENT_START } from '../seed-data/companies';
import { CreateWorkshopAccountDto, UpdateWorkshopAccountDto } from './dto/workshop-management.dto';
import { CreateBusinessAccountDto } from './dto/business-account.dto';
import { randomUUID } from 'crypto';

@Injectable()
export class SchoolAdminService {
  constructor(
    @InjectRepository(Checkin)
    private readonly checkinRepo: Repository<Checkin>,
    @InjectRepository(Student)
    private readonly studentRepo: Repository<Student>,
    @InjectRepository(Booth)
    private readonly boothRepo: Repository<Booth>,
    @InjectRepository(Business)
    private readonly businessRepo: Repository<Business>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
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
        displayName:
          b.type === BoothType.WORKSHOP ? b.business?.name ?? b.name : b.name,
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
          displayName:
            c.booth?.type === BoothType.WORKSHOP
              ? c.booth?.business?.name ?? c.booth?.name
              : c.booth?.name,
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

    // Year distribution
    const yearDist = await this.checkinRepo
      .createQueryBuilder('c')
      .innerJoin('c.student', 's')
      .select('s.year', 'year')
      .addSelect('COUNT(DISTINCT c.studentId)', 'count')
      .where('s.year IS NOT NULL')
      .groupBy('s.year')
      .orderBy('year')
      .getRawMany<{ year: string; count: string }>();

    // Department distribution
    const deptDist = await this.checkinRepo
      .createQueryBuilder('c')
      .innerJoin('c.student', 's')
      .select('s.department', 'department')
      .addSelect('COUNT(DISTINCT c.studentId)', 'count')
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
          department: (c.student as any)?.department ?? null,
          className: (c.student as any)?.className ?? null,
          year: c.student?.year,
        },
        booth: {
          id: c.booth?.id,
          name: c.booth?.name,
          displayName:
            c.booth?.type === BoothType.WORKSHOP
              ? c.booth?.business?.name ?? c.booth?.name
              : c.booth?.name,
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
        displayName:
          b.type === BoothType.WORKSHOP ? b.business?.name ?? b.name : b.name,
        business: b.business?.name ?? b.name,
        location: b.location,
        type: b.type,
        totalScans: parseInt(s?.totalScans ?? '0'),
        uniqueStudents: parseInt(s?.uniqueStudents ?? '0'),
      };
    });
  }

  // GET /school-admin/workshops
  async getWorkshops() {
    const workshops = await this.boothRepo.find({
      where: { type: BoothType.WORKSHOP },
      relations: ['business'],
      order: { createdAt: 'ASC' },
    });

    const workshopIds = workshops.map((workshop) => workshop.id);
    const accountMap = new Map<string, User>();
    if (workshopIds.length > 0) {
      const accounts = await this.userRepo.find({
        where: workshopIds.map((id) => ({ boothId: id })),
        order: { createdAt: 'ASC' },
      });
      for (const account of accounts) {
        if (account.boothId && !accountMap.has(account.boothId)) {
          accountMap.set(account.boothId, account);
        }
      }
    }

    const stats = await this.checkinRepo
      .createQueryBuilder('c')
      .select('c.boothId', 'boothId')
      .addSelect('COUNT(*)', 'totalScans')
      .addSelect('COUNT(DISTINCT c.studentId)', 'uniqueStudents')
      .where('c.boothId IN (:...ids)', { ids: workshopIds.length ? workshopIds : ['00000000-0000-0000-0000-000000000000'] })
      .groupBy('c.boothId')
      .getRawMany<{
        boothId: string;
        totalScans: string;
        uniqueStudents: string;
      }>();
    const statsMap = new Map(stats.map((item) => [item.boothId, item]));

    return workshops.map((workshop) => {
      const account = accountMap.get(workshop.id);
      const workshopStats = statsMap.get(workshop.id);
      return {
        id: workshop.id,
        name: workshop.name,
        displayName: workshop.business?.name ?? workshop.name,
        location: workshop.location,
        capacity: workshop.capacity,
        qrCode: workshop.qrCode,
        type: workshop.type,
        totalScans: parseInt(workshopStats?.totalScans ?? '0'),
        uniqueStudents: parseInt(workshopStats?.uniqueStudents ?? '0'),
        account: account
          ? {
              id: account.id,
              email: account.email,
              name: account.name,
              isActive: account.isActive,
              createdAt: account.createdAt,
            }
          : null,
        hasAccount: !!account,
      };
    });
  }

  // GET /school-admin/workshops/:boothId
  async getWorkshopDetail(boothId: string) {
    const booth = await this.boothRepo.findOne({
      where: { id: boothId, type: BoothType.WORKSHOP },
      relations: ['business'],
    });
    if (!booth) throw new NotFoundException('Workshop không tồn tại');

    const account = await this.userRepo.findOne({ where: { boothId } });

    const [totalScans, uniqueResult, recentCheckins, departmentDistribution] =
      await Promise.all([
        this.checkinRepo.count({ where: { boothId } }),
        this.checkinRepo
          .createQueryBuilder('c')
          .select('COUNT(DISTINCT c.studentId)', 'count')
          .where('c.boothId = :boothId', { boothId })
          .getRawOne<{ count: string }>(),
        this.checkinRepo.find({
          where: { boothId },
          relations: ['student'],
          order: { checkInTime: 'DESC' },
          take: 10,
        }),
        this.checkinRepo
          .createQueryBuilder('c')
          .leftJoin('c.student', 's')
          .select('s.department', 'department')
          .addSelect('COUNT(DISTINCT c.studentId)', 'count')
          .where('c.boothId = :boothId AND s.department IS NOT NULL', {
            boothId,
          })
          .groupBy('s.department')
          .orderBy('count', 'DESC')
          .getRawMany<{ department: string; count: string }>(),
      ]);

    return {
      workshop: {
        id: booth.id,
        name: booth.name,
        displayName: booth.business?.name ?? booth.name,
        businessId: booth.businessId,
        business: booth.business?.name ?? booth.name,
        location: booth.location,
        capacity: booth.capacity,
        qrCode: booth.qrCode,
        type: booth.type,
      },
      account: account
        ? {
            id: account.id,
            email: account.email,
            name: account.name,
            isActive: account.isActive,
            createdAt: account.createdAt,
          }
        : null,
      stats: {
        totalScans,
        uniqueStudents: parseInt(uniqueResult?.count ?? '0'),
      },
      departmentDistribution: departmentDistribution.map((item) => ({
        department: item.department,
        count: parseInt(item.count),
      })),
      recentCheckins: recentCheckins.map((checkin) => ({
        id: checkin.id,
        checkInTime: checkin.checkInTime,
        student: {
          id: checkin.student?.id,
          fullName: checkin.student?.fullName,
          studentCode: checkin.student?.studentCode,
          className: checkin.student?.className ?? null,
          department: checkin.student?.department ?? null,
          phone: checkin.student?.phone ?? null,
        },
      })),
    };
  }

  // POST /school-admin/workshops/:boothId/account
  async createWorkshopAccount(
    boothId: string,
    dto: CreateWorkshopAccountDto,
  ) {
    const workshop = await this.boothRepo.findOne({
      where: { id: boothId, type: BoothType.WORKSHOP },
      relations: ['business'],
    });
    if (!workshop) throw new NotFoundException('Workshop không tồn tại');

    const existingForWorkshop = await this.userRepo.findOne({ where: { boothId } });
    if (existingForWorkshop) {
      throw new BadRequestException('Workshop này đã có tài khoản');
    }

    const existingEmail = await this.userRepo.findOne({
      where: { email: dto.email.trim() },
    });
    if (existingEmail) {
      throw new BadRequestException('Email đã được sử dụng');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = await this.userRepo.save(
      this.userRepo.create({
        email: dto.email.trim(),
        passwordHash,
        name: dto.name?.trim() || workshop.business?.name || workshop.name,
        role: UserRole.BUSINESS_ADMIN,
        isActive: true,
        boothId: workshop.id,
      }),
    );

    return {
      message: 'Đã tạo tài khoản cho workshop',
      workshop: {
        id: workshop.id,
        name: workshop.name,
        displayName: workshop.business?.name ?? workshop.name,
        type: workshop.type,
      },
      account: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        isActive: user.isActive,
      },
    };
  }

  // PATCH /school-admin/workshops/:boothId/account
  async updateWorkshopAccount(boothId: string, dto: UpdateWorkshopAccountDto) {
    const workshop = await this.boothRepo.findOne({
      where: { id: boothId, type: BoothType.WORKSHOP },
    });
    if (!workshop) throw new NotFoundException('Workshop không tồn tại');

    const user = await this.userRepo.findOne({ where: { boothId } });
    if (!user) {
      throw new NotFoundException('Tài khoản cho workshop này chưa được tạo');
    }

    if (dto.email && dto.email.trim() !== user.email) {
      const duplicateUser = await this.userRepo.findOne({ where: { email: dto.email.trim().toLowerCase() } });
      if (duplicateUser && duplicateUser.id !== user.id) {
        throw new BadRequestException('Email đã tồn tại trong hệ thống');
      }
      user.email = dto.email.trim().toLowerCase();
    }

    if (dto.name && dto.name.trim() !== '') {
      user.name = dto.name.trim();
    }

    if (dto.password && dto.password.trim() !== '') {
      user.passwordHash = await bcrypt.hash(dto.password, 10);
    }

    await this.userRepo.save(user);

    return {
      message: 'Cập nhật tài khoản workshop thành công',
      account: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        isActive: user.isActive,
        boothId: user.boothId,
      },
    };
  }

  async exportBusinessBoothVisitorsExcel() {
    const rows = await this.studentRepo.createQueryBuilder('s')
      .innerJoin('s.checkins', 'c')
      .innerJoin('c.booth', 'b')
      .select([
        's.id as id',
        's.fullName as "fullName"',
        's.studentCode as "studentCode"',
        's.className as "className"',
        's.department as department',
        's.year as year',
        's.email as email',
        's.phone as phone'
      ])
      .addSelect('COUNT(DISTINCT c."boothId")', 'visitedCount')
      .where('b.type = :type', { type: BoothType.BOOTH })
      .groupBy('s.id')
      .orderBy('"visitedCount"', 'DESC')
      .addOrderBy('s."studentCode"', 'ASC')
      .getRawMany();

    const headers = ['STT', 'Họ và tên', 'MSSV', 'Lớp', 'Khoa', 'Năm học', 'SĐT', 'Email', 'Số gian hàng doanh nghiệp đã ghé'];
    const bodyRows = rows.map((row, idx) => [
        (idx + 1).toString(),
        row.fullName ?? '',
        row.studentCode ?? '',
        row.className ?? '',
        row.department ?? '',
        row.year?.toString() ?? '',
        row.phone ?? '',
        row.email ?? '',
        row.visitedCount?.toString() ?? '1',
    ]);

    const escapeXmlLocal = (value: string) => {
        return value
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&apos;');
    };

    const xmlRows = [headers, ...bodyRows]
        .map(
            (columns) =>
                `<Row>${columns
                    .map(
                        (value) =>
                            `<Cell><Data ss:Type="String">${escapeXmlLocal(value)}</Data></Cell>`,
                    )
                    .join('')}</Row>`,
        )
        .join('');

    const xml =
        '<?xml version="1.0" encoding="UTF-8"?>\n' +
        '<?mso-application progid="Excel.Sheet"?>\n' +
        '<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" \n' +
        'xmlns:o="urn:schemas-microsoft-com:office:office" \n' +
        'xmlns:x="urn:schemas-microsoft-com:office:excel" \n' +
        'xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">\n' +
        '<Worksheet ss:Name="Danh sach SV tham gia booth">\n' +
        '<Table>\n' +
        xmlRows +
        '</Table>\n' +
        '</Worksheet>\n' +
        '</Workbook>';

    const today = new Date();
    const dateStr = today.toISOString().split('T')[0];

    return {
        fileName: `booth-visitors-${dateStr}.xls`,
        xml,
    };
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

  // GET /school-admin/business-accounts
  async getBusinessAccounts() {
    const booths = await this.boothRepo.find({
      where: { type: BoothType.BOOTH },
      relations: ['business'],
      order: { createdAt: 'DESC' },
    });

    const boothIds = booths.map((b) => b.id);
    const accountMap = new Map<string, User>();
    if (boothIds.length > 0) {
      const accounts = await this.userRepo.find({
        where: boothIds.map((id) => ({ boothId: id })),
        order: { createdAt: 'ASC' },
      });
      for (const account of accounts) {
        if (account.boothId && !accountMap.has(account.boothId)) {
          accountMap.set(account.boothId, account);
        }
      }
    }

    const stats = await this.checkinRepo
      .createQueryBuilder('c')
      .select('c.boothId', 'boothId')
      .addSelect('COUNT(*)', 'totalScans')
      .addSelect('COUNT(DISTINCT c.studentId)', 'uniqueStudents')
      .where('c.boothId IN (:...ids)', { ids: boothIds.length ? boothIds : ['00000000-0000-0000-0000-000000000000'] })
      .groupBy('c.boothId')
      .getRawMany<{ boothId: string; totalScans: string; uniqueStudents: string }>();
    const statsMap = new Map(stats.map((item) => [item.boothId, item]));

    return booths.map((booth) => {
      const account = accountMap.get(booth.id);
      const boothStats = statsMap.get(booth.id);
      return {
        id: booth.id,
        name: booth.name,
        displayName: booth.business?.name ?? booth.name,
        businessId: booth.businessId,
        type: booth.type,
        totalScans: parseInt(boothStats?.totalScans ?? '0'),
        uniqueStudents: parseInt(boothStats?.uniqueStudents ?? '0'),
        account: account
          ? {
              id: account.id,
              email: account.email,
              name: account.name,
              isActive: account.isActive,
              createdAt: account.createdAt,
            }
          : null,
      };
    });
  }

  // POST /school-admin/business-accounts
  async createBusinessAccount(dto: CreateBusinessAccountDto) {
    const existingEmail = await this.userRepo.findOne({
      where: { email: dto.email.trim() },
    });
    if (existingEmail) {
      throw new BadRequestException('Email đã được sử dụng');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);

    return this.userRepo.manager.transaction(async (manager) => {
      // 1. Create Business
      const business = manager.create(Business, {
        name: dto.name.trim(),
        type: BusinessType.BOOTH,
        description: `Gian hàng doanh nghiệp: ${dto.name.trim()}`,
      });
      const savedBusiness = await manager.save(business);

      // 2. Create Booth
      const boothCode = randomUUID().replace(/-/g, '').substring(0, 8).toUpperCase();
      const booth = manager.create(Booth, {
        name: dto.name.trim(),
        businessId: savedBusiness.id,
        capacity: 50,
        type: BoothType.BOOTH,
        qrCode: `BOOTH-${boothCode}`,
      });
      const savedBooth = await manager.save(booth);

      // 3. Create User
      const user = manager.create(User, {
        email: dto.email.trim(),
        passwordHash,
        name: dto.name.trim(),
        role: UserRole.BUSINESS_ADMIN,
        isActive: true,
        boothId: savedBooth.id,
      });
      const savedUser = await manager.save(user);

      return {
        message: 'Tạo tài khoản doanh nghiệp thành công',
        business: savedBusiness,
        booth: savedBooth,
        account: {
          id: savedUser.id,
          email: savedUser.email,
          name: savedUser.name,
          role: savedUser.role,
        },
      };
    });
  }

  // DELETE /school-admin/business-accounts/:userId
  async deleteBusinessAccount(userId: string) {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('Tài khoản không tồn tại');
    if (!user.boothId) throw new BadRequestException('Tài khoản không liên kết với gian hàng nào');

    const booth = await this.boothRepo.findOne({ where: { id: user.boothId } });
    if (!booth) throw new NotFoundException('Gian hàng không tồn tại');

    return this.userRepo.manager.transaction(async (manager) => {
      await manager.delete(User, { id: userId });
      await manager.delete(Business, { id: booth.businessId });
      return { message: 'Đã xoá tài khoản và dữ liệu gian hàng thành công' };
    });
  }
}
