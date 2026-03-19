import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Checkin } from '../entities/checkin.entity';
import { Student } from '../entities/student.entity';
import { Booth } from '../entities/booth.entity';
import { QrScanDto, ScanDto } from './dto/scan.dto';
import { UserRole } from '../entities/user.entity';

type AuthenticatedScannerUser = {
  id: string;
  role: UserRole;
  boothId?: string | null;
};

@Injectable()
export class ScannerService {
  constructor(
    @InjectRepository(Checkin)
    private readonly checkinRepo: Repository<Checkin>,
    @InjectRepository(Student)
    private readonly studentRepo: Repository<Student>,
    @InjectRepository(Booth)
    private readonly boothRepo: Repository<Booth>,
    private readonly dataSource: DataSource,
  ) {}

  // POST /scanner/scan  – QR scan with MSSV (student_code)
  async scan(dto: ScanDto, user: AuthenticatedScannerUser) {
    const boothId = this.ensureBoothAccess(dto.boothId, user);
    const student = await this.studentRepo.findOne({
      where: { studentCode: dto.visitorCode },
    });
    if (!student) {
      return {
        success: false,
        status: 'error',
        message: `Sinh viên có mã ${dto.visitorCode} chưa đăng ký`,
      };
    }

    const booth = await this.getBoothForScan(boothId);
    if (!booth) {
      return {
        success: false,
        status: 'error',
        message: 'Gian hàng không tồn tại',
      };
    }

    const checkin = await this.createCheckinAtomically({
      studentId: student.id,
      boothId,
      notes: dto.notes,
    });

    if (!checkin.created) {
      return {
        success: false,
        status: 'duplicate',
        message: 'Sinh viên đã check-in vào gian hàng này gần đây',
        scanId: checkin.record.id,
        visitor: this.formatVisitor(student),
      };
    }

    return {
      success: true,
      status: 'success',
      message: `Check-in thành công: ${student.fullName}`,
      scanId: checkin.record.id,
      visitor: this.formatVisitor(student),
      booth: { id: booth.id, name: booth.name, business: booth.businessName },
    };
  }

  // POST /scanner/scan-qr – nhận payload QR từ DUT + boothId
  async scanByQrData(dto: QrScanDto, user: AuthenticatedScannerUser) {
    const boothId = this.ensureBoothAccess(dto.boothId, user);
    const booth = await this.getBoothForScan(boothId);
    if (!booth) {
      return {
        success: false,
        status: 'error',
        message: 'Gian hàng không tồn tại',
      };
    }

    const student = await this.upsertStudentFromQr(dto);
    const checkin = await this.createCheckinAtomically({
      studentId: student.id,
      boothId,
      notes: dto.notes,
    });

    if (!checkin.created) {
      return {
        success: false,
        status: 'duplicate',
        message: 'Sinh viên đã check-in vào gian hàng này gần đây',
        scanId: checkin.record.id,
        visitor: this.formatVisitor(student),
      };
    }

    return {
      success: true,
      status: 'success',
      message: `Check-in thành công: ${student.fullName}`,
      scanId: checkin.record.id,
      visitor: this.formatVisitor(student),
      booth: { id: booth.id, name: booth.name, business: booth.businessName },
    };
  }

  // GET /scanner/visitor/:visitorId
  async getVisitor(visitorId: string) {
    const student = await this.studentRepo.findOne({
      where: { id: visitorId },
    });
    if (!student) throw new BadRequestException('Sinh viên không tồn tại');
    return this.formatVisitor(student);
  }

  // GET /scanner/scans?boothId=&page=1&pageSize=10
  async getScans(
    boothId: string,
    user: AuthenticatedScannerUser,
    page = 1,
    pageSize = 10,
  ) {
    const allowedBoothId = this.ensureBoothAccess(boothId, user);
    const [checkins, total] = await this.checkinRepo.findAndCount({
      where: { boothId: allowedBoothId },
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

  // GET /scanner/recent-scans?boothId=
  async getRecentScans(
    boothId: string,
    user: AuthenticatedScannerUser,
    limit = 10,
  ) {
    const allowedBoothId = this.ensureBoothAccess(boothId, user);
    const checkins = await this.checkinRepo.find({
      where: { boothId: allowedBoothId },
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

  // GET /scanner/checkins?boothId=&page=&pageSize= – danh sách toàn bộ sinh viên check-in
  async getAllCheckins(
    boothId: string,
    user: AuthenticatedScannerUser,
    page = 1,
    pageSize = 20,
  ) {
    const allowedBoothId = this.ensureBoothAccess(boothId, user);
    const [checkins, total] = await this.checkinRepo.findAndCount({
      where: { boothId: allowedBoothId },
      relations: ['student'],
      order: { checkInTime: 'DESC' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });

    return {
      items: checkins.map((c) => ({
        checkinId: c.id,
        checkInTime: c.checkInTime,
        status: c.status,
        student: {
          id: c.student?.id,
          studentCode: c.student?.studentCode,
          fullName: c.student?.fullName,
          email: c.student?.email,
          phone: c.student?.phone,
          major: c.student?.major,
        },
      })),
      total,
      page,
      pageSize,
      hasMore: page * pageSize < total,
    };
  }

  private ensureBoothAccess(
    requestedBoothId: string,
    user: AuthenticatedScannerUser,
  ) {
    if (user.role === UserRole.SYSTEM_ADMIN) return requestedBoothId;
    if (!user.boothId) {
      throw new ForbiddenException('Tài khoản chưa được gán gian hàng');
    }
    if (user.boothId !== requestedBoothId) {
      throw new ForbiddenException(
        'Bạn không có quyền thao tác trên gian hàng này',
      );
    }
    return user.boothId;
  }

  private async getBoothForScan(boothId: string) {
    return this.boothRepo
      .createQueryBuilder('booth')
      .leftJoin('booth.business', 'business')
      .select([
        'booth.id AS id',
        'booth.name AS name',
        'business.name AS "businessName"',
      ])
      .where('booth.id = :boothId', { boothId })
      .getRawOne<{ id: string; name: string; businessName: string | null }>();
  }

  private async upsertStudentFromQr(dto: QrScanDto) {
    await this.studentRepo.upsert(
      {
        studentCode: dto.ma_so_sinh_vien,
        fullName: dto.ho_ten,
        email: dto.email ?? null,
        phone: dto.phone ?? null,
        major: dto.lop,
      },
      ['studentCode'],
    );

    const student = await this.studentRepo.findOne({
      where: { studentCode: dto.ma_so_sinh_vien },
    });
    if (!student) {
      throw new BadRequestException('Không thể đồng bộ thông tin sinh viên');
    }
    return student;
  }

  private async createCheckinAtomically(input: {
    studentId: string;
    boothId: string;
    notes?: string;
  }) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      await queryRunner.query(
        'SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))',
        [input.studentId, input.boothId],
      );

      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      const recent = await queryRunner.manager
        .createQueryBuilder(Checkin, 'c')
        .where('c.studentId = :sid', { sid: input.studentId })
        .andWhere('c.boothId = :bid', { bid: input.boothId })
        .andWhere('c.checkInTime > :limit', { limit: fiveMinutesAgo })
        .orderBy('c.checkInTime', 'DESC')
        .getOne();

      if (recent) {
        await queryRunner.commitTransaction();
        return { created: false, record: recent };
      }

      const saved = await queryRunner.manager.save(
        Checkin,
        queryRunner.manager.create(Checkin, {
          studentId: input.studentId,
          boothId: input.boothId,
          notes: input.notes,
          status: 'active',
        }),
      );

      await queryRunner.commitTransaction();
      return { created: true, record: saved };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
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
