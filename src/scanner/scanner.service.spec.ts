import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { ScannerService } from './scanner.service';
import { Student } from '../entities/student.entity';
import { Checkin } from '../entities/checkin.entity';
import { Booth, BoothType } from '../entities/booth.entity';
import { UserRole } from '../entities/user.entity';

describe('ScannerService attendance', () => {
  const student = {
    id: 'existing-student', studentCode: '102230313', fullName: 'Nguyễn Văn A',
  } as Student;
  const user = { id: 'staff', role: UserRole.BUSINESS_ADMIN, boothId: 'workshop' };
  const qr = {
    ma_so_sinh_vien: ' 102230313 ', ho_ten: 'Nguyễn Văn A', boothId: 'workshop',
  };
  let service: ScannerService;
  let students: { findOne: jest.Mock; upsert: jest.Mock };
  let query: Record<string, jest.Mock>;
  let runner: {
    connect: jest.Mock; startTransaction: jest.Mock; query: jest.Mock;
    commitTransaction: jest.Mock; rollbackTransaction: jest.Mock; release: jest.Mock;
    manager: { createQueryBuilder: jest.Mock; create: jest.Mock; save: jest.Mock };
  };

  beforeEach(() => {
    students = { findOne: jest.fn().mockResolvedValue(student), upsert: jest.fn() };
    query = {};
    for (const method of ['leftJoin', 'select', 'where', 'andWhere', 'orderBy']) {
      query[method] = jest.fn().mockReturnValue(query);
    }
    query.getRawOne = jest.fn().mockResolvedValue({
      id: 'workshop', name: 'Hội thảo', type: BoothType.WORKSHOP,
    });
    query.getOne = jest.fn().mockResolvedValue(null);
    runner = {
      connect: jest.fn(), startTransaction: jest.fn(), query: jest.fn(),
      commitTransaction: jest.fn(), rollbackTransaction: jest.fn(), release: jest.fn(),
      manager: {
        createQueryBuilder: jest.fn().mockReturnValue(query),
        create: jest.fn((_entity, data) => data),
        save: jest.fn().mockResolvedValue({ id: 'checkin' }),
      },
    };
    service = new ScannerService(
      {} as Repository<Checkin>, students as unknown as Repository<Student>,
      { createQueryBuilder: jest.fn().mockReturnValue(query) } as unknown as Repository<Booth>,
      { createQueryRunner: jest.fn().mockReturnValue(runner) } as unknown as DataSource,
    );
  });

  it('reuses the existing student with a trimmed MSSV for JSON QR', async () => {
    const result = await service.scanByQrData(qr, user);
    expect(result.status).toBe('success');
    expect(result.boothType).toBe(BoothType.WORKSHOP);
    expect(students.findOne).toHaveBeenCalledWith({ where: { studentCode: student.studentCode } });
    expect(students.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ studentCode: student.studentCode }), ['studentCode'],
    );
    expect(runner.manager.create).toHaveBeenCalledWith(Checkin,
      expect.objectContaining({ studentId: student.id, boothId: 'workshop' }));
  });

  it('returns duplicate without inserting another attendance record', async () => {
    query.getOne.mockResolvedValue({ id: 'old-attendance' });
    const result = await service.scanByQrData(qr, user);
    expect(result).toMatchObject({ status: 'duplicate', scanId: 'old-attendance' });
    expect(runner.manager.save).not.toHaveBeenCalled();
    expect(runner.commitTransaction).toHaveBeenCalled();
    expect(runner.release).toHaveBeenCalled();
  });

  it('normalizes MSSV-only QR before finding the student', async () => {
    await service.scan({ visitorCode: qr.ma_so_sinh_vien, boothId: 'workshop' }, user);
    expect(students.findOne).toHaveBeenCalledWith({ where: { studentCode: student.studentCode } });
  });

  it('rejects a blank MSSV without updating student data', async () => {
    await expect(service.scanByQrData({ ...qr, ma_so_sinh_vien: '   ' }, user))
      .rejects.toBeInstanceOf(BadRequestException);
    expect(students.upsert).not.toHaveBeenCalled();
  });

  it('rejects a blank name without updating student data', async () => {
    await expect(service.scanByQrData({ ...qr, ho_ten: '   ' }, user))
      .rejects.toBeInstanceOf(BadRequestException);
    expect(students.upsert).not.toHaveBeenCalled();
  });

  it('rejects scanning for a different unit before touching student data', async () => {
    await expect(service.scanByQrData({ ...qr, boothId: 'another-workshop' }, user))
      .rejects.toBeInstanceOf(ForbiddenException);
    expect(students.upsert).not.toHaveBeenCalled();
  });
});
