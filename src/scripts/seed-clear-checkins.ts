import { NestFactory } from '@nestjs/core';
import { DataSource } from 'typeorm';
import { AppModule } from '../app.module';
import { BoothType } from '../entities/booth.entity';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);

  try {
    const dataSource = app.get(DataSource);

    await dataSource.transaction(async (manager) => {
      const beforeStats = await manager.query<{
        booth_checkins: string;
        workshop_checkins: string;
        reward_claims: string;
      }>(
        `
          SELECT
            COUNT(*) FILTER (WHERE b.type = $1)::text AS booth_checkins,
            COUNT(*) FILTER (WHERE b.type = $2)::text AS workshop_checkins,
            (SELECT COUNT(*)::text FROM reward_claims) AS reward_claims
          FROM checkins c
          INNER JOIN booths b ON b.id = c.booth_id
          WHERE b.type IN ($1, $2)
        `,
        [BoothType.BOOTH, BoothType.WORKSHOP],
      );

      const boothCount = Number(beforeStats[0]?.booth_checkins ?? 0);
      const workshopCount = Number(beforeStats[0]?.workshop_checkins ?? 0);
      const rewardClaimCount = Number(beforeStats[0]?.reward_claims ?? 0);

      console.log('[seed-clear-checkins] Đang dọn dữ liệu check-in test...');
      console.log(`- Lượt check-in Doanh nghiệp (booth): ${boothCount}`);
      console.log(`- Lượt check-in Hội thảo (workshop) : ${workshopCount}`);
      console.log(`- Lượt đổi quà (reward_claims)      : ${rewardClaimCount}`);

      await manager.query(
        `
          DELETE FROM checkins
          WHERE booth_id IN (
            SELECT id FROM booths WHERE type IN ($1, $2)
          )
        `,
        [BoothType.BOOTH, BoothType.WORKSHOP],
      );

      await manager.query(`DELETE FROM reward_claims`);

      console.log('\n[seed-clear-checkins] Hoàn tất dọn dữ liệu check-in!');
      console.log(
        '✔ Đã giữ nguyên toàn bộ tài khoản, mật khẩu (Admin, Doanh nghiệp, Hội thảo), danh sách sinh viên, gian hàng và cấu hình mốc quà.',
      );
    });
  } finally {
    await app.close();
  }
}

bootstrap().catch((error) => {
  console.error('[seed-clear-checkins] Failed:', error);
  process.exit(1);
});
