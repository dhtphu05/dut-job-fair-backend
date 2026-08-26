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

type AttendanceRow = {
    stt: number;
    studentId: string;
    unitName: string;
    fullName: string;
    studentCode: string;
    className: string | null;
    department: string | null;
    phone: string | null;
    checkInTime: string;
};

type AttendanceConfig = {
    boothType: BoothType;
    entityKey: 'workshop' | 'totnghiep';
    entityLabel: string;
    entityLabelLower: string;
    listTitle: string;
    sheetName: string;
    filePrefix: string;
    nameField: 'workshopName' | 'totnghiepName';
    nameColumnTitle: string;
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
        const booths = await this.boothRepo.find({ where: { businessId }, relations: ['business'] });
        const boothIds = booths.map((b) => b.id);
        const totalBooths = booths.filter((b) => b.type === BoothType.BOOTH).length;
        const totalWorkshops = booths.filter((b) => b.type === BoothType.WORKSHOP).length;
        const totalTotnghieps = booths.filter((b) => b.type === BoothType.TOTNGHIEP).length;

        if (boothIds.length === 0) {
            return {
                stats: {
                    totalVisitors: 0,
                    uniqueVisitors: 0,
                    totalBooths: 0,
                    totalWorkshops: 0,
                    totalTotnghieps: 0,
                    byType: {
                        booth: { totalUnits: 0, totalVisitors: 0, uniqueVisitors: 0 },
                        workshop: { totalUnits: 0, totalVisitors: 0, uniqueVisitors: 0 },
                        totnghiep: { totalUnits: 0, totalVisitors: 0, uniqueVisitors: 0 },
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
            booth: { totalUnits: totalBooths, totalVisitors: 0, uniqueVisitors: 0 },
            workshop: { totalUnits: totalWorkshops, totalVisitors: 0, uniqueVisitors: 0 },
            totnghiep: { totalUnits: totalTotnghieps, totalVisitors: 0, uniqueVisitors: 0 },
        };

        for (const row of groupedByType) {
            const key = this.getBoothTypeStatsKey(row.type);
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
                totalBooths,
                totalWorkshops,
                totalTotnghieps,
                byType: byTypeStats,
            },
            booths: booths.map((b) => ({
                id: b.id,
                name: b.name,
                displayName: this.getBoothDisplayName(b),
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
                    department: c.student?.department ?? null,
                    phone: c.student?.phone ?? null,
                },
                checkInTime: c.checkInTime,
                booth: c.booth ? this.getBoothDisplayName(c.booth) : null,
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

        const daily = await this.checkinRepo
            .createQueryBuilder('c')
            .select("DATE(c.checkInTime)", 'date')
            .addSelect('COUNT(*)', 'count')
            .addSelect('COUNT(DISTINCT c.studentId)', 'uniqueStudents')
            .where('c.boothId = :id', { id: boothId })
            .groupBy("DATE(c.checkInTime)")
            .orderBy('date')
            .getRawMany<{ date: string; count: string; uniqueStudents: string }>();

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
            booth: {
                id: booth.id,
                name: booth.name,
                displayName: this.getBoothDisplayName(booth),
                location: booth.location,
                type: booth.type,
            },
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
        return this.getAttendanceReport(user, requestedBoothId, this.getAttendanceConfig(BoothType.WORKSHOP));
    }

    async getTotnghiepAttendanceReport(
        user: AuthenticatedBusinessAdminUser,
        requestedBoothId?: string,
    ) {
        return this.getAttendanceReport(user, requestedBoothId, this.getAttendanceConfig(BoothType.TOTNGHIEP));
    }

    async getWorkshopAttendanceExportData(
        user: AuthenticatedBusinessAdminUser,
        requestedBoothId?: string,
    ) {
        return this.getAttendanceExportData(user, requestedBoothId, this.getAttendanceConfig(BoothType.WORKSHOP));
    }

    async getTotnghiepAttendanceExportData(
        user: AuthenticatedBusinessAdminUser,
        requestedBoothId?: string,
    ) {
        return this.getAttendanceExportData(user, requestedBoothId, this.getAttendanceConfig(BoothType.TOTNGHIEP));
    }

    async createWorkshopAttendanceManual(
        user: AuthenticatedBusinessAdminUser,
        dto: CreateWorkshopAttendanceDto,
        requestedBoothId?: string,
    ) {
        return this.createAttendanceManual(user, dto, requestedBoothId, this.getAttendanceConfig(BoothType.WORKSHOP));
    }

    async createTotnghiepAttendanceManual(
        user: AuthenticatedBusinessAdminUser,
        dto: CreateWorkshopAttendanceDto,
        requestedBoothId?: string,
    ) {
        return this.createAttendanceManual(user, dto, requestedBoothId, this.getAttendanceConfig(BoothType.TOTNGHIEP));
    }

    async deleteWorkshopAttendance(
        user: AuthenticatedBusinessAdminUser,
        studentCode: string,
        requestedBoothId?: string,
    ) {
        return this.deleteAttendance(user, studentCode, requestedBoothId, this.getAttendanceConfig(BoothType.WORKSHOP));
    }

    async deleteTotnghiepAttendance(
        user: AuthenticatedBusinessAdminUser,
        studentCode: string,
        requestedBoothId?: string,
    ) {
        return this.deleteAttendance(user, studentCode, requestedBoothId, this.getAttendanceConfig(BoothType.TOTNGHIEP));
    }

    async exportWorkshopAttendanceCsv(
        user: AuthenticatedBusinessAdminUser,
        requestedBoothId?: string,
    ) {
        return this.exportAttendanceCsv(user, requestedBoothId, this.getAttendanceConfig(BoothType.WORKSHOP));
    }

    async exportTotnghiepAttendanceCsv(
        user: AuthenticatedBusinessAdminUser,
        requestedBoothId?: string,
    ) {
        return this.exportAttendanceCsv(user, requestedBoothId, this.getAttendanceConfig(BoothType.TOTNGHIEP));
    }

    async exportWorkshopAttendanceExcel(
        user: AuthenticatedBusinessAdminUser,
        requestedBoothId?: string,
    ) {
        return this.exportAttendanceExcel(user, requestedBoothId, this.getAttendanceConfig(BoothType.WORKSHOP));
    }

    async exportTotnghiepAttendanceExcel(
        user: AuthenticatedBusinessAdminUser,
        requestedBoothId?: string,
    ) {
        return this.exportAttendanceExcel(user, requestedBoothId, this.getAttendanceConfig(BoothType.TOTNGHIEP));
    }

    private async getAttendanceReport(
        user: AuthenticatedBusinessAdminUser,
        requestedBoothId: string | undefined,
        config: AttendanceConfig,
    ) {
        const booth = await this.resolveManagedBooth(user, requestedBoothId, config);
        const rows = await this.getAttendanceRows(booth.id);

        return {
            [config.entityKey]: {
                id: booth.id,
                name: booth.name,
                displayName: this.getBoothDisplayName(booth),
                location: booth.location,
                business: booth.business?.name ?? booth.name,
                type: booth.type,
            },
            total: rows.length,
            items: this.mapAttendanceRows(rows, config.nameField),
        };
    }

    private async getAttendanceExportData(
        user: AuthenticatedBusinessAdminUser,
        requestedBoothId: string | undefined,
        config: AttendanceConfig,
    ) {
        const booth = await this.resolveManagedBooth(user, requestedBoothId, config);
        const rows = await this.getAttendanceRows(booth.id);

        return {
            fileName: this.buildAttendanceExcelFileName(booth.name, config.filePrefix),
            sheetName: config.sheetName,
            [config.entityKey]: {
                id: booth.id,
                name: booth.name,
                displayName: this.getBoothDisplayName(booth),
                location: booth.location,
                type: booth.type,
            },
            columns: [
                { key: 'stt', title: 'STT' },
                { key: config.nameField, title: config.nameColumnTitle },
                { key: 'fullName', title: 'Họ và tên' },
                { key: 'studentCode', title: 'MSSV' },
                { key: 'className', title: 'Lớp' },
                { key: 'department', title: 'Khoa' },
                { key: 'phone', title: 'SĐT' },
                { key: 'checkInTime', title: 'Thời gian điểm danh' },
            ],
            rows: this.mapAttendanceRows(rows, config.nameField),
            total: rows.length,
        };
    }

    private async createAttendanceManual(
        user: AuthenticatedBusinessAdminUser,
        dto: CreateWorkshopAttendanceDto,
        requestedBoothId: string | undefined,
        config: AttendanceConfig,
    ) {
        const booth = await this.resolveManagedBooth(user, requestedBoothId, config);
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
                `Sinh viên ${student.studentCode} đã có trong danh sách điểm danh của ${config.entityLabelLower} này`,
            );
        }

        const checkin = await this.checkinRepo.save(
            this.checkinRepo.create({
                studentId: student.id,
                boothId: booth.id,
                status: 'active',
                notes: 'Điểm danh thủ công',
                graduationBatch: student.graduationBatch,
            }),
        );

        if (dto.checkInTime) {
            await this.checkinRepo.update(checkin.id, {
                checkInTime: new Date(dto.checkInTime),
            });
        }

        const refreshedRows = await this.getAttendanceRows(booth.id);
        const createdRow = refreshedRows.find(
            (row) => row.studentCode === student.studentCode,
        );

        return {
            message: `Đã thêm sinh viên vào danh sách điểm danh ${config.entityLabelLower}`,
            [config.entityKey]: {
                id: booth.id,
                name: booth.name,
                displayName: this.getBoothDisplayName(booth),
                type: booth.type,
            },
            item: createdRow ? this.mapAttendanceRow(createdRow, config.nameField) : null,
        };
    }

    private async deleteAttendance(
        user: AuthenticatedBusinessAdminUser,
        studentCode: string,
        requestedBoothId: string | undefined,
        config: AttendanceConfig,
    ) {
        const booth = await this.resolveManagedBooth(user, requestedBoothId, config);
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
                `Sinh viên ${normalizedStudentCode} không có trong danh sách điểm danh của ${config.entityLabelLower} này`,
            );
        }

        await this.checkinRepo.remove(checkins);

        return {
            message: `Đã xoá sinh viên khỏi danh sách điểm danh ${config.entityLabelLower}`,
            deletedStudentCode: normalizedStudentCode,
            deletedCheckins: checkins.length,
            [config.entityKey]: {
                id: booth.id,
                name: booth.name,
                displayName: this.getBoothDisplayName(booth),
                type: booth.type,
            },
        };
    }

    private async exportAttendanceCsv(
        user: AuthenticatedBusinessAdminUser,
        requestedBoothId: string | undefined,
        config: AttendanceConfig,
    ) {
        const booth = await this.resolveManagedBooth(user, requestedBoothId, config);
        const rows = await this.getAttendanceRows(booth.id);
        const headers = ['STT', config.nameColumnTitle, 'Họ và tên', 'MSSV', 'Lớp', 'Khoa', 'SĐT', 'Thời gian điểm danh'];
        const csvRows = rows.map((row) => [
            row.stt.toString(),
            row.unitName,
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
            fileName: this.buildAttendanceFileName(booth.name, config.filePrefix),
            total: rows.length,
            csv,
        };
    }

    private async exportAttendanceExcel(
        user: AuthenticatedBusinessAdminUser,
        requestedBoothId: string | undefined,
        config: AttendanceConfig,
    ) {
        const booth = await this.resolveManagedBooth(user, requestedBoothId, config);
        const rows = await this.getAttendanceRows(booth.id);
        const headers = ['STT', config.nameColumnTitle, 'Họ và tên', 'MSSV', 'Lớp', 'Khoa', 'SĐT', 'Thời gian điểm danh'];
        const bodyRows = rows.map((row) => [
            row.stt.toString(),
            row.unitName,
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
            `<Worksheet ss:Name="${config.sheetName}">` +
            '<Table>' +
            xmlRows +
            '</Table>' +
            '</Worksheet>' +
            '</Workbook>';

        return {
            fileName: this.buildAttendanceExcelFileName(booth.name, config.filePrefix),
            total: rows.length,
            xml,
        };
    }

    private async resolveManagedBooth(
        user: AuthenticatedBusinessAdminUser,
        requestedBoothId: string | undefined,
        config: AttendanceConfig,
    ) {
        const boothId =
            user.role === UserRole.SYSTEM_ADMIN || user.role === UserRole.SCHOOL_ADMIN
                ? requestedBoothId
                : user.boothId;

        if (!boothId) {
            throw new ForbiddenException(
                `Tài khoản này chưa được gán ${config.entityLabelLower} để xem báo cáo`,
            );
        }

        const booth = await this.boothRepo.findOne({
            where: { id: boothId },
            relations: ['business'],
        });
        if (!booth) throw new NotFoundException(`${config.entityLabel} không tồn tại`);
        if (booth.type !== config.boothType) {
            throw new ForbiddenException(
                `Tài khoản này không thuộc ${config.entityLabelLower} nên không thể xuất báo cáo ${config.entityLabelLower}`,
            );
        }

        return booth;
    }

    private async getAttendanceRows(
        boothId: string,
    ): Promise<AttendanceRow[]> {
        const booth = await this.boothRepo.findOne({
            where: { id: boothId },
            relations: ['business'],
        });
        if (!booth) throw new NotFoundException('Không tìm thấy đơn vị điểm danh');

        const checkins = await this.checkinRepo.find({
            where: { boothId },
            relations: ['student'],
            order: { checkInTime: 'ASC' },
        });

        const seenStudentIds = new Set<string>();
        const rows: AttendanceRow[] = [];

        for (const checkin of checkins) {
            if (!checkin.student || seenStudentIds.has(checkin.studentId)) continue;
            seenStudentIds.add(checkin.studentId);

            rows.push({
                stt: rows.length + 1,
                studentId: checkin.student.id,
                unitName: booth.business?.name ?? booth.name,
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

    private mapAttendanceRows(rows: AttendanceRow[], nameField: AttendanceConfig['nameField']) {
        return rows.map((row) => this.mapAttendanceRow(row, nameField));
    }

    private mapAttendanceRow(row: AttendanceRow, nameField: AttendanceConfig['nameField']) {
        return {
            stt: row.stt,
            studentId: row.studentId,
            [nameField]: row.unitName,
            fullName: row.fullName,
            studentCode: row.studentCode,
            className: row.className,
            department: row.department,
            phone: row.phone,
            checkInTime: row.checkInTime,
        };
    }

    private getAttendanceConfig(boothType: BoothType): AttendanceConfig {
        if (boothType === BoothType.TOTNGHIEP) {
            return {
                boothType,
                entityKey: 'totnghiep',
                entityLabel: 'Totnghiep',
                entityLabelLower: 'Totnghiep',
                listTitle: 'Điểm danh Totnghiep',
                sheetName: 'Điểm danh Totnghiep',
                filePrefix: 'totnghiep-attendance',
                nameField: 'totnghiepName',
                nameColumnTitle: 'Tên Totnghiep',
            };
        }

        return {
            boothType: BoothType.WORKSHOP,
            entityKey: 'workshop',
            entityLabel: 'Workshop',
            entityLabelLower: 'hội thảo',
            listTitle: 'Điểm danh hội thảo',
            sheetName: 'Điểm danh hội thảo',
            filePrefix: 'workshop-attendance',
            nameField: 'workshopName',
            nameColumnTitle: 'Tên hội thảo',
        };
    }

    private getBoothTypeStatsKey(type: BoothType) {
        switch (type) {
            case BoothType.WORKSHOP:
                return 'workshop' as const;
            case BoothType.TOTNGHIEP:
                return 'totnghiep' as const;
            default:
                return 'booth' as const;
        }
    }

    private getBoothDisplayName(booth: Pick<Booth, 'name' | 'type'> & { business?: { name: string } | null }) {
        if (booth.type === BoothType.BOOTH) {
            return booth.name;
        }

        return booth.business?.name ?? booth.name;
    }

    private escapeCsvValue(value: string) {
        const normalized = value.replace(/"/g, '""');
        return `"${normalized}"`;
    }

    private buildAttendanceFileName(entityName: string, prefix: string) {
        const slug = this.slugify(entityName);
        return `${prefix}-${slug || 'report'}.csv`;
    }

    private buildAttendanceExcelFileName(entityName: string, prefix: string) {
        const slug = this.slugify(entityName);
        return `${prefix}-${slug || 'report'}.xls`;
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
