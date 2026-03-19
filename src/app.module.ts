import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { BusinessAdminModule } from './business-admin/business-admin.module';
import { BusinessesModule } from './businesses/businesses.module';
import { BoothsModule } from './booths/booths.module';
import { CheckinModule } from './checkin/checkin.module';
import { Booth } from './entities/booth.entity';
import { Business } from './entities/business.entity';
import { Checkin } from './entities/checkin.entity';
import { JobPosition } from './entities/job-position.entity';
import { School } from './entities/school.entity';
import { Student } from './entities/student.entity';
import { User } from './entities/user.entity';
import { RewardMilestone } from './entities/reward-milestone.entity';
import { RewardClaim } from './entities/reward-claim.entity';
import { UserSession } from './entities/user-session.entity';
import { RewardsModule } from './rewards/rewards.module';
import { ScannerModule } from './scanner/scanner.module';
import { SchoolAdminModule } from './school-admin/school-admin.module';
import { SchoolsModule } from './schools/schools.module';
import { StudentsModule } from './students/students.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get<string>('DB_HOST'),
        port: configService.get<number>('DB_PORT'),
        username: configService.get<string>('DB_USER'),
        password: configService.get<string>('DB_PASSWORD'),
        database: configService.get<string>('DB_NAME'),
        entities: [
          School,
          Student,
          Business,
          Booth,
          Checkin,
          RewardMilestone,
          RewardClaim,
          User,
          UserSession,
          JobPosition,
        ],
        synchronize: true, // Only for development – use migrations in production
        logging: false,
      }),
      inject: [ConfigService],
    }),
    // Auth
    AuthModule,
    // Feature modules
    ScannerModule,
    CheckinModule,
    RewardsModule,
    StudentsModule,
    SchoolsModule,
    BusinessesModule,
    BoothsModule,
    // Admin dashboards
    SchoolAdminModule,
    BusinessAdminModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
