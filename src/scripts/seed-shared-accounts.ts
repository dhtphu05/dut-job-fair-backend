import * as bcrypt from 'bcryptjs';
import { NestFactory } from '@nestjs/core';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AppModule } from '../app.module';
import { Booth, BoothType } from '../entities/booth.entity';
import { Business, BusinessType } from '../entities/business.entity';
import { User, UserRole } from '../entities/user.entity';
import {
  DEMO_EVENT_DATE,
  SEED_COMPANIES,
  SEED_WORKSHOPS,
} from '../seed-data/companies';

type AccountSeed = {
  email: string;
  name: string;
  role: UserRole;
  passwordHash: string;
  boothId?: string | null;
};

type BusinessAccountSeed = {
  businessName: string;
  businessType: BusinessType;
  publicId: string | null;
  logoUrl: string | null;
  description: string;
  boothName: string;
  boothType: BoothType;
  location: string;
  capacity: number;
  qrCode: string;
  email: string;
};

function requiredPassword(variableName: string): string {
  const password = process.env[variableName]?.trim();

  if (!password) {
    throw new Error(
      `Thiếu ${variableName}. Hãy đặt cùng giá trị cho local .env và secret của production.`,
    );
  }

  if (password.length < 6) {
    throw new Error(`${variableName} phải có ít nhất 6 ký tự.`);
  }

  return password;
}

function workshopEmail(email: string, qrCode: string): string {
  return email.trim() || `${qrCode.toLowerCase()}@jobfair`;
}

function getBusinessAccountSeeds(): BusinessAccountSeed[] {
  const companySeeds = SEED_COMPANIES.map((company, index) => ({
    businessName: company.name,
    businessType: BusinessType.BOOTH,
    publicId: company.publicId || null,
    logoUrl: company.logoUrl || null,
    description: `Gian hàng tuyển dụng tại DUT Job Fair ${DEMO_EVENT_DATE}.`,
    boothName: company.name,
    boothType: BoothType.BOOTH,
    location: `Khu doanh nghiệp - B${String(index + 1).padStart(2, '0')}`,
    capacity: 50,
    qrCode: `BOOTH-B${String(index + 1).padStart(2, '0')}`,
    email: company.email,
  }));

  const workshopSeeds = SEED_WORKSHOPS.map((workshop) => ({
    businessName: workshop.name,
    businessType: BusinessType.WORKSHOP,
    publicId: workshop.publicId || null,
    logoUrl: workshop.logoUrl || null,
    description: `Hội thảo chuyên đề tại DUT Job Fair ${DEMO_EVENT_DATE}.`,
    boothName: workshop.boothName,
    boothType: BoothType.WORKSHOP,
    location: workshop.location,
    capacity: workshop.capacity,
    qrCode: workshop.qrCode,
    email: workshopEmail(workshop.email, workshop.qrCode),
  }));

  return [...companySeeds, ...workshopSeeds];
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

async function upsertBusinessAccount(
  userRepo: Repository<User>,
  businessRepo: Repository<Business>,
  boothRepo: Repository<Booth>,
  seed: BusinessAccountSeed,
  passwordHash: string,
): Promise<void> {
  let business = await businessRepo.findOne({
    where: { name: seed.businessName },
  });
  const businessAttributes = {
    publicId: seed.publicId,
    logoUrl: seed.logoUrl,
    description: seed.description,
    type: seed.businessType,
  };

  if (business) {
    await businessRepo.update(business.id, businessAttributes);
  } else {
    business = await businessRepo.save(
      businessRepo.create({ name: seed.businessName, ...businessAttributes }),
    );
  }

  let booth = await boothRepo.findOne({
    where: { businessId: business.id },
  });
  const boothAttributes = {
    name: seed.boothName,
    location: seed.location,
    capacity: seed.capacity,
    qrCode: seed.qrCode,
    type: seed.boothType,
  };

  if (booth) {
    await boothRepo.update(booth.id, boothAttributes);
  } else {
    booth = await boothRepo.save(
      boothRepo.create({ businessId: business.id, ...boothAttributes }),
    );
  }

  const [accountByEmail, accountByBooth] = await Promise.all([
    userRepo.findOne({ where: { email: seed.email } }),
    userRepo.findOne({ where: { boothId: booth.id } }),
  ]);

  if (
    accountByEmail &&
    accountByBooth &&
    accountByEmail.id !== accountByBooth.id
  ) {
    throw new Error(
      `Không thể đồng bộ ${seed.email}: email và booth ${seed.qrCode} đang thuộc về hai tài khoản khác nhau.`,
    );
  }

  const account = accountByBooth ?? accountByEmail;
  const accountAttributes = {
    email: seed.email,
    name: seed.businessName,
    role: UserRole.BUSINESS_ADMIN,
    passwordHash,
    boothId: booth.id,
    isActive: true,
  };

  if (account) {
    await userRepo.update(account.id, accountAttributes);
    console.log(`= Updated account: ${seed.email}`);
  } else {
    await userRepo.save(userRepo.create(accountAttributes));
    console.log(`+ Created account: ${seed.email}`);
  }
}

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);

  try {
    // ConfigModule loads .env while the Nest application context is created.
    const adminPassword = requiredPassword('SEED_ADMIN_PASSWORD');
    const businessPassword = requiredPassword('SEED_BUSINESS_PASSWORD');
    const [adminPasswordHash, businessPasswordHash] = await Promise.all([
      bcrypt.hash(adminPassword, 10),
      bcrypt.hash(businessPassword, 10),
    ]);
    const userRepo = app.get<Repository<User>>(getRepositoryToken(User));
    const businessRepo = app.get<Repository<Business>>(
      getRepositoryToken(Business),
    );
    const boothRepo = app.get<Repository<Booth>>(getRepositoryToken(Booth));

    console.log('[seed-shared-accounts] Đồng bộ tài khoản dùng chung...');
    for (const account of [
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
    ]) {
      await upsertUser(userRepo, account);
    }

    const businessAccountSeeds = getBusinessAccountSeeds();
    for (const seed of businessAccountSeeds) {
      await upsertBusinessAccount(
        userRepo,
        businessRepo,
        boothRepo,
        seed,
        businessPasswordHash,
      );
    }

    console.log(
      `[seed-shared-accounts] Hoàn tất: 3 tài khoản nội bộ và ${businessAccountSeeds.length} tài khoản doanh nghiệp/hội thảo.`,
    );
  } finally {
    await app.close();
  }
}

bootstrap().catch((error) => {
  console.error('[seed-shared-accounts] Failed:', error);
  process.exit(1);
});
