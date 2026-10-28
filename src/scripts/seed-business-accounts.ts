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

function workshopEmail(email: string, qrCode: string): string {
  return email.trim() || `${qrCode.toLowerCase()}@jobfair.com`;
}

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);

  try {
    const userRepo = app.get<Repository<User>>(getRepositoryToken(User));
    const businessRepo = app.get<Repository<Business>>(getRepositoryToken(Business));
    const boothRepo = app.get<Repository<Booth>>(getRepositoryToken(Booth));
    const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 10);

    // Dọn dẹp các doanh nghiệp/workshop cũ không còn trong danh sách seed hiện tại
    const validCompanyNames = new Set(SEED_COMPANIES.map((c) => c.name));
    const validWorkshopNames = new Set(SEED_WORKSHOPS.map((w) => w.name));

    const allBusinesses = await businessRepo.find({ relations: ['booths'] });
    for (const biz of allBusinesses) {
      if (biz.type === BusinessType.TOTNGHIEP) continue;

      const isValid =
        (biz.type === BusinessType.BOOTH && validCompanyNames.has(biz.name)) ||
        (biz.type === BusinessType.WORKSHOP && validWorkshopNames.has(biz.name));

      if (!isValid) {
        const boothIds = biz.booths?.map((b) => b.id) ?? [];
        if (boothIds.length > 0) {
          await userRepo
            .createQueryBuilder()
            .delete()
            .where('role = :role AND booth_id IN (:...boothIds)', {
              role: UserRole.BUSINESS_ADMIN,
              boothIds,
            })
            .execute();
        }
        await businessRepo.delete(biz.id);
        console.log(`- Removed obsolete business: ${biz.name}`);
      }
    }

    console.log(`[seed-business-accounts] Start seeding ${SEED_COMPANIES.length} companies`);
    console.log(`[seed-business-accounts] Default password: ${DEFAULT_PASSWORD}`);

    for (const [index, company] of SEED_COMPANIES.entries()) {
      const boothCode = buildBoothCode(index);
      const qrCode = `BOOTH-${boothCode}`;
      let business = await businessRepo.findOne({ where: { name: company.name } });

      if (!business) {
        business = await businessRepo.save(
          businessRepo.create({
            name: company.name,
            publicId: company.publicId,
            logoUrl: company.logoUrl,
            description: `Gian hàng tuyển dụng tại DUT Job Fair ${DEMO_EVENT_DATE}.`,
            type: BusinessType.BOOTH,
          }),
        );
        console.log(`+ Business created: ${company.name}`);
      } else {
        await businessRepo.update(business.id, {
          publicId: company.publicId,
          logoUrl: company.logoUrl,
          description: `Gian hàng tuyển dụng tại DUT Job Fair ${DEMO_EVENT_DATE}.`,
          type: BusinessType.BOOTH,
        });
        console.log(`= Business updated: ${company.name}`);
      }

      let booth = await boothRepo.findOne({ where: { businessId: business.id } });
      const conflictingBooth = await boothRepo.findOne({ where: { qrCode } });
      if (conflictingBooth && conflictingBooth.id !== booth?.id) {
        await boothRepo.update(conflictingBooth.id, { qrCode: null as unknown as string });
      }

      if (!booth) {
        booth = await boothRepo.save(
          boothRepo.create({
            businessId: business.id,
            name: `Gian hàng ${company.name}`,
            location: `Khu doanh nghiệp - ${boothCode}`,
            capacity: 50,
            qrCode,
            type: BoothType.BOOTH,
          }),
        );
        console.log(`+ Booth created: ${booth.name}`);
      } else {
        await boothRepo.update(booth.id, {
          name: `Gian hàng ${company.name}`,
          location: `Khu doanh nghiệp - ${boothCode}`,
          capacity: 50,
          qrCode,
          type: BoothType.BOOTH,
        });
        console.log(`= Booth updated: ${company.name}`);
      }

      const existingByEmail = await userRepo.findOne({ where: { email: company.email } });
      const existingByBooth = await userRepo.findOne({ where: { boothId: booth.id } });
      if (existingByEmail && existingByBooth && existingByEmail.id !== existingByBooth.id) {
        await userRepo.delete(existingByEmail.id);
      }
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
      const email = workshopEmail(workshop.email, workshop.qrCode);
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
      const conflictingBooth = await boothRepo.findOne({ where: { qrCode: workshop.qrCode } });
      if (conflictingBooth && conflictingBooth.id !== booth?.id) {
        await boothRepo.update(conflictingBooth.id, { qrCode: null as unknown as string });
      }

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

      const existingByEmail = await userRepo.findOne({ where: { email } });
      const existingByBooth = await userRepo.findOne({ where: { boothId: booth.id } });
      if (existingByEmail && existingByBooth && existingByEmail.id !== existingByBooth.id) {
        await userRepo.delete(existingByEmail.id);
      }
      const targetUser = existingByBooth ?? existingByEmail;

      if (!targetUser) {
        await userRepo.save(
          userRepo.create({
            email,
            passwordHash,
            name: workshop.name,
            role: UserRole.BUSINESS_ADMIN,
            isActive: true,
            boothId: booth.id,
          }),
        );
        console.log(`+ Workshop account created: ${email}`);
      } else {
        await userRepo.update(targetUser.id, {
          email,
          passwordHash,
          name: workshop.name,
          role: UserRole.BUSINESS_ADMIN,
          isActive: true,
          boothId: booth.id,
        });
        console.log(`= Workshop account reset: ${email}`);
      }
    }

    console.log('\nDanh sach tai khoan business admin:');
    for (const company of SEED_COMPANIES) {
      console.log(`- ${company.email} / ${DEFAULT_PASSWORD}`);
    }
    for (const workshop of SEED_WORKSHOPS) {
      console.log(`- ${workshopEmail(workshop.email, workshop.qrCode)} / ${DEFAULT_PASSWORD}`);
    }
  } finally {
    await app.close();
  }
}

bootstrap().catch((error) => {
  console.error('[seed-business-accounts] Failed:', error);
  process.exit(1);
});
