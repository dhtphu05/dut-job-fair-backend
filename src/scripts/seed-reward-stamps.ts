import * as bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import { appendFileSync } from 'fs';
import { config } from 'dotenv';
import { join } from 'path';
import { DataSource } from 'typeorm';
import { Booth, BoothType } from '../entities/booth.entity';
import { Business, BusinessType } from '../entities/business.entity';
import { User, UserRole } from '../entities/user.entity';
import { SPECIAL_STAMPS } from '../rewards/special-stamps';

export async function seedRewardStamps(dataSource: DataSource) {
  return dataSource.transaction(async (manager) => {
    await manager.query(
      "SELECT pg_advisory_xact_lock(hashtext('seed-reward-stamps'))",
    );
    const created: Array<{ name: string; email: string; password: string }> =
      [];
    for (const stamp of SPECIAL_STAMPS) {
      let booth = await manager.findOne(Booth, {
        where: { qrCode: stamp.qrCode },
      });
      const account = await manager.findOne(User, {
        where: { email: stamp.email },
      });
      if (
        account &&
        (!booth ||
          account.boothId !== booth.id ||
          account.role !== UserRole.BUSINESS_ADMIN)
      ) {
        throw new Error(
          `Tài khoản ${stamp.email} đang thuộc mục đích khác; không ghi đè.`,
        );
      }
      if (!booth) {
        const business = await manager.save(
          Business,
          manager.create(Business, {
            name: stamp.name,
            type: BusinessType.WORKSHOP,
            description: 'Điểm quét dấu đặc biệt cho mốc đổi quà DUT Job Fair.',
          }),
        );
        booth = await manager.save(
          Booth,
          manager.create(Booth, {
            name: stamp.name,
            businessId: business.id,
            qrCode: stamp.qrCode,
            type: BoothType.WORKSHOP,
            capacity: 0,
          }),
        );
      }
      if (account) continue; // Preserve existing passwords, status, IDs and history.
      const otherAccount = await manager.findOne(User, {
        where: { boothId: booth.id },
      });
      if (otherAccount)
        throw new Error(
          `Booth ${stamp.qrCode} đã có tài khoản ${otherAccount.email}; không ghi đè.`,
        );
      const password = randomBytes(15).toString('base64url');
      await manager.save(
        User,
        manager.create(User, {
          email: stamp.email,
          name: stamp.name,
          role: UserRole.BUSINESS_ADMIN,
          boothId: booth.id,
          isActive: true,
          passwordHash: await bcrypt.hash(password, 10),
        }),
      );
      created.push({ name: stamp.name, email: stamp.email, password });
    }
    return created;
  });
}

async function bootstrap() {
  config({ quiet: true });
  const dataSource = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 5432),
    username: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    entities: [join(__dirname, '../entities/*.entity.{ts,js}')],
    synchronize: false,
  });
  await dataSource.initialize();
  try {
    await dataSource.query(
      'ALTER TABLE reward_milestones ADD COLUMN IF NOT EXISTS requires_special_stamps boolean NOT NULL DEFAULT false',
    );
    await dataSource.query('ALTER TABLE reward_milestones ADD COLUMN IF NOT EXISTS required_workshop_ids uuid[]');
    const created = await seedRewardStamps(dataSource);
    if (created.length) {
      // CSV files are ignored by Git. Only newly created credentials are appended.
      appendFileSync(
        'reward-stamp-credentials.csv',
        created
          .map((item) => `${item.name},${item.email},${item.password}\n`)
          .join(''),
        'utf8',
      );
    }
    console.log(
      `Đã tạo ${created.length} tài khoản mới. Hai booth dấu đặc biệt đã sẵn sàng.`,
    );
    if (created.length)
      console.log(
        'Thông tin đăng nhập: reward-stamp-credentials.csv (Tên,Email,Mật khẩu).',
      );
  } finally {
    await dataSource.destroy();
  }
}

if (require.main === module) {
  bootstrap().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
