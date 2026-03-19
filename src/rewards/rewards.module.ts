import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Checkin } from '../entities/checkin.entity';
import { RewardClaim } from '../entities/reward-claim.entity';
import { RewardMilestone } from '../entities/reward-milestone.entity';
import { Student } from '../entities/student.entity';
import { User } from '../entities/user.entity';
import { RewardsController } from './rewards.controller';
import { RewardsService } from './rewards.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      RewardMilestone,
      RewardClaim,
      Student,
      Checkin,
      User,
    ]),
  ],
  controllers: [RewardsController],
  providers: [RewardsService],
})
export class RewardsModule {}
