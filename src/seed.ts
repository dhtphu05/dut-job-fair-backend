import * as bcrypt from 'bcryptjs';
import * as fs from 'fs';
import { NestFactory } from '@nestjs/core';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AppModule } from './app.module';
import { Booth, BoothType } from './entities/booth.entity';
import { Business, BusinessType } from './entities/business.entity';
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
  SEED_WORKSHOPS,
} from './seed-data/companies';

const FORCED_STUDENT_CODE = '102280313';

function randInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomLetters(length: number): string {
  const letters = 'abcdefghijklmnopqrstuvwxyz';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += letters.charAt(Math.floor(Math.random() * letters.length));
  }
  return result;
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
    // Clear all old data for production, but PRESERVE WORKSHOP data!
    console.log('\n[0] Xoá data rác (Bảo vệ dữ liệu Workshop)...');
    await userRepo.manager.query(`
      DELETE FROM checkins;
      DELETE FROM students;
      DELETE FROM reward_claims;
      DELETE FROM reward_milestones;
      DELETE FROM user_sessions;
      DELETE FROM users WHERE role = 'business_admin' AND booth_id IN (SELECT id FROM booths WHERE type = 'booth');
      DELETE FROM booths WHERE type = 'booth';
      DELETE FROM businesses WHERE type = 'booth';
    `);
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
      { email: 'checkin@admin.com', role: UserRole.SCHOOL_ADMIN, name: 'School Admin' },
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
    const credentials: string[] = ['Doanh Nghiệp,Email (Tên đăng nhập),Mật Khẩu'];

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
            name: company.name,
            location: `Khu doanh nghiệp - ${boothCode}`,
            capacity: 50,
            businessId: business.id,
            qrCode: `BOOTH-${boothCode}`,
          }),
        );
        console.log(`    + Booth: ${booth.name}`);
      } else {
        await boothRepo.update(booth.id, {
          name: company.name,
          location: `Khu doanh nghiệp - ${boothCode}`,
          capacity: 50,
          qrCode: `BOOTH-${boothCode}`,
        });
        booth = await boothRepo.findOneOrFail({ where: { id: booth.id } });
        console.log(`    = Booth updated: ${booth.name}`);
      }
      boothIds.push(booth.id);

      const companyPassword = `jobfair${DEMO_EVENT_DATE.substring(0,4)}_${randomLetters(2)}`;
      const businessPasswordHash = await bcrypt.hash(companyPassword, 10);
      credentials.push(`"${company.name}",${company.email},${companyPassword}`);

      const adminByEmail = await userRepo.findOne({ where: { email: company.email } });
      const adminByBooth = await userRepo.findOne({ where: { boothId: booth.id } });
      const admin = adminByBooth ?? adminByEmail;

      if (!admin) {
        await userRepo.save(
          userRepo.create({
            email: company.email,
            name: company.name,
            role: UserRole.BUSINESS_ADMIN,
            passwordHash: businessPasswordHash,
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
          passwordHash: businessPasswordHash,
          boothId: booth.id,
          isActive: true,
        });
        console.log(`    = Admin reset: ${company.email}`);
      }
    }

    console.log('\n[3.1] Seeding workshops and workshop admins...');
    for (const workshop of SEED_WORKSHOPS) {
      let business = await businessRepo.findOne({ where: { name: workshop.name } });
      if (!business) {
        business = await businessRepo.save(
          businessRepo.create({
            name: workshop.name,
            publicId: workshop.publicId,
            logoUrl: workshop.logoUrl || null,
            description: `Hội thảo chuyên đề tại DUT Job Fair ${DEMO_EVENT_DATE}.`,
            type: BusinessType.WORKSHOP,
          }),
        );
        console.log(`  + Workshop business: ${workshop.name}`);
      } else {
        await businessRepo.update(business.id, {
          name: workshop.name,
          publicId: workshop.publicId,
          logoUrl: workshop.logoUrl || null,
          description: `Hội thảo chuyên đề tại DUT Job Fair ${DEMO_EVENT_DATE}.`,
          type: BusinessType.WORKSHOP,
        });
        console.log(`  = Workshop business updated: ${workshop.name}`);
      }

      let booth = await boothRepo.findOne({ where: { businessId: business.id } });
      if (!booth) {
        booth = await boothRepo.save(
          boothRepo.create({
            name: workshop.boothName,
            location: workshop.location,
            capacity: workshop.capacity,
            businessId: business.id,
            qrCode: workshop.qrCode,
            type: BoothType.WORKSHOP,
          }),
        );
        console.log(`    + Workshop booth: ${booth.name}`);
      } else {
        await boothRepo.update(booth.id, {
          name: workshop.boothName,
          location: workshop.location,
          capacity: workshop.capacity,
          qrCode: workshop.qrCode,
          type: BoothType.WORKSHOP,
        });
        booth = await boothRepo.findOneOrFail({ where: { id: booth.id } });
        console.log(`    = Workshop booth updated: ${booth.name}`);
      }
      boothIds.push(booth.id);

      const adminByEmail = await userRepo.findOne({ where: { email: workshop.email } });
      const adminByBooth = await userRepo.findOne({ where: { boothId: booth.id } });
      const admin = adminByBooth ?? adminByEmail;

      if (!admin) {
        await userRepo.save(
          userRepo.create({
            email: workshop.email,
            name: workshop.name,
            role: UserRole.BUSINESS_ADMIN,
            passwordHash,
            boothId: booth.id,
            isActive: true,
          }),
        );
        console.log(`    + Workshop admin: ${workshop.email}`);
      } else {
        await userRepo.update(admin.id, {
          email: workshop.email,
          name: workshop.name,
          role: UserRole.BUSINESS_ADMIN,
          passwordHash,
          boothId: booth.id,
          isActive: true,
        });
        console.log(`    = Workshop admin reset: ${workshop.email}`);
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

    console.log('\n[5] Bỏ qua seed sinh viên (Production Mode)');
    console.log('\n[6] Bỏ qua seed checkin ảo (Production Mode)');

    console.log(`\n${'─'.repeat(55)}`);
    console.log(`  All accounts password : ${defaultPassword}`);
    console.log('  Business admins       : Tự động sinh password vào file .csv');
    console.log('  School admin          : checkin@admin.com');
    console.log('  System admin          : system@example.com');
    console.log('  Scanner               : scanner@example.com');
    console.log(`  Businesses seeded     : ${SEED_COMPANIES.length}`);
    console.log(`  Workshops seeded      : ${SEED_WORKSHOPS.length}`);
    
    fs.writeFileSync('business_credentials.csv', '\uFEFF' + credentials.join('\n'), 'utf8');
    console.log('\n  📁 Đã xuất danh sách mật khẩu ra file: business_credentials.csv');

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
