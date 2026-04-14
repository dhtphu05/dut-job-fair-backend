import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Booth, BoothType } from '../entities/booth.entity';
import { Checkin } from '../entities/checkin.entity';
import { Student } from '../entities/student.entity';
import { UserRole } from '../entities/user.entity';
import { CreateWorkshopAttendanceDto } from './dto/workshop-attendance.dto';

type AuthenticatedBusinessAdminUser = {
    id: string;
    role: UserRole;
    boothId?: string | null;
};

type WorkshopAttendanceRow = {
    stt: number;
    studentId: string;
    workshopName: string;
    fullName: string;
    studentCode: string;
    className: string | null;
    department: string | null;
    phone: string | null;
    checkInTime: string;
};

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
        const boothOnlyCount = booths.filter((b) => b.type === BoothType.BOOTH).length;
        const workshopCount = booths.filter((b) => b.type === BoothType.WORKSHOP).length;

        if (boothIds.length === 0) {
            return {
                stats: {
                    totalVisitors: 0,
                    uniqueVisitors: 0,
                    totalBooths: 0,
                    totalWorkshops: 0,
                    byType: {
                        booth: { totalUnits: 0, totalVisitors: 0, uniqueVisitors: 0 },
                        workshop: { totalUnits: 0, totalVisitors: 0, uniqueVisitors: 0 },
                    },
                }, booths: []
            };
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

        const groupedByType = await this.checkinRepo
            .createQueryBuilder('c')
            .leftJoin('c.booth', 'booth')
            .select('booth.type', 'type')
            .addSelect('COUNT(*)', 'totalVisitors')
            .addSelect('COUNT(DISTINCT c.studentId)', 'uniqueVisitors')
            .where('c.boothId IN (:...ids)', { ids: boothIds })
            .groupBy('booth.type')
            .getRawMany<{ type: BoothType; totalVisitors: string; uniqueVisitors: string }>();

        const byTypeStats = {
            booth: { totalUnits: boothOnlyCount, totalVisitors: 0, uniqueVisitors: 0 },
            workshop: { totalUnits: workshopCount, totalVisitors: 0, uniqueVisitors: 0 },
        };

        for (const row of groupedByType) {
            const key = row.type === BoothType.WORKSHOP ? 'workshop' : 'booth';
            byTypeStats[key] = {
                ...byTypeStats[key],
                totalVisitors: parseInt(row.totalVisitors),
                uniqueVisitors: parseInt(row.uniqueVisitors),
            };
        }

        const recentScans = await this.checkinRepo.find({
            where: boothIds.map((id) => ({ boothId: id })),
            relations: ['student', 'booth', 'booth.business'],
            order: { checkInTime: 'DESC' },
            take: 10,
        });

        return {
            stats: {
                totalVisitors: totalCheckins,
                uniqueVisitors: parseInt(uniqueResult?.count ?? '0'),
                totalBooths: boothOnlyCount,
                totalWorkshops: workshopCount,
                byType: byTypeStats,
            },
            booths: booths.map((b) => ({ id: b.id, name: b.name, location: b.location, capacity: b.capacity, type: b.type })),
            recentScans: recentScans.map((c) => ({
                id: c.id,
                student: {
                    id: c.student?.id,
                    fullName: c.student?.fullName,
                    studentCode: c.student?.studentCode,
                    department: c.student?.department ?? null,
                    phone: c.student?.phone ?? null,
                },
                checkInTime: c.checkInTime,
                booth: c.booth?.business?.name ?? c.booth?.name,
                boothName: c.booth?.name,
                boothType: c.booth?.type ?? BoothType.BOOTH,
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

        // Day distribution by calendar date in the current demo dataset
        const daily = await this.checkinRepo
            .createQueryBuilder('c')
            .select("DATE(c.checkInTime)", 'date')
            .addSelect('COUNT(*)', 'count')
            .addSelect('COUNT(DISTINCT c.studentId)', 'uniqueStudents')
            .where('c.boothId = :id', { id: boothId })
            .groupBy("DATE(c.checkInTime)")
            .orderBy('date')
            .getRawMany<{ date: string; count: string; uniqueStudents: string }>();

        // Department distribution from check-ins of this booth
        const departmentDist = await this.checkinRepo
            .createQueryBuilder('c')
            .leftJoin('c.student', 's')
            .select('s.department', 'department')
            .addSelect('COUNT(*)', 'count')
            .where('c.boothId = :id AND s.department IS NOT NULL', { id: boothId })
            .groupBy('s.department')
            .orderBy('count', 'DESC')
            .getRawMany<{ department: string; count: string }>();

        return {
            booth: { id: booth.id, name: booth.name, location: booth.location, type: booth.type },
            stats: {
                totalVisitors: total,
                uniqueVisitors: parseInt(uniqueResult?.count ?? '0'),
            },
            hourlyDistribution: hourly.map((h) => ({ hour: parseInt(h.hour), count: parseInt(h.count) })),
            dailyDistribution: daily.map((d) => ({
                date: d.date,
                count: parseInt(d.count),
                uniqueStudents: parseInt(d.uniqueStudents),
            })),
            departmentDistribution: departmentDist.map((d) => ({
                department: d.department,
                count: parseInt(d.count),
            })),
        };
    }

    // GET /business-admin/visitors?boothId=uuid&page=1&pageSize=20
    async getVisitors(boothId: string, page = 1, pageSize = 20) {
        const [checkins, total] = await this.checkinRepo.findAndCount({
            where: { boothId },
            relations: ['student', 'student.school', 'booth'],
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
                    email: c.student?.email ?? null,
                    phone: c.student?.phone ?? null,
                    department: (c.student as any)?.department ?? null,
                    className: (c.student as any)?.className ?? null,
                    year: c.student?.year,
                    school: c.student?.school?.name ?? null,
                },
                checkInTime: c.checkInTime,
                durationMinutes: c.durationMinutes,
                status: c.status,
                boothType: c.booth?.type ?? BoothType.BOOTH,
            })),
            total,
            page,
            pageSize,
            hasMore: page * pageSize < total,
        };
    }

    async getWorkshopAttendanceReport(
        user: AuthenticatedBusinessAdminUser,
        requestedBoothId?: string,
    ) {
        const booth = await this.resolveWorkshopBooth(user, requestedBoothId);
        const rows = await this.getWorkshopAttendanceRows(booth.id);

        return {
            workshop: {
                id: booth.id,
                name: booth.name,
                displayName: booth.business?.name ?? booth.name,
                location: booth.location,
                business: booth.business?.name ?? booth.name,
                type: booth.type,
            },
            total: rows.length,
            items: rows,
        };
    }

    async getWorkshopAttendanceExportData(
        user: AuthenticatedBusinessAdminUser,
        requestedBoothId?: string,
    ) {
        const booth = await this.resolveWorkshopBooth(user, requestedBoothId);
        const rows = await this.getWorkshopAttendanceRows(booth.id);

        return {
            fileName: this.buildWorkshopAttendanceExcelFileName(booth.name),
            sheetName: 'Điểm danh hội thảo',
            workshop: {
                id: booth.id,
                name: booth.name,
                displayName: booth.business?.name ?? booth.name,
                location: booth.location,
                type: booth.type,
            },
            columns: [
                { key: 'stt', title: 'STT' },
                { key: 'workshopName', title: 'Tên hội thảo' },
                { key: 'fullName', title: 'Họ và tên' },
                { key: 'studentCode', title: 'MSSV' },
                { key: 'className', title: 'Lớp' },
                { key: 'department', title: 'Khoa' },
                { key: 'phone', title: 'SĐT' },
                { key: 'checkInTime', title: 'Thời gian điểm danh' },
            ],
            rows: rows.map((row) => ({
                stt: row.stt,
                workshopName: row.workshopName,
                fullName: row.fullName,
                studentCode: row.studentCode,
                className: row.className ?? '',
                department: row.department ?? '',
                phone: row.phone ?? '',
                checkInTime: row.checkInTime,
            })),
            total: rows.length,
        };
    }

    async createWorkshopAttendanceManual(
        user: AuthenticatedBusinessAdminUser,
        dto: CreateWorkshopAttendanceDto,
        requestedBoothId?: string,
    ) {
        const booth = await this.resolveWorkshopBooth(user, requestedBoothId);
        const existingStudent = await this.studentRepo.findOne({
            where: { studentCode: dto.studentCode.trim() },
        });

        const studentPayload: Partial<Student> = {
            studentCode: dto.studentCode.trim(),
            fullName: dto.fullName.trim(),
            email: dto.email?.trim() || null,
            phone: dto.phone?.trim() || null,
            className: dto.className?.trim() || null,
            department: dto.department?.trim() || null,
            major: null,
            year: this.deriveYearFromStudentCode(dto.studentCode),
        };

        let student: Student;
        if (existingStudent) {
            Object.assign(existingStudent, studentPayload);
            student = await this.studentRepo.save(existingStudent);
        } else {
            student = await this.studentRepo.save(
                this.studentRepo.create(studentPayload),
            );
        }

        const duplicate = await this.checkinRepo.findOne({
            where: { studentId: student.id, boothId: booth.id },
            order: { checkInTime: 'ASC' },
        });
        if (duplicate) {
            throw new BadRequestException(
                `Sinh viên ${student.studentCode} đã có trong danh sách điểm danh của hội thảo này`,
            );
        }

        const checkin = await this.checkinRepo.save(
            this.checkinRepo.create({
                studentId: student.id,
                boothId: booth.id,
                status: 'active',
                notes: 'Điểm danh thủ công',
            }),
        );

        if (dto.checkInTime) {
            await this.checkinRepo.update(checkin.id, {
                checkInTime: new Date(dto.checkInTime),
            });
        }

        const refreshedRows = await this.getWorkshopAttendanceRows(booth.id);
        const createdRow = refreshedRows.find(
            (row) => row.studentCode === student.studentCode,
        );

        return {
            message: 'Đã thêm sinh viên vào danh sách điểm danh hội thảo',
            workshop: {
                id: booth.id,
                name: booth.name,
                displayName: booth.business?.name ?? booth.name,
                type: booth.type,
            },
            item: createdRow ?? null,
        };
    }

    async deleteWorkshopAttendance(
        user: AuthenticatedBusinessAdminUser,
        studentCode: string,
        requestedBoothId?: string,
    ) {
        const booth = await this.resolveWorkshopBooth(user, requestedBoothId);
        const normalizedStudentCode = studentCode.trim();
        const student = await this.studentRepo.findOne({
            where: { studentCode: normalizedStudentCode },
        });
        if (!student) {
            throw new NotFoundException(
                `Không tìm thấy sinh viên với MSSV ${normalizedStudentCode}`,
            );
        }

        const checkins = await this.checkinRepo.find({
            where: { boothId: booth.id, studentId: student.id },
        });
        if (checkins.length === 0) {
            throw new NotFoundException(
                `Sinh viên ${normalizedStudentCode} không có trong danh sách điểm danh của hội thảo này`,
            );
        }

        await this.checkinRepo.remove(checkins);

        return {
            message: 'Đã xoá sinh viên khỏi danh sách điểm danh hội thảo',
            deletedStudentCode: normalizedStudentCode,
            deletedCheckins: checkins.length,
            workshop: {
                id: booth.id,
                name: booth.name,
                displayName: booth.business?.name ?? booth.name,
                type: booth.type,
            },
        };
    }

    async exportWorkshopAttendanceCsv(
        user: AuthenticatedBusinessAdminUser,
        requestedBoothId?: string,
    ) {
        const booth = await this.resolveWorkshopBooth(user, requestedBoothId);
        const rows = await this.getWorkshopAttendanceRows(booth.id);
        const headers = ['STT', 'Tên hội thảo', 'Họ và tên', 'MSSV', 'Lớp', 'Khoa', 'SĐT', 'Thời gian điểm danh'];
        const csvRows = rows.map((row) => [
            row.stt.toString(),
            row.workshopName,
            row.fullName,
            row.studentCode,
            row.className ?? '',
            row.department ?? '',
            row.phone ?? '',
            row.checkInTime,
        ]);

        const csv = [headers, ...csvRows]
            .map((columns) =>
                columns.map((value) => this.escapeCsvValue(value)).join(','),
            )
            .join('\n');

        return {
            fileName: this.buildWorkshopAttendanceFileName(booth.name),
            total: rows.length,
            csv,
        };
    }

    async exportWorkshopAttendanceExcel(
        user: AuthenticatedBusinessAdminUser,
        requestedBoothId?: string,
    ) {
        const booth = await this.resolveWorkshopBooth(user, requestedBoothId);
        const rows = await this.getWorkshopAttendanceRows(booth.id);
        const headers = ['STT', 'Tên hội thảo', 'Họ và tên', 'MSSV', 'Lớp', 'Khoa', 'SĐT', 'Thời gian điểm danh'];
        const bodyRows = rows.map((row) => [
            row.stt.toString(),
            row.workshopName,
            row.fullName,
            row.studentCode,
            row.className ?? '',
            row.department ?? '',
            row.phone ?? '',
            row.checkInTime,
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
            '<Worksheet ss:Name="Điểm danh hội thảo">' +
            '<Table>' +
            xmlRows +
            '</Table>' +
            '</Worksheet>' +
            '</Workbook>';

        return {
            fileName: this.buildWorkshopAttendanceExcelFileName(booth.name),
            total: rows.length,
            xml,
        };
    }

    private async resolveWorkshopBooth(
        user: AuthenticatedBusinessAdminUser,
        requestedBoothId?: string,
    ) {
        const boothId =
            user.role === UserRole.SYSTEM_ADMIN || user.role === UserRole.SCHOOL_ADMIN
                ? requestedBoothId
                : user.boothId;

        if (!boothId) {
            throw new ForbiddenException(
                'Tài khoản này chưa được gán workshop để xem báo cáo',
            );
        }

        const booth = await this.boothRepo.findOne({
            where: { id: boothId },
            relations: ['business'],
        });
        if (!booth) throw new NotFoundException('Workshop không tồn tại');
        if (booth.type !== BoothType.WORKSHOP) {
            throw new ForbiddenException(
                'Tài khoản này không thuộc workshop nên không thể xuất báo cáo workshop',
            );
        }

        return booth;
    }

    private async getWorkshopAttendanceRows(
        boothId: string,
    ): Promise<WorkshopAttendanceRow[]> {
        const booth = await this.boothRepo.findOne({
            where: { id: boothId },
            relations: ['business'],
        });
        if (!booth) throw new NotFoundException('Workshop không tồn tại');

        const checkins = await this.checkinRepo.find({
            where: { boothId },
            relations: ['student'],
            order: { checkInTime: 'ASC' },
        });

        const seenStudentIds = new Set<string>();
        const rows: WorkshopAttendanceRow[] = [];

        for (const checkin of checkins) {
            if (!checkin.student || seenStudentIds.has(checkin.studentId)) continue;
            seenStudentIds.add(checkin.studentId);

            rows.push({
                stt: rows.length + 1,
                studentId: checkin.student.id,
                workshopName: booth.business?.name ?? booth.name,
                fullName: checkin.student.fullName,
                studentCode: checkin.student.studentCode,
                className: checkin.student.className ?? null,
                department: checkin.student.department ?? null,
                phone: checkin.student.phone ?? null,
                checkInTime: this.formatCheckInTime(checkin.checkInTime),
            });
        }

        return rows;
    }

    private escapeCsvValue(value: string) {
        const normalized = value.replace(/"/g, '""');
        return `"${normalized}"`;
    }

    private buildWorkshopAttendanceFileName(workshopName: string) {
        const slug = this.slugify(workshopName);
        return `workshop-attendance-${slug || 'report'}.csv`;
    }

    private buildWorkshopAttendanceExcelFileName(workshopName: string) {
        const slug = this.slugify(workshopName);
        return `workshop-attendance-${slug || 'report'}.xls`;
    }

    private slugify(value: string) {
        const slug = value
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/đ/g, 'd')
            .replace(/Đ/g, 'D')
            .replace(/[^a-zA-Z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '')
            .toLowerCase();
        return slug;
    }

    private formatCheckInTime(value: Date) {
        const date = new Date(value);
        const pad = (input: number) => input.toString().padStart(2, '0');
        return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
    }

    private deriveYearFromStudentCode(studentCode: string) {
        const code = studentCode.trim();
        if (code.length < 5) return null;
        const yearStr = code.slice(3, 5);
        const yearMap: Record<string, number> = {
            '25': 1,
            '24': 2,
            '23': 3,
            '22': 4,
            '21': 5,
            '20': 6,
            '19': 7,
            '18': 8,
        };
        return yearMap[yearStr] ?? null;
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
