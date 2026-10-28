import * as bcrypt from 'bcryptjs';
import { NestFactory } from '@nestjs/core';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AppModule } from '../app.module';
import { User, UserRole } from '../entities/user.entity';

type AccountSeed = {
  email: string;
  name: string;
  role: UserRole;
  passwordHash: string;
  boothId?: string | null;
};

const DEFAULT_ADMIN_PASSWORD = 'AdminJobfair2026';

function resolveAdminPassword(): string {
  const password = process.env.SEED_ADMIN_PASSWORD?.trim() || DEFAULT_ADMIN_PASSWORD;

  if (password.length < 6) {
    throw new Error('SEED_ADMIN_PASSWORD phải có ít nhất 6 ký tự.');
  }

  return password;
}

async function upsertUser(
  userRepo: Repository<User>,
  account: AccountSeed,
): Promise<void> {
  const existingUser = await userRepo.findOne({
    where: { email: account.email },
  });
  const attributes = {
    name: account.name,
    role: account.role,
    passwordHash: account.passwordHash,
    boothId: account.boothId ?? null,
    isActive: true,
  };

  if (existingUser) {
    await userRepo.update(existingUser.id, attributes);
    console.log(`= Updated account: ${account.email}`);
    return;
  }

  await userRepo.save(userRepo.create({ email: account.email, ...attributes }));
  console.log(`+ Created account: ${account.email}`);
}

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);

  try {
    const adminPassword = resolveAdminPassword();
    const adminPasswordHash = await bcrypt.hash(adminPassword, 10);
    const userRepo = app.get<Repository<User>>(getRepositoryToken(User));

    console.log(`[seed-shared-accounts] Đồng bộ tài khoản admin cục bộ (password: ${adminPassword})...`);
    const accounts: AccountSeed[] = [
      {
        email: 'checkin@admin.com',
        name: 'School Admin',
        role: UserRole.SCHOOL_ADMIN,
        passwordHash: adminPasswordHash,
      },
      {
        email: 'system@example.com',
        name: 'System Admin',
        role: UserRole.SYSTEM_ADMIN,
        passwordHash: adminPasswordHash,
      },
      {
        email: 'scanner@example.com',
        name: 'Scanner User',
        role: UserRole.BOOTH_STAFF,
        passwordHash: adminPasswordHash,
      },
    ];

    for (const account of accounts) {
      await upsertUser(userRepo, account);
    }

    console.log('\nDanh sach tai khoan admin cuc bo:');
    for (const account of accounts) {
      console.log(`- ${account.email} / ${adminPassword}`);
    }
    console.log('[seed-shared-accounts] Hoàn tất: 3 tài khoản nội bộ.');
  } finally {
    await app.close();
  }
}

bootstrap().catch((error) => {
  console.error('[seed-shared-accounts] Failed:', error);
  process.exit(1);
});
