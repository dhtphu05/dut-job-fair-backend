import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomBytes } from 'crypto';
import { DataSource, Repository } from 'typeorm';
import { Checkin } from '../entities/checkin.entity';
import { RewardClaim } from '../entities/reward-claim.entity';
import { RewardMilestone } from '../entities/reward-milestone.entity';
import { Student } from '../entities/student.entity';
import { User } from '../entities/user.entity';
import {
  CreateRewardClaimRequestDto,
  CreateRewardMilestoneDto,
  UpdateRewardMilestoneDto,
} from './dto/reward.dto';

@Injectable()
export class RewardsService {
  constructor(
    @InjectRepository(RewardMilestone)
    private readonly milestoneRepo: Repository<RewardMilestone>,
    @InjectRepository(RewardClaim)
    private readonly claimRepo: Repository<RewardClaim>,
    @InjectRepository(Student)
    private readonly studentRepo: Repository<Student>,
    @InjectRepository(Checkin)
    private readonly checkinRepo: Repository<Checkin>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly dataSource: DataSource,
  ) {}

  async getMilestones(includeInactive = true) {
    return this.milestoneRepo.find({
      where: includeInactive ? {} : { isActive: true },
      order: { sortOrder: 'ASC', requiredBooths: 'ASC', createdAt: 'ASC' },
    });
  }

  async createMilestone(dto: CreateRewardMilestoneDto) {
    return this.milestoneRepo.save(
      this.milestoneRepo.create({
        name: dto.name,
        description: dto.description ?? null,
        requiredBooths: dto.requiredBooths,
        sortOrder: dto.sortOrder ?? 0,
        isActive: dto.isActive ?? true,
      }),
    );
  }

  async updateMilestone(id: string, dto: UpdateRewardMilestoneDto) {
    const milestone = await this.milestoneRepo.findOne({ where: { id } });
    if (!milestone) throw new NotFoundException('Mốc quà không tồn tại');
    Object.assign(milestone, {
      ...dto,
      description: dto.description ?? milestone.description,
    });
    return this.milestoneRepo.save(milestone);
  }

  async getStudentRewardProgress(studentCode: string) {
    const student = await this.studentRepo.findOne({ where: { studentCode } });
    if (!student) {
      throw new NotFoundException(
        `Student with code "${studentCode}" not found`,
      );
    }

    const [milestones, checkedInBoothsRaw, claims] = await Promise.all([
      this.getMilestones(false),
      this.checkinRepo
        .createQueryBuilder('c')
        .select('COUNT(DISTINCT c.boothId)', 'count')
        .where('c.studentId = :studentId', { studentId: student.id })
        .getRawOne<{ count: string }>(),
      this.claimRepo.find({
        where: { studentId: student.id },
        relations: ['milestone'],
      }),
    ]);

    const checkedInBooths = Number(checkedInBoothsRaw?.count ?? 0);
    const claimByMilestoneId = new Map(
      claims
        .sort((a, b) => b.requestedAt.getTime() - a.requestedAt.getTime())
        .map((claim) => [claim.milestoneId, claim]),
    );

    const milestoneProgress = milestones.map((milestone) => {
      const claim = claimByMilestoneId.get(milestone.id);
      const eligible = checkedInBooths >= milestone.requiredBooths;
      return {
        id: milestone.id,
        name: milestone.name,
        description: milestone.description,
        requiredBooths: milestone.requiredBooths,
        eligible,
        claimed: claim?.status === 'claimed',
        pendingClaim:
          claim?.status === 'pending'
            ? {
                id: claim.id,
                requestCode: claim.requestCode,
                expiresAt: claim.expiresAt,
                requestedAt: claim.requestedAt,
              }
            : null,
      };
    });

    const nextMilestone = milestones.find(
      (milestone) => checkedInBooths < milestone.requiredBooths,
    );

    return {
      studentCode: student.studentCode,
      fullName: student.fullName,
      checkedInBooths,
      milestones: milestoneProgress,
      nextMilestone: nextMilestone
        ? {
            id: nextMilestone.id,
            name: nextMilestone.name,
            requiredBooths: nextMilestone.requiredBooths,
            remainingBooths: nextMilestone.requiredBooths - checkedInBooths,
          }
        : null,
    };
  }

  async createClaimRequest(dto: CreateRewardClaimRequestDto) {
    const student = await this.studentRepo.findOne({
      where: { studentCode: dto.studentCode },
    });
    if (!student) {
      throw new NotFoundException(
        `Student with code "${dto.studentCode}" not found`,
      );
    }

    const milestone = await this.milestoneRepo.findOne({
      where: { id: dto.milestoneId, isActive: true },
    });
    if (!milestone) throw new NotFoundException('Mốc quà không tồn tại');

    return this.dataSource.transaction(async (manager) => {
      const checkedInBoothsRaw = await manager
        .createQueryBuilder(Checkin, 'c')
        .select('COUNT(DISTINCT c.boothId)', 'count')
        .where('c.studentId = :studentId', { studentId: student.id })
        .getRawOne<{ count: string }>();
      const checkedInBooths = Number(checkedInBoothsRaw?.count ?? 0);

      if (checkedInBooths < milestone.requiredBooths) {
        throw new BadRequestException(
          `Sinh viên chưa đủ điều kiện nhận quà ở mốc ${milestone.requiredBooths} booth`,
        );
      }

      const existingClaims = await manager.find(RewardClaim, {
        where: { studentId: student.id, milestoneId: milestone.id },
        order: { requestedAt: 'DESC' },
      });

      const claimed = existingClaims.find(
        (claim) => claim.status === 'claimed',
      );
      if (claimed) {
        throw new BadRequestException('Sinh viên đã nhận quà ở mốc này');
      }

      const activePending = existingClaims.find(
        (claim) =>
          claim.status === 'pending' &&
          (!claim.expiresAt || claim.expiresAt.getTime() > Date.now()),
      );
      if (activePending) {
        return {
          id: activePending.id,
          status: activePending.status,
          requestCode: activePending.requestCode,
          expiresAt: activePending.expiresAt,
          milestone: {
            id: milestone.id,
            name: milestone.name,
            requiredBooths: milestone.requiredBooths,
          },
        };
      }

      const expiredPendingIds = existingClaims
        .filter(
          (claim) =>
            claim.status === 'pending' &&
            claim.expiresAt &&
            claim.expiresAt.getTime() <= Date.now(),
        )
        .map((claim) => claim.id);

      if (expiredPendingIds.length > 0) {
        await manager.update(RewardClaim, expiredPendingIds, {
          status: 'expired',
        });
      }

      const requestCode = this.generateRequestCode();
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
      const claim = manager.create(RewardClaim, {
        studentId: student.id,
        milestoneId: milestone.id,
        status: 'pending',
        requestCode,
        expiresAt,
      });
      const saved = await manager.save(RewardClaim, claim);

      return {
        id: saved.id,
        status: saved.status,
        requestCode: saved.requestCode,
        expiresAt: saved.expiresAt,
        milestone: {
          id: milestone.id,
          name: milestone.name,
          requiredBooths: milestone.requiredBooths,
        },
      };
    });
  }

  async confirmClaim(claimId: string, confirmedByUserId: string) {
    const [claim, confirmedByUser] = await Promise.all([
      this.claimRepo.findOne({
        where: { id: claimId },
        relations: ['student', 'milestone'],
      }),
      this.userRepo.findOne({ where: { id: confirmedByUserId } }),
    ]);

    if (!claim) throw new NotFoundException('Yêu cầu nhận quà không tồn tại');
    if (!confirmedByUser) {
      throw new NotFoundException('Người xác nhận không tồn tại');
    }
    if (claim.status === 'claimed') {
      throw new BadRequestException('Yêu cầu này đã được xác nhận nhận quà');
    }
    if (claim.status !== 'pending') {
      throw new BadRequestException('Yêu cầu nhận quà không còn hiệu lực');
    }
    if (claim.expiresAt && claim.expiresAt.getTime() <= Date.now()) {
      claim.status = 'expired';
      await this.claimRepo.save(claim);
      throw new BadRequestException('Yêu cầu nhận quà đã hết hạn');
    }

    claim.status = 'claimed';
    claim.claimedAt = new Date();
    claim.confirmedByUserId = confirmedByUser.id;
    const saved = await this.claimRepo.save(claim);

    return {
      id: saved.id,
      status: saved.status,
      claimedAt: saved.claimedAt,
      requestCode: saved.requestCode,
      student: {
        id: claim.student.id,
        studentCode: claim.student.studentCode,
        fullName: claim.student.fullName,
      },
      milestone: {
        id: claim.milestone.id,
        name: claim.milestone.name,
        requiredBooths: claim.milestone.requiredBooths,
      },
      confirmedBy: {
        id: confirmedByUser.id,
        name: confirmedByUser.name,
        email: confirmedByUser.email,
      },
    };
  }

  async getPendingClaims(page = 1, pageSize = 20) {
    const now = new Date();
    await this.claimRepo
      .createQueryBuilder()
      .update(RewardClaim)
      .set({ status: 'expired' })
      .where('status = :status', { status: 'pending' })
      .andWhere('expiresAt IS NOT NULL')
      .andWhere('expiresAt <= :now', { now })
      .execute();

    const [claims, total] = await this.claimRepo.findAndCount({
      where: { status: 'pending' },
      relations: ['student', 'milestone'],
      order: { requestedAt: 'DESC' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });

    return {
      items: claims.map((claim) => ({
        id: claim.id,
        requestCode: claim.requestCode,
        requestedAt: claim.requestedAt,
        expiresAt: claim.expiresAt,
        student: {
          id: claim.student.id,
          studentCode: claim.student.studentCode,
          fullName: claim.student.fullName,
        },
        milestone: {
          id: claim.milestone.id,
          name: claim.milestone.name,
          requiredBooths: claim.milestone.requiredBooths,
        },
      })),
      total,
      page,
      pageSize,
      hasMore: page * pageSize < total,
    };
  }

  private generateRequestCode() {
    return `RW-${randomBytes(4).toString('hex').toUpperCase()}`;
  }
}
