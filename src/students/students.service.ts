import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Student } from '../entities/student.entity';
import { CreateStudentDto, UpdateStudentDto } from './dto/student.dto';

type EligibleStudentExportRow = {
  studentCode: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  major: string | null;
  department: string | null;
  className: string | null;
  year: number | null;
  schoolName: string | null;
  totalCheckins: number;
  uniqueBooths: number;
  firstCheckInTime: string | null;
  lastCheckInTime: string | null;
};

type EligibleStudentExportData = {
  studentCode: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  major: string | null;
  department: string | null;
  className: string | null;
  year: number | null;
  schoolName: string | null;
  totalCheckins: number;
  uniqueBooths: number;
  firstCheckInTime: string | null;
  lastCheckInTime: string | null;
};

@Injectable()
export class StudentsService {
  constructor(
    @InjectRepository(Student)
    private readonly repo: Repository<Student>,
  ) {}

  async findAll(page = 1, pageSize = 20, search?: string) {
    const qb = this.repo
      .createQueryBuilder('s')
      .leftJoinAndSelect('s.school', 'school');
    if (search) {
      qb.where(
        's.fullName ILIKE :q OR s.studentCode ILIKE :q OR s.email ILIKE :q',
        { q: `%${search}%` },
      );
    }
    const [items, total] = await qb
      .orderBy('s.createdAt', 'DESC')
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();
    return { items, total, page, pageSize, hasMore: page * pageSize < total };
  }

  async findOne(id: string) {
    const student = await this.repo.findOne({
      where: { id },
      relations: ['school', 'checkins'],
    });
    if (!student) throw new NotFoundException('Sinh viên không tồn tại');
    return student;
  }

  async create(dto: CreateStudentDto) {
    const exists = await this.repo.findOne({
      where: { studentCode: dto.studentCode },
    });
    if (exists)
      throw new ConflictException(`Mã sinh viên ${dto.studentCode} đã tồn tại`);
    return this.repo.save(this.repo.create(dto));
  }

  async update(id: string, dto: UpdateStudentDto) {
    const student = await this.findOne(id);
    Object.assign(student, dto);
    return this.repo.save(student);
  }

  async remove(id: string) {
    const student = await this.findOne(id);
    await this.repo.remove(student);
    return { message: 'Đã xóa sinh viên thành công' };
  }

  async exportEligibleStudentsCsv(threshold: number) {
    const rows = await this.getEligibleStudentExportData(threshold);

    const headers = [
      'MSSV',
      'Ho va ten',
      'Email',
      'So dien thoai',
      'Nganh',
      'Khoa',
      'Lop',
      'Nam hoc',
      'Truong',
      'Tong check-in',
      'So booth da tham gia',
      'Check-in dau tien',
      'Check-in gan nhat',
    ];

    const csvRows = rows.map((row) => [
      row.studentCode,
      row.fullName,
      row.email ?? '',
      row.phone ?? '',
      row.major ?? '',
      row.department ?? '',
      row.className ?? '',
      row.year?.toString() ?? '',
      row.schoolName ?? '',
      row.totalCheckins?.toString() ?? '0',
      row.uniqueBooths?.toString() ?? '0',
      row.firstCheckInTime ?? '',
      row.lastCheckInTime ?? '',
    ]);

    const csv = [headers, ...csvRows]
      .map((columns) =>
        columns.map((value) => this.escapeCsvValue(value)).join(','),
      )
      .join('\n');

    return {
      fileName: `eligible-students-threshold-${threshold}.csv`,
      total: rows.length,
      csv,
    };
  }

  async exportEligibleStudentsExcel(threshold: number) {
    const rows = await this.getEligibleStudentExportData(threshold);
    const headers = [
      'MSSV',
      'Ho va ten',
      'Email',
      'So dien thoai',
      'Nganh',
      'Khoa',
      'Lop',
      'Nam hoc',
      'Truong',
      'Tong check-in',
      'So booth da tham gia',
      'Check-in dau tien',
      'Check-in gan nhat',
    ];

    const bodyRows = rows.map((row) => [
      row.studentCode,
      row.fullName,
      row.email ?? '',
      row.phone ?? '',
      row.major ?? '',
      row.department ?? '',
      row.className ?? '',
      row.year?.toString() ?? '',
      row.schoolName ?? '',
      row.totalCheckins.toString(),
      row.uniqueBooths.toString(),
      row.firstCheckInTime ?? '',
      row.lastCheckInTime ?? '',
    ]);

    const xmlRows = [headers, ...bodyRows]
      .map(
        (columns) =>
          `<Row>${columns
            .map(
              (value) =>
                `<Cell><Data ss:Type="String">${this.escapeXml(value)}</Data></Cell>`,
            )
            .join('')}</Row>`,
      )
      .join('');

    const xml =
      '<?xml version="1.0" encoding="UTF-8"?>' +
      '<?mso-application progid="Excel.Sheet"?>' +
      '<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" ' +
      'xmlns:o="urn:schemas-microsoft-com:office:office" ' +
      'xmlns:x="urn:schemas-microsoft-com:office:excel" ' +
      'xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">' +
      '<Worksheet ss:Name="Eligible Students">' +
      '<Table>' +
      xmlRows +
      '</Table>' +
      '</Worksheet>' +
      '</Workbook>';

    return {
      fileName: `eligible-students-threshold-${threshold}.xls`,
      total: rows.length,
      xml,
    };
  }

  private async getEligibleStudentExportData(
    threshold: number,
  ): Promise<EligibleStudentExportData[]> {
    if (!Number.isInteger(threshold) || threshold <= 0) {
      throw new BadRequestException('threshold phải là số nguyên dương');
    }

    const rows = await this.repo
      .createQueryBuilder('s')
      .innerJoin('s.checkins', 'c')
      .leftJoin('s.school', 'school')
      .select('s.studentCode', 'studentCode')
      .addSelect('s.fullName', 'fullName')
      .addSelect('s.email', 'email')
      .addSelect('s.phone', 'phone')
      .addSelect('s.major', 'major')
      .addSelect('s.department', 'department')
      .addSelect('s.className', 'className')
      .addSelect('s.year', 'year')
      .addSelect('school.name', 'schoolName')
      .addSelect('COUNT(c.id)', 'totalCheckins')
      .addSelect('COUNT(DISTINCT c.boothId)', 'uniqueBooths')
      .addSelect('MIN(c.checkInTime)', 'firstCheckInTime')
      .addSelect('MAX(c.checkInTime)', 'lastCheckInTime')
      .groupBy('s.id')
      .addGroupBy('s.studentCode')
      .addGroupBy('s.fullName')
      .addGroupBy('s.email')
      .addGroupBy('s.phone')
      .addGroupBy('s.major')
      .addGroupBy('s.department')
      .addGroupBy('s.className')
      .addGroupBy('s.year')
      .addGroupBy('school.id')
      .addGroupBy('school.name')
      .having('COUNT(c.id) >= :threshold', { threshold })
      .orderBy('COUNT(c.id)', 'DESC')
      .addOrderBy('s.studentCode', 'ASC')
      .getRawMany<EligibleStudentExportRow>();

    return rows.map((row) => ({
      studentCode: row.studentCode,
      fullName: row.fullName,
      email: row.email,
      phone: row.phone,
      major: row.major,
      department: row.department,
      className: row.className,
      year: row.year ? Number(row.year) : null,
      schoolName: row.schoolName,
      totalCheckins: Number(row.totalCheckins),
      uniqueBooths: Number(row.uniqueBooths),
      firstCheckInTime: row.firstCheckInTime,
      lastCheckInTime: row.lastCheckInTime,
    }));
  }

  private escapeCsvValue(value: string) {
    const normalized = value.replace(/"/g, '""');
    return `"${normalized}"`;
  }

  private escapeXml(value: string) {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }
}
