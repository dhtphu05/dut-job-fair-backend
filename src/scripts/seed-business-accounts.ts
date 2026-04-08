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

const DEFAULT_PASSWORD = 'password123';

function buildBoothCode(index: number): string {
  return `B${String(index + 1).padStart(2, '0')}`;
}

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);

  try {
    const userRepo = app.get<Repository<User>>(getRepositoryToken(User));
    const businessRepo = app.get<Repository<Business>>(getRepositoryToken(Business));
    const boothRepo = app.get<Repository<Booth>>(getRepositoryToken(Booth));
    const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 10);

    console.log(`[seed-business-accounts] Start seeding ${SEED_COMPANIES.length} companies`);
    console.log(`[seed-business-accounts] Default password: ${DEFAULT_PASSWORD}`);

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
        console.log(`+ Business created: ${company.name}`);
      } else {
        await businessRepo.update(business.id, {
          publicId: company.publicId,
          logoUrl: company.logoUrl,
          description: `Gian hàng tuyển dụng tại DUT Job Fair ${DEMO_EVENT_DATE}.`,
        });
        console.log(`= Business updated: ${company.name}`);
      }

      let booth = await boothRepo.findOne({ where: { businessId: business.id } });
      if (!booth) {
        booth = await boothRepo.save(
          boothRepo.create({
            businessId: business.id,
            name: `Gian hàng ${company.name}`,
            location: `Khu doanh nghiệp - ${boothCode}`,
            capacity: 50,
            qrCode: `BOOTH-${boothCode}`,
          }),
        );
        console.log(`+ Booth created: ${booth.name}`);
      } else {
        await boothRepo.update(booth.id, {
          name: `Gian hàng ${company.name}`,
          location: `Khu doanh nghiệp - ${boothCode}`,
          capacity: 50,
          qrCode: `BOOTH-${boothCode}`,
        });
        console.log(`= Booth updated: ${company.name}`);
      }

      const existingByEmail = await userRepo.findOne({ where: { email: company.email } });
      const existingByBooth = await userRepo.findOne({ where: { boothId: booth.id } });
      const targetUser = existingByBooth ?? existingByEmail;

      if (!targetUser) {
        await userRepo.save(
          userRepo.create({
            email: company.email,
            passwordHash,
            name: company.name,
            role: UserRole.BUSINESS_ADMIN,
            isActive: true,
            boothId: booth.id,
          }),
        );
        console.log(`+ Account created: ${company.email}`);
      } else {
        await userRepo.update(targetUser.id, {
          email: company.email,
          passwordHash,
          name: company.name,
          role: UserRole.BUSINESS_ADMIN,
          isActive: true,
          boothId: booth.id,
        });
        console.log(`= Account reset: ${company.email}`);
      }
    }

    console.log(`[seed-business-accounts] Start seeding ${SEED_WORKSHOPS.length} workshops`);
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
        console.log(`+ Workshop business created: ${workshop.name}`);
      } else {
        await businessRepo.update(business.id, {
          publicId: workshop.publicId,
          logoUrl: workshop.logoUrl || null,
          description: `Hội thảo chuyên đề tại DUT Job Fair ${DEMO_EVENT_DATE}.`,
          type: BusinessType.WORKSHOP,
        });
        console.log(`= Workshop business updated: ${workshop.name}`);
      }

      let booth = await boothRepo.findOne({ where: { businessId: business.id } });
      if (!booth) {
        booth = await boothRepo.save(
          boothRepo.create({
            businessId: business.id,
            name: workshop.boothName,
            location: workshop.location,
            capacity: workshop.capacity,
            qrCode: workshop.qrCode,
            type: BoothType.WORKSHOP,
          }),
        );
        console.log(`+ Workshop booth created: ${booth.name}`);
      } else {
        await boothRepo.update(booth.id, {
          name: workshop.boothName,
          location: workshop.location,
          capacity: workshop.capacity,
          qrCode: workshop.qrCode,
          type: BoothType.WORKSHOP,
        });
        console.log(`= Workshop booth updated: ${workshop.name}`);
      }

      const existingByEmail = await userRepo.findOne({ where: { email: workshop.email } });
      const existingByBooth = await userRepo.findOne({ where: { boothId: booth.id } });
      const targetUser = existingByBooth ?? existingByEmail;

      if (!targetUser) {
        await userRepo.save(
          userRepo.create({
            email: workshop.email,
            passwordHash,
            name: workshop.name,
            role: UserRole.BUSINESS_ADMIN,
            isActive: true,
            boothId: booth.id,
          }),
        );
        console.log(`+ Workshop account created: ${workshop.email}`);
      } else {
        await userRepo.update(targetUser.id, {
          email: workshop.email,
          passwordHash,
          name: workshop.name,
          role: UserRole.BUSINESS_ADMIN,
          isActive: true,
          boothId: booth.id,
        });
        console.log(`= Workshop account reset: ${workshop.email}`);
      }
    }

    console.log('\nDanh sach tai khoan business admin:');
    for (const company of SEED_COMPANIES) {
      console.log(`- ${company.email} / ${DEFAULT_PASSWORD}`);
    }
    for (const workshop of SEED_WORKSHOPS) {
      console.log(`- ${workshop.email} / ${DEFAULT_PASSWORD}`);
    }
  } finally {
    await app.close();
  }
}

bootstrap().catch((error) => {
  console.error('[seed-business-accounts] Failed:', error);
  process.exit(1);
});
