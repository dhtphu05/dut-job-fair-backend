import * as bcrypt from 'bcryptjs';
import { NestFactory } from '@nestjs/core';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AppModule } from './app.module';
import { Booth } from './entities/booth.entity';
import { Business } from './entities/business.entity';
import { Checkin } from './entities/checkin.entity';
import { RewardClaim } from './entities/reward-claim.entity';
import { RewardMilestone } from './entities/reward-milestone.entity';
import { School } from './entities/school.entity';
import { Student } from './entities/student.entity';
import { User, UserRole } from './entities/user.entity';
import {
  DEMO_EVENT_DATE,
  DEMO_EVENT_END,
  DEMO_EVENT_START,
  SEED_COMPANIES,
} from './seed-data/companies';

const FORCED_STUDENT_CODE = '102280313';

function randInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function pickN<T>(arr: T[], n: number): T[] {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(n, arr.length));
}

function randomCheckinTime(): Date {
  const durationMs = DEMO_EVENT_END.getTime() - DEMO_EVENT_START.getTime();
  return new Date(DEMO_EVENT_START.getTime() + Math.random() * durationMs);
}

function buildBoothCode(index: number): string {
  return `B${String(index + 1).padStart(2, '0')}`;
}

const DEPT_META: Record<string, { majors: string[]; classes: string[]; count: number }> = {
  'Cơ Khí': {
    majors: ['Cơ khí chế tạo máy', 'Cơ điện tử', 'Kỹ thuật cơ khí'],
    classes: ['22CK1', '22CK2', '23CK1', '23CK2'],
    count: 25,
  },
  Hóa: {
    majors: ['Kỹ thuật hóa học', 'Công nghệ hóa học', 'Kỹ thuật môi trường'],
    classes: ['22H1', '22H2', '23H1'],
    count: 7,
  },
  'Xây dựng cầu đường': {
    majors: ['Kỹ thuật xây dựng công trình giao thông', 'Kỹ thuật cầu đường'],
    classes: ['22CD1', '22CD2', '23CD1'],
    count: 15,
  },
  'Công nghệ Thông tin': {
    majors: ['Kỹ thuật phần mềm', 'Khoa học máy tính', 'Mạng máy tính', 'Hệ thống thông tin'],
    classes: ['22TH1', '22TH2', '22TH3', '23TH1', '23TH2'],
    count: 40,
  },
  'Công nghệ tiên tiến': {
    majors: ['Kỹ thuật tiên tiến', 'Công nghệ tiên tiến'],
    classes: ['22AT1', '23AT1'],
    count: 12,
  },
  'Điện tử viễn thông': {
    majors: ['Kỹ thuật điện tử', 'Kỹ thuật viễn thông', 'Điện tử số'],
    classes: ['22DT1', '22DT2', '23DT1', '23DT2', '23DT3', '22VT1'],
    count: 35,
  },
  Điện: {
    majors: ['Kỹ thuật điện', 'Hệ thống điện', 'Tự động hóa'],
    classes: ['22D1', '22D2', '23D1', '23D2'],
    count: 30,
  },
  'Quản lý dự án': {
    majors: ['Quản lý dự án', 'Quản lý kỹ thuật xây dựng'],
    classes: ['22QLD1', '23QLD1'],
    count: 10,
  },
  'Xây dựng công trình thủy': {
    majors: ['Kỹ thuật công trình thủy', 'Thủy lợi'],
    classes: ['22CTT1', '23CTT1'],
    count: 8,
  },
  'Cơ khí Giao Thông': {
    majors: ['Kỹ thuật ô tô', 'Cơ khí giao thông vận tải', 'Động lực học phương tiện'],
    classes: ['22CKGT1', '22CKGT2', '23CKGT1'],
    count: 20,
  },
};

const FIRST_NAMES = [
  'Nguyễn', 'Trần', 'Lê', 'Phạm', 'Hoàng', 'Huỳnh', 'Phan', 'Vũ',
  'Võ', 'Đặng', 'Bùi', 'Đỗ', 'Hồ', 'Ngô', 'Dương', 'Lý',
];
const MIDDLE_NAMES = ['Văn', 'Thị', 'Đức', 'Minh', 'Quốc', 'Hữu', 'Anh', 'Thanh', 'Bảo', 'Gia'];
const LAST_NAMES = [
  'An', 'Bình', 'Cường', 'Dũng', 'Hải', 'Hoa', 'Hùng', 'Khoa', 'Lan',
  'Linh', 'Long', 'Minh', 'Nam', 'Nhung', 'Phong', 'Phúc', 'Quân', 'Quỳnh',
  'Sơn', 'Thành', 'Thảo', 'Thắng', 'Thu', 'Tiến', 'Trang', 'Trung', 'Tú',
  'Tuấn', 'Tùng', 'Uyên', 'Vân', 'Việt', 'Xuân', 'Yến', 'Đạt', 'Đông',
];

function randomName(): string {
  return `${pick(FIRST_NAMES)} ${pick(MIDDLE_NAMES)} ${pick(LAST_NAMES)}`;
}

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);

  try {
    const userRepo = app.get<Repository<User>>(getRepositoryToken(User));
    const businessRepo = app.get<Repository<Business>>(getRepositoryToken(Business));
    const boothRepo = app.get<Repository<Booth>>(getRepositoryToken(Booth));
    const studentRepo = app.get<Repository<Student>>(getRepositoryToken(Student));
    const checkinRepo = app.get<Repository<Checkin>>(getRepositoryToken(Checkin));
    const schoolRepo = app.get<Repository<School>>(getRepositoryToken(School));
    const rewardClaimRepo = app.get<Repository<RewardClaim>>(getRepositoryToken(RewardClaim));
    const rewardMilestoneRepo = app.get<Repository<RewardMilestone>>(getRepositoryToken(RewardMilestone));

    const defaultPassword = 'password123';
    const passwordHash = await bcrypt.hash(defaultPassword, 10);

    const baseUsers = [
      { email: 'school@example.com', role: UserRole.SCHOOL_ADMIN, name: 'School Admin' },
      { email: 'system@example.com', role: UserRole.SYSTEM_ADMIN, name: 'System Admin' },
      { email: 'scanner@example.com', role: UserRole.BOOTH_STAFF, name: 'Scanner User' },
    ];

    console.log('\n[1] Seeding base users...');
    for (const baseUser of baseUsers) {
      const exists = await userRepo.findOne({ where: { email: baseUser.email } });
      if (!exists) {
        await userRepo.save(userRepo.create({ ...baseUser, passwordHash }));
        console.log(`  + ${baseUser.email}`);
      } else {
        await userRepo.update(exists.id, {
          name: baseUser.name,
          role: baseUser.role,
          passwordHash,
          isActive: true,
        });
        console.log(`  = reset ${baseUser.email}`);
      }
    }

    console.log('\n[2] Seeding school...');
    let school = await schoolRepo.findOne({ where: { code: 'DUT' } });
    if (!school) {
      school = await schoolRepo.save(
        schoolRepo.create({
          name: 'Trường Đại học Bách khoa – Đại học Đà Nẵng',
          code: 'DUT',
          address: '54 Nguyễn Lương Bằng, Liên Chiểu, Đà Nẵng',
          studentCount: 0,
        }),
      );
      console.log(`  + Created school: ${school.name}`);
    } else {
      await schoolRepo.update(school.id, {
        name: 'Trường Đại học Bách khoa – Đại học Đà Nẵng',
        address: '54 Nguyễn Lương Bằng, Liên Chiểu, Đà Nẵng',
      });
      console.log(`  = Updated school: ${school.name}`);
    }

    console.log('\n[3] Seeding businesses, booths, and business admins...');
    const boothIds: string[] = [];

    for (const [index, company] of SEED_COMPANIES.entries()) {
      const boothCode = buildBoothCode(index);

      let business = await businessRepo.findOne({ where: { name: company.name } });
      if (!business) {
        business = await businessRepo.save(
          businessRepo.create({
            name: company.name,
            publicId: company.publicId,
            logoUrl: company.logoUrl,
            description: `Gian hàng tuyển dụng tại DUT Job Fair ${DEMO_EVENT_DATE}.`,
          }),
        );
        console.log(`  + Business: ${company.name}`);
      } else {
        await businessRepo.update(business.id, {
          name: company.name,
          publicId: company.publicId,
          logoUrl: company.logoUrl,
          description: `Gian hàng tuyển dụng tại DUT Job Fair ${DEMO_EVENT_DATE}.`,
        });
        console.log(`  = Business updated: ${company.name}`);
      }

      let booth = await boothRepo.findOne({ where: { businessId: business.id } });
      if (!booth) {
        booth = await boothRepo.save(
          boothRepo.create({
            name: `Gian hàng ${company.name}`,
            location: `Khu doanh nghiệp - ${boothCode}`,
            capacity: 50,
            businessId: business.id,
            qrCode: `BOOTH-${boothCode}`,
          }),
        );
        console.log(`    + Booth: ${booth.name}`);
      } else {
        await boothRepo.update(booth.id, {
          name: `Gian hàng ${company.name}`,
          location: `Khu doanh nghiệp - ${boothCode}`,
          capacity: 50,
          qrCode: `BOOTH-${boothCode}`,
        });
        booth = await boothRepo.findOneOrFail({ where: { id: booth.id } });
        console.log(`    = Booth updated: ${booth.name}`);
      }
      boothIds.push(booth.id);

      const adminByEmail = await userRepo.findOne({ where: { email: company.email } });
      const adminByBooth = await userRepo.findOne({ where: { boothId: booth.id } });
      const admin = adminByBooth ?? adminByEmail;

      if (!admin) {
        await userRepo.save(
          userRepo.create({
            email: company.email,
            name: company.name,
            role: UserRole.BUSINESS_ADMIN,
            passwordHash,
            boothId: booth.id,
            isActive: true,
          }),
        );
        console.log(`    + Admin: ${company.email}`);
      } else {
        await userRepo.update(admin.id, {
          email: company.email,
          name: company.name,
          role: UserRole.BUSINESS_ADMIN,
          passwordHash,
          boothId: booth.id,
          isActive: true,
        });
        console.log(`    = Admin reset: ${company.email}`);
      }
    }

    console.log('\n[4] Seeding reward milestones...');
    await rewardClaimRepo.createQueryBuilder().delete().execute();
    await rewardMilestoneRepo.createQueryBuilder().delete().execute();
    await rewardMilestoneRepo.save([
      rewardMilestoneRepo.create({
        name: 'Mốc 3 booth',
        description: 'Quà cho sinh viên check-in đủ 3 booth trong ngày demo.',
        requiredBooths: 3,
        sortOrder: 1,
        isActive: true,
      }),
      rewardMilestoneRepo.create({
        name: 'Mốc 5 booth',
        description: 'Quà cho sinh viên check-in đủ 5 booth trong ngày demo.',
        requiredBooths: 5,
        sortOrder: 2,
        isActive: true,
      }),
      rewardMilestoneRepo.create({
        name: 'Mốc 7 booth',
        description: 'Quà cho sinh viên check-in đủ 7 booth trong ngày demo.',
        requiredBooths: 7,
        sortOrder: 3,
        isActive: true,
      }),
    ]);
    console.log('  + Reward milestones reset for demo');

    console.log('\n[5] Seeding students...');
    const studentIds: string[] = [];
    let studentSeq = 1;

    for (const [department, meta] of Object.entries(DEPT_META)) {
      for (let i = 0; i < meta.count; i++) {
        const year = randInt(2, 4);
        const studentCode = `DUT${String(studentSeq).padStart(6, '0')}`;
        const fullName = randomName();
        const className = pick(meta.classes);
        const major = pick(meta.majors);
        const emailSlug = fullName
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/đ/gi, 'd')
          .replace(/[^a-z0-9]/gi, '')
          .toLowerCase()
          .slice(0, 12);
        const email = `${emailSlug}${studentSeq}@sv.dut.edu.vn`;

        const existing = await studentRepo.findOne({ where: { studentCode } });
        if (!existing) {
          const student = await studentRepo.save(
            studentRepo.create({
              studentCode,
              fullName,
              email,
              major,
              department,
              className,
              year,
              gpa: parseFloat((randInt(250, 400) / 100).toFixed(2)),
              schoolId: school.id,
            }),
          );
          studentIds.push(student.id);
        } else {
          studentIds.push(existing.id);
        }

        studentSeq++;
      }
    }
    console.log(`  + Students seeded/verified: ${studentIds.length}`);

    let forcedStudent = await studentRepo.findOne({
      where: { studentCode: FORCED_STUDENT_CODE },
    });
    if (!forcedStudent) {
      forcedStudent = await studentRepo.save(
        studentRepo.create({
          studentCode: FORCED_STUDENT_CODE,
          fullName: 'Sinh vien Demo 102280313',
          email: '102280313@sv.dut.edu.vn',
          phone: '0900000313',
          major: 'Kỹ thuật phần mềm',
          department: 'Công nghệ Thông tin',
          className: '22TH1',
          year: 4,
          gpa: 3.4,
          schoolId: school.id,
        }),
      );
      studentIds.push(forcedStudent.id);
      console.log(`  + Forced student created: ${FORCED_STUDENT_CODE}`);
    } else {
      await studentRepo.update(forcedStudent.id, {
        fullName: 'Sinh vien Demo 102280313',
        email: '102280313@sv.dut.edu.vn',
        phone: '0900000313',
        major: 'Kỹ thuật phần mềm',
        department: 'Công nghệ Thông tin',
        className: '22TH1',
        year: 4,
        gpa: 3.4,
        schoolId: school.id,
      });
      if (!studentIds.includes(forcedStudent.id)) {
        studentIds.push(forcedStudent.id);
      }
      console.log(`  = Forced student updated: ${FORCED_STUDENT_CODE}`);
    }

    console.log('\n[6] Resetting and seeding check-ins...');
    await checkinRepo.createQueryBuilder().delete().execute();

    let checkinCount = 0;
    for (const studentId of studentIds) {
      const numBooths = randInt(2, 8);
      const selectedBooths = pickN(boothIds, numBooths);

      for (const boothId of selectedBooths) {
        const duration = randInt(8, 45);
        const checkInTime = randomCheckinTime();
        const checkin = await checkinRepo.save(
          checkinRepo.create({
            studentId,
            boothId,
            status: Math.random() < 0.88 ? 'completed' : 'active',
            durationMinutes: duration,
          }),
        );

        await checkinRepo.query(
          'UPDATE checkins SET check_in_time = $1 WHERE id = $2',
          [checkInTime, checkin.id],
        );
        checkinCount++;
      }
    }

    const forcedStudentBooths = boothIds.slice(0, 7);
    await checkinRepo
      .createQueryBuilder()
      .delete()
      .where('student_id = :studentId', { studentId: forcedStudent.id })
      .execute();

    for (const boothId of forcedStudentBooths) {
      const checkin = await checkinRepo.save(
        checkinRepo.create({
          studentId: forcedStudent.id,
          boothId,
          status: 'completed',
          durationMinutes: 20,
        }),
      );
      await checkinRepo.query(
        'UPDATE checkins SET check_in_time = $1 WHERE id = $2',
        [randomCheckinTime(), checkin.id],
      );
    }
    console.log(`  + Forced student ${FORCED_STUDENT_CODE} reset to exactly 7 booths`);

    const finalForcedBoothCount = await checkinRepo
      .createQueryBuilder('c')
      .select('COUNT(DISTINCT c.boothId)', 'count')
      .where('c.studentId = :studentId', { studentId: forcedStudent.id })
      .getRawOne<{ count: string }>();
    const totalCheckins = await checkinRepo.count();

    console.log(`  + Check-ins created: ${totalCheckins}`);

    console.log(`\n${'─'.repeat(55)}`);
    console.log(`  All accounts password : ${defaultPassword}`);
    console.log('  Business admins       : email = <slug>@jobfair');
    console.log('  School admin          : school@example.com');
    console.log('  System admin          : system@example.com');
    console.log('  Scanner               : scanner@example.com');
    console.log(`  Businesses seeded     : ${SEED_COMPANIES.length}`);
    console.log(`  Students seeded       : ${studentIds.length}`);
    console.log(`  Checkin records       : ${totalCheckins}`);
    console.log(`  Forced student booths : ${FORCED_STUDENT_CODE} => ${finalForcedBoothCount?.count ?? '0'} booths`);
    console.log(`  Demo event date       : ${DEMO_EVENT_DATE} 08:00–17:00 (+07:00)`);
    console.log(`${'─'.repeat(55)}\n`);
  } finally {
    await app.close();
  }
}

bootstrap().catch((err) => {
  console.error('Seeding failed!', err);
  process.exit(1);
});
