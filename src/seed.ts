import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User, UserRole } from './entities/user.entity';
import { Business } from './entities/business.entity';
import { Booth } from './entities/booth.entity';
import { Student } from './entities/student.entity';
import { Checkin } from './entities/checkin.entity';
import { School } from './entities/school.entity';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';

// ── Helpers ──────────────────────────────────────────────────────────────────
/** Random integer in [min, max] */
function randInt(min: number, max: number) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

/** Pick a random element from an array */
function pick<T>(arr: T[]): T {
    return arr[Math.floor(Math.random() * arr.length)];
}

/** Pick `n` unique random elements */
function pickN<T>(arr: T[], n: number): T[] {
    const shuffled = [...arr].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, Math.min(n, arr.length));
}

/**
 * Random timestamp in one of the two event windows:
 *   Day 1 – 04/03/2026 08:00–17:00
 *   Day 2 – 05/03/2026 08:00–13:00
 * weight: 0 = day-1 only, 1 = day-2 only, else random across both days
 */
function randomCheckinTime(dayBias?: 1 | 2): Date {
    const windows = [
        { start: new Date('2026-03-04T08:00:00+07:00'), durationMs: 9 * 60 * 60 * 1000 },  // 9 h
        { start: new Date('2026-03-05T08:00:00+07:00'), durationMs: 5 * 60 * 60 * 1000 },  // 5 h
    ];
    const w = dayBias ? windows[dayBias - 1] : windows[Math.random() < 0.64 ? 0 : 1]; // 64 % day-1
    return new Date(w.start.getTime() + Math.random() * w.durationMs);
}

// ── Master data ───────────────────────────────────────────────────────────────
const DEPARTMENTS = [
    'Cơ Khí',
    'Hóa',
    'Xây dựng cầu đường',
    'Công nghệ Thông tin',
    'Công nghệ tiên tiến',
    'Điện tử viễn thông',
    'Điện',
    'Quản lý dự án',
    'Xây dựng công trình thủy',
    'Cơ khí Giao Thông',
];

const DEPT_META: Record<string, { majors: string[]; classes: string[] }> = {
    'Cơ Khí': {
        majors: ['Cơ khí chế tạo máy', 'Cơ điện tử', 'Kỹ thuật cơ khí'],
        classes: ['22CK1', '22CK2', '23CK1', '23CK2'],
    },
    'Hóa': {
        majors: ['Kỹ thuật hóa học', 'Công nghệ hóa học', 'Kỹ thuật môi trường'],
        classes: ['22H1', '22H2', '23H1'],
    },
    'Xây dựng cầu đường': {
        majors: ['Kỹ thuật xây dựng công trình giao thông', 'Kỹ thuật cầu đường'],
        classes: ['22CD1', '22CD2', '23CD1'],
    },
    'Công nghệ Thông tin': {
        majors: ['Kỹ thuật phần mềm', 'Khoa học máy tính', 'Mạng máy tính', 'Hệ thống thông tin'],
        classes: ['22TH1', '22TH2', '22TH3', '23TH1', '23TH2'],
    },
    'Công nghệ tiên tiến': {
        majors: ['Kỹ thuật tiên tiến', 'Công nghệ tiên tiến'],
        classes: ['22AT1', '23AT1'],
    },
    'Điện tử viễn thông': {
        majors: ['Kỹ thuật điện tử', 'Kỹ thuật viễn thông', 'Điện tử số'],
        classes: ['22DT1', '22DT2', '23DT1', '23DT2', '23DT3', '22VT1'],
    },
    'Điện': {
        majors: ['Kỹ thuật điện', 'Hệ thống điện', 'Tự động hóa'],
        classes: ['22D1', '22D2', '23D1', '23D2'],
    },
    'Quản lý dự án': {
        majors: ['Quản lý dự án', 'Quản lý kỹ thuật xây dựng'],
        classes: ['22QLD1', '23QLD1'],
    },
    'Xây dựng công trình thủy': {
        majors: ['Kỹ thuật công trình thủy', 'Thủy lợi'],
        classes: ['22CTT1', '23CTT1'],
    },
    'Cơ khí Giao Thông': {
        majors: ['Kỹ thuật ô tô', 'Cơ khí giao thông vận tải', 'Động lực học phương tiện'],
        classes: ['22CKGT1', '22CKGT2', '23CKGT1'],
    },
};

const FIRST_NAMES = [
    'Nguyễn', 'Trần', 'Lê', 'Phạm', 'Hoàng', 'Huỳnh', 'Phan', 'Vũ', 'Võ',
    'Đặng', 'Bùi', 'Đỗ', 'Hồ', 'Ngô', 'Dương', 'Lý',
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

// 23 companies requested by user
const COMPANIES = [
    { name: 'CÔNG TY CỔ PHẦN KỸ THUẬT RINOVA', industry: 'Kỹ thuật điện – Tự động hóa', website: 'https://rinova.vn', email: 'rinova@jobfair.vn', location: 'Khu A – Bàn A1' },
    { name: 'CÔNG TY CỔ PHẦN DỊCH VỤ CÔNG NGHIỆP WOLFRAM', industry: 'Dịch vụ công nghiệp', website: 'https://wolfram.com.vn', email: 'wolfram@jobfair.vn', location: 'Khu A – Bàn A2' },
    { name: 'Công ty Cổ phần Giấy Vàng', industry: 'Sản xuất – Công nghiệp giấy', website: 'https://giayvang.com.vn', email: 'giayvang@jobfair.vn', location: 'Khu A – Bàn A3' },
    { name: 'Công ty Cổ phần Thép Hòa Phát Dung Quất', industry: 'Thép – Công nghiệp nặng', website: 'https://hoaphat.com.vn', email: 'hoaphat@jobfair.vn', location: 'Khu A – Bàn A4' },
    { name: 'CÔNG TY CP CHỨNG NHẬN GLOBALCERT', industry: 'Kiểm định – Chứng nhận', website: 'https://globalcert.vn', email: 'globalcert@jobfair.vn', location: 'Khu A – Bàn A5' },
    { name: 'Công ty TNHH Key Tronic Viet Nam', industry: 'Sản xuất điện tử', website: 'https://keytronic.com', email: 'keytronic@jobfair.vn', location: 'Khu B – Bàn B1' },
    { name: 'CÔNG TY TNHH PHÁT TRIỂN KIM SANG', industry: 'Đầu tư – Phát triển', website: 'https://kimsang.vn', email: 'kimsang@jobfair.vn', location: 'Khu B – Bàn B2' },
    { name: 'CÔNG TY TNHH WORLD KOGYO VIỆT NAM', industry: 'Sản xuất công nghiệp', website: 'https://worldkogyo.com', email: 'worldkogyo@jobfair.vn', location: 'Khu B – Bàn B3' },
    { name: 'Công Ty TNHH Omron Healthcare Manufacturing Việt Nam', industry: 'Thiết bị y tế – Sản xuất', website: 'https://omron.com.vn', email: 'omron@jobfair.vn', location: 'Khu B – Bàn B4' },
    { name: 'Công ty Cổ phần Thương mại và Sản xuất ASIA GREEN', industry: 'Thương mại – Sản xuất', website: 'https://asiagreen.vn', email: 'asiagreen@jobfair.vn', location: 'Khu B – Bàn B5' },
    { name: 'Công ty TNHH NIHON INFORMATION', industry: 'Công nghệ thông tin', website: 'https://nihon-info.com', email: 'nihon@jobfair.vn', location: 'Khu C – Bàn C1' },
    { name: 'Công ty TNHH MTV Môi trường & Tài nguyên sinh vật Hướng Sáng', industry: 'Môi trường – Tài nguyên', website: 'https://huongsang.vn', email: 'huongsang@jobfair.vn', location: 'Khu C – Bàn C2' },
    { name: 'CÔNG TY CỔ PHẦN FPT', industry: 'Công nghệ thông tin – Viễn thông', website: 'https://fpt.com.vn', email: 'fpt@jobfair.vn', location: 'Khu C – Bàn C3' },
    { name: 'Công ty TNHH Thương mại và Đầu tư Bách An Phát', industry: 'Thương mại – Đầu tư', website: 'https://bachanphat.vn', email: 'bachanphat@jobfair.vn', location: 'Khu C – Bàn C4' },
    { name: 'Công ty Cổ phần Sao Hỏa (Mars Corporation)', industry: 'Thương mại – Tiêu dùng', website: 'https://mars.vn', email: 'marscorp@jobfair.vn', location: 'Khu C – Bàn C5' },
    { name: 'CÔNG TY CỔ PHẦN DỊCH VỤ KỸ THUẬT VIỄN THÔNG HÀ NỘI CHI NHÁNH ĐÀ NẴNG', industry: 'Viễn thông – Kỹ thuật', website: 'https://hantec.com.vn', email: 'hantec@jobfair.vn', location: 'Khu D – Bàn D1' },
    { name: 'CÔNG TY TNHH NĂNG LƯỢNG MẶT TRỜI SUNRISE DANA', industry: 'Năng lượng tái tạo', website: 'https://sunrisedana.vn', email: 'sunrise@jobfair.vn', location: 'Khu D – Bàn D2' },
    { name: 'Công Ty Cổ Phần Xây Dựng Đức Nhì', industry: 'Xây dựng', website: 'https://ducnhi.vn', email: 'ducnhi@jobfair.vn', location: 'Khu D – Bàn D3' },
    { name: 'Công ty Cổ phần Xây dựng CENTRAL', industry: 'Xây dựng – Hạ tầng', website: 'https://central.com.vn', email: 'central@jobfair.vn', location: 'Khu D – Bàn D4' },
    { name: 'CÔNG TY TNHH SMC CORPORATION (VIỆT NAM) ĐÀ NẴNG', industry: 'Tự động hóa – Khí nén', website: 'https://smc.vn', email: 'smc@jobfair.vn', location: 'Khu D – Bàn D5' },
    { name: 'CÔNG TY CỔ PHẦN THIẾT BỊ ĐIỆN TRẦN LÊ', industry: 'Thiết bị điện', website: 'https://tranle.vn', email: 'tranle@jobfair.vn', location: 'Khu E – Bàn E1' },
    { name: 'Công ty TNHH B&D Lingerie Việt Nam', industry: 'Dệt may – Sản xuất', website: 'https://bdlingerie.vn', email: 'bdlingerie@jobfair.vn', location: 'Khu E – Bàn E2' },
    { name: 'CÔNG TY TNHH ALCHIP TECHNOLOGIES (VIỆT NAM)', industry: 'Thiết kế chip – Vi mạch bán dẫn', website: 'https://alchip.com', email: 'alchip@jobfair.vn', location: 'Khu E – Bàn E3' },
];

// ── MAIN ─────────────────────────────────────────────────────────────────────
async function bootstrap() {
    const app = await NestFactory.createApplicationContext(AppModule);
    const userRepo     = app.get<Repository<User>>(getRepositoryToken(User));
    const businessRepo = app.get<Repository<Business>>(getRepositoryToken(Business));
    const boothRepo    = app.get<Repository<Booth>>(getRepositoryToken(Booth));
    const studentRepo  = app.get<Repository<Student>>(getRepositoryToken(Student));
    const checkinRepo  = app.get<Repository<Checkin>>(getRepositoryToken(Checkin));
    const schoolRepo   = app.get<Repository<School>>(getRepositoryToken(School));

    const defaultPassword = 'password123';
    const passwordHash = await bcrypt.hash(defaultPassword, 10);

    // ── 1. Base users ────────────────────────────────────────────────────────
    const baseUsers = [
        { email: 'school@example.com', role: UserRole.SCHOOL_ADMIN,  name: 'School Admin'  },
        { email: 'system@example.com', role: UserRole.SYSTEM_ADMIN,  name: 'System Admin'  },
        { email: 'scanner@example.com', role: UserRole.BOOTH_STAFF,  name: 'Scanner User'  },
    ];
    console.log('\n[1] Seeding base users...');
    for (const u of baseUsers) {
        const exists = await userRepo.findOne({ where: { email: u.email } });
        if (!exists) {
            await userRepo.save(userRepo.create({ ...u, passwordHash }));
            console.log(`  ✔ ${u.email}`);
        } else {
            console.log(`  – exists: ${u.email}`);
        }
    }

    // ── 2. School ────────────────────────────────────────────────────────────
    console.log('\n[2] Seeding school...');
    let school = await schoolRepo.findOne({ where: { code: 'DUT' } });
    if (!school) {
        school = await schoolRepo.save(schoolRepo.create({
            name: 'Trường Đại học Bách khoa – Đại học Đà Nẵng',
            code: 'DUT',
            address: '54 Nguyễn Lương Bằng, Liên Chiểu, Đà Nẵng',
            studentCount: 0,
        }));
        console.log(`  ✔ Created school: ${school.name}`);
    } else {
        console.log(`  – School exists: ${school.name}`);
    }

    // ── 3. Businesses + Booths + Business admins ─────────────────────────────
    console.log('\n[3] Seeding businesses, booths & admin accounts...');
    const boothIds: string[] = [];

    for (const c of COMPANIES) {
        let biz = await businessRepo.findOne({ where: { name: c.name } });
        if (!biz) {
            biz = await businessRepo.save(businessRepo.create({
                name: c.name,
                industry: c.industry,
                website: c.website,
                description: `Gian hàng tuyển dụng tại Ngày hội việc làm DUT 2026.`,
            }));
            console.log(`  ✔ Business: ${biz.name}`);
        } else {
            console.log(`  – Business exists: ${biz.name}`);
        }

        let booth = await boothRepo.findOne({ where: { businessId: biz.id } });
        if (!booth) {
            const qrCode = `BOOTH-${biz.id.slice(0, 8).toUpperCase()}-${Date.now()}`;
            booth = await boothRepo.save(boothRepo.create({
                name: `Gian hàng ${c.name}`,
                location: c.location,
                capacity: randInt(30, 80),
                businessId: biz.id,
                qrCode,
            }));
            console.log(`    ✔ Booth: ${booth.name} QR=${qrCode}`);
        } else {
            console.log(`    – Booth exists: ${booth.name}`);
        }
        boothIds.push(booth.id);

        const admin = await userRepo.findOne({ where: { email: c.email } });
        if (!admin) {
            await userRepo.save(userRepo.create({
                email: c.email,
                name: `HR – ${c.name}`,
                role: UserRole.BUSINESS_ADMIN,
                passwordHash,
                boothId: booth.id,
            }));
            console.log(`    ✔ Admin: ${c.email}`);
        } else {
            if (!admin.boothId) await userRepo.update(admin.id, { boothId: booth.id });
            console.log(`    – Admin exists: ${c.email}`);
        }
    }

    // ── 4. Students ──────────────────────────────────────────────────────────
    console.log('\n[4] Seeding students...');
    const studentIds: string[] = [];
    let studentSeq = 1;

    // Distribution: more students in popular depts
    const deptDistribution: Array<{ dept: string; count: number }> = [
        { dept: 'Công nghệ Thông tin',      count: 40 },
        { dept: 'Điện tử viễn thông',        count: 35 },
        { dept: 'Điện',                      count: 30 },
        { dept: 'Cơ Khí',                    count: 25 },
        { dept: 'Cơ khí Giao Thông',         count: 20 },
        { dept: 'Xây dựng cầu đường',        count: 15 },
        { dept: 'Công nghệ tiên tiến',       count: 12 },
        { dept: 'Quản lý dự án',             count: 10 },
        { dept: 'Xây dựng công trình thủy',  count: 8  },
        { dept: 'Hóa',                        count: 7  },
    ];

    for (const { dept, count } of deptDistribution) {
        const { majors, classes } = DEPT_META[dept];
        for (let i = 0; i < count; i++) {
            const year = randInt(2, 4);
            const studentCode = `DUT${String(studentSeq++).padStart(6, '0')}`;
            const fullName = randomName();
            const className = pick(classes);
            const major = pick(majors);
            const emailSlug = fullName.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
                .replace(/đ/gi, 'd').replace(/[^a-z0-9]/gi, '').toLowerCase()
                .slice(0, 12);
            const email = `${emailSlug}${studentSeq}@sv.dut.edu.vn`;

            const existing = await studentRepo.findOne({ where: { studentCode } });
            if (existing) {
                studentIds.push(existing.id);
                continue;
            }
            const s = await studentRepo.save(studentRepo.create({
                studentCode,
                fullName,
                email,
                major,
                department: dept,
                className,
                year,
                gpa: parseFloat((randInt(250, 400) / 100).toFixed(2)),
                schoolId: school.id,
            }));
            studentIds.push(s.id);
        }
    }
    console.log(`  ✔ Total students seeded/verified: ${studentIds.length}`);

    // ── 5. Checkins (only 04/03/2026 08-17h & 05/03/2026 08-13h) ────────────
    console.log('\n[5] Seeding check-in records...');

    // Determine how many booths each student visits (2–7)
    let checkinCount = 0;

    // Booth popularity weights (index matches boothIds order = COMPANIES order)
    // Higher weight → more students visit that booth
    const boothWeights = [
        3, 2, 2, 4, 2,   // Rinova, Wolfram, Giấy Vàng, Hòa Phát, Globalcert
        4, 1, 3, 5, 2,   // Key Tronic, Kim Sang, World Kogyo, Omron, Asia Green
        5, 1, 6, 1, 2,   // Nihon Info, Hướng Sáng, FPT, Bách An Phát, Sao Hỏa
        3, 3, 2, 2, 4,   // Hantec, Sunrise, Đức Nhì, Central, SMC
        3, 1, 6,          // Trần Lê, B&D, Alchip
    ];

    // Build weighted pool of boothIds for random selection
    const weightedPool: string[] = [];
    boothIds.forEach((id, idx) => {
        const w = boothWeights[idx] ?? 2;
        for (let i = 0; i < w; i++) weightedPool.push(id);
    });

    for (const studentId of studentIds) {
        const numBooths = randInt(2, 7);
        const selectedBooths = pickN(boothIds, numBooths);

        for (const boothId of selectedBooths) {
            // 70% visit day-1, 30% visit day-2
            const dayBias: 1 | 2 = Math.random() < 0.70 ? 1 : 2;
            const checkInTime = randomCheckinTime(dayBias);

            // Skip if duplicate already exists for this student+booth on same day
            const dayStart = new Date(checkInTime);
            dayStart.setHours(0, 0, 0, 0);
            const dayEnd   = new Date(checkInTime);
            dayEnd.setHours(23, 59, 59, 999);

            const dup = await checkinRepo
                .createQueryBuilder('c')
                .where('c.studentId = :sid', { sid: studentId })
                .andWhere('c.boothId = :bid', { bid: boothId })
                .andWhere('c.checkInTime BETWEEN :start AND :end', { start: dayStart, end: dayEnd })
                .getOne();
            if (dup) continue;

            const duration = randInt(8, 45);
            const checkin = checkinRepo.create({
                studentId,
                boothId,
                status: Math.random() < 0.85 ? 'completed' : 'active',
                durationMinutes: duration,
            });
            // Override createdAt/checkInTime via raw query approach
            const saved = await checkinRepo.save(checkin);
            await checkinRepo.query(
                `UPDATE checkins SET check_in_time = $1 WHERE id = $2`,
                [checkInTime, saved.id],
            );
            checkinCount++;
        }
    }
    console.log(`  ✔ Total check-in records created: ${checkinCount}`);

    console.log(`\n${'─'.repeat(55)}`);
    console.log(`  All accounts password : ${defaultPassword}`);
    console.log(`  Business admins       : see COMPANIES list (email = <slug>@jobfair.vn)`);
    console.log(`  School admin          : school@example.com`);
    console.log(`  System admin          : system@example.com`);
    console.log(`  Scanner               : scanner@example.com`);
    console.log(`  Students seeded       : ${studentIds.length}`);
    console.log(`  Checkin records       : ${checkinCount}`);
    console.log(`  Event windows         : 04/03/2026 08:00–17:00 & 05/03/2026 08:00–13:00`);
    console.log(`${'─'.repeat(55)}\n`);

    await app.close();
}

bootstrap().catch((err) => {
    console.error('Seeding failed!', err);
    process.exit(1);
});

