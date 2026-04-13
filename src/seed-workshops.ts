import * as bcrypt from 'bcryptjs';
import * as fs from 'fs';
import { NestFactory } from '@nestjs/core';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AppModule } from './app.module';
import { Booth, BoothType } from './entities/booth.entity';
import { Business, BusinessType } from './entities/business.entity';
import { User, UserRole } from './entities/user.entity';
import {
  DEMO_EVENT_DATE,
  SEED_WORKSHOPS,
} from './seed-data/companies';

function randomLetters(length: number): string {
  const letters = 'abcdefghijklmnopqrstuvwxyz';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += letters.charAt(Math.floor(Math.random() * letters.length));
  }
  return result;
}

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);

  try {
    const userRepo = app.get<Repository<User>>(getRepositoryToken(User));
    const businessRepo = app.get<Repository<Business>>(getRepositoryToken(Business));
    const boothRepo = app.get<Repository<Booth>>(getRepositoryToken(Booth));

    console.log('\n[1] Xoá dữ liệu Workshop Rác...');
    await userRepo.manager.query(`
      DELETE FROM users WHERE role = 'business_admin' AND booth_id IN (SELECT id FROM booths WHERE type = 'workshop');
      DELETE FROM booths WHERE type = 'workshop';
      DELETE FROM businesses WHERE type = 'workshop';
    `);

    console.log('\n[2] Seeding workshops and workshop admins...');
    const workshopCredentials: string[] = ['Workshop,Email (Tên đăng nhập),Mật Khẩu'];
    const workshopPasswordBase = 'jobfair2026_workshop';
    const workshopPasswordHash = await bcrypt.hash(workshopPasswordBase, 10);

    for (const workshop of SEED_WORKSHOPS) {
      let business = await businessRepo.save(
        businessRepo.create({
          name: workshop.name,
          publicId: workshop.publicId,
          logoUrl: workshop.logoUrl || null,
          description: `Hội thảo chuyên đề tại DUT Job Fair ${DEMO_EVENT_DATE}.`,
          type: BusinessType.WORKSHOP,
        }),
      );
      console.log(`  + Workshop business: ${workshop.name}`);

      let booth = await boothRepo.save(
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

      const workshopEmail = `${randomLetters(3)}-workshop@jobfair`;
      const safeName = workshop.name.replace(/"/g, "'");
      workshopCredentials.push(`"${safeName}",${workshopEmail},${workshopPasswordBase}`);

      await userRepo.save(
        userRepo.create({
          email: workshopEmail,
          name: workshop.name,
          role: UserRole.BUSINESS_ADMIN,
          passwordHash: workshopPasswordHash,
          boothId: booth.id,
          isActive: true,
        }),
      );
      console.log(`    + Workshop admin: ${workshopEmail}`);
    }

    console.log(`\n${'─'.repeat(55)}`);
    console.log(`  Workshops seeded      : ${SEED_WORKSHOPS.length}`);
    
    fs.writeFileSync('workshop_credentials.csv', '\uFEFF' + workshopCredentials.join('\n'), 'utf8');
    console.log('  📁 Đã xuất danh sách mật khẩu Workshop ra file: workshop_credentials.csv');

    console.log(`  Demo event date       : ${DEMO_EVENT_DATE} 08:00–17:00 (+07:00)`);
    console.log(`${'─'.repeat(55)}\n`);
  } finally {
    await app.close();
  }
}

bootstrap().catch((err) => {
  console.error('Workshop Seeding failed!', err);
  process.exit(1);
});
