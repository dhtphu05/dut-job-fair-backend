import * as bcrypt from 'bcryptjs';
import { NestFactory } from '@nestjs/core';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AppModule } from '../app.module';
import { Booth, BoothType } from '../entities/booth.entity';
import { Business, BusinessType } from '../entities/business.entity';
import { User, UserRole } from '../entities/user.entity';
import { DEMO_EVENT_DATE } from '../seed-data/companies';

type SeedTotnghiepAccount = {
  businessName: string;
  boothName: string;
  email: string;
  qrCode: string;
  location: string;
};

const DEFAULT_PASSWORD = 'totnghiep2026';

const SEED_TOTNGHIEP_ACCOUNTS: SeedTotnghiepAccount[] = [
  {
    businessName: 'Lễ Tốt nghiệp đợt 1 năm 2026',
    boothName: 'Lễ Tốt nghiệp đợt 1 năm 2026',
    email: 'dot1@tn',
    qrCode: 'TOTNGHIEP-DOT1',
    location: 'Khu Tot nghiep - Dot 1',
  },
  {
    businessName: 'Lễ Tốt nghiệp đợt 1 năm 2026 (test)',
    boothName: 'Lễ Tốt nghiệp đợt 1 năm 2026 (test)',
    email: 'testdot1@tn',
    qrCode: 'TOTNGHIEP-TEST-DOT1',
    location: 'Khu Tot nghiep - Test Dot 1',
  },
];

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);

  try {
    const userRepo = app.get<Repository<User>>(getRepositoryToken(User));
    const businessRepo = app.get<Repository<Business>>(getRepositoryToken(Business));
    const boothRepo = app.get<Repository<Booth>>(getRepositoryToken(Booth));
    const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 10);

    console.log(
      `[seed-totnghiep-accounts] Start seeding ${SEED_TOTNGHIEP_ACCOUNTS.length} totnghiep accounts`,
    );
    console.log(
      `[seed-totnghiep-accounts] Default password: ${DEFAULT_PASSWORD}`,
    );

    for (const accountSeed of SEED_TOTNGHIEP_ACCOUNTS) {
      let business = await businessRepo.findOne({
        where: { name: accountSeed.businessName },
      });

      if (!business) {
        business = await businessRepo.save(
          businessRepo.create({
            name: accountSeed.businessName,
            type: BusinessType.TOTNGHIEP,
            description: `Khu Tot nghiep tai DUT Job Fair ${DEMO_EVENT_DATE}.`,
          }),
        );
        console.log(`+ Totnghiep business created: ${accountSeed.businessName}`);
      } else {
        await businessRepo.update(business.id, {
          name: accountSeed.businessName,
          type: BusinessType.TOTNGHIEP,
          description: `Khu Tot nghiep tai DUT Job Fair ${DEMO_EVENT_DATE}.`,
        });
        console.log(`= Totnghiep business updated: ${accountSeed.businessName}`);
      }

      let booth = await boothRepo.findOne({
        where: { businessId: business.id },
      });

      if (!booth) {
        booth = await boothRepo.save(
          boothRepo.create({
            businessId: business.id,
            name: accountSeed.boothName,
            location: accountSeed.location,
            capacity: 200,
            qrCode: accountSeed.qrCode,
            type: BoothType.TOTNGHIEP,
          }),
        );
        console.log(`+ Totnghiep booth created: ${accountSeed.boothName}`);
      } else {
        await boothRepo.update(booth.id, {
          name: accountSeed.boothName,
          location: accountSeed.location,
          capacity: 200,
          qrCode: accountSeed.qrCode,
          type: BoothType.TOTNGHIEP,
        });
        console.log(`= Totnghiep booth updated: ${accountSeed.boothName}`);
      }

      const existingByEmail = await userRepo.findOne({
        where: { email: accountSeed.email },
      });
      const existingByBooth = await userRepo.findOne({
        where: { boothId: booth.id },
      });
      const targetUser = existingByBooth ?? existingByEmail;

      if (!targetUser) {
        await userRepo.save(
          userRepo.create({
            email: accountSeed.email,
            passwordHash,
            name: accountSeed.businessName,
            role: UserRole.BUSINESS_ADMIN,
            isActive: true,
            boothId: booth.id,
          }),
        );
        console.log(`+ Totnghiep account created: ${accountSeed.email}`);
      } else {
        await userRepo.update(targetUser.id, {
          email: accountSeed.email,
          passwordHash,
          name: accountSeed.businessName,
          role: UserRole.BUSINESS_ADMIN,
          isActive: true,
          boothId: booth.id,
        });
        console.log(`= Totnghiep account reset: ${accountSeed.email}`);
      }
    }

    console.log('\nDanh sach tai khoan Totnghiep:');
    for (const accountSeed of SEED_TOTNGHIEP_ACCOUNTS) {
      console.log(`- ${accountSeed.email} / ${DEFAULT_PASSWORD}`);
    }
  } finally {
    await app.close();
  }
}

bootstrap().catch((error) => {
  console.error('[seed-totnghiep-accounts] Failed:', error);
  process.exit(1);
});
