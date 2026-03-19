import {
  BadRequestException,
  Injectable,
  Logger,
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
  RedeemRewardCodeDto,
  UpdateRewardMilestoneDto,
} from './dto/reward.dto';

@Injectable()
export class RewardsService {
  private readonly logger = new Logger(RewardsService.name);

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
    const snapshot = await this.buildStudentRewardSnapshot(studentCode);

    return {
      studentCode: snapshot.studentCode,
      fullName: snapshot.fullName,
      checkedInBooths: snapshot.checkedInBooths,
      milestones: snapshot.milestones.map((milestone) => ({
        id: milestone.id,
        name: milestone.name,
        description: milestone.description,
        requiredBooths: milestone.requiredBooths,
        eligible: milestone.eligible,
        claimed: milestone.claimed,
        pendingClaim: milestone.pendingClaim,
      })),
      nextMilestone: snapshot.nextMilestone,
    };
  }

  async getStudentRewardStatus(studentCode: string) {
    const snapshot = await this.buildStudentRewardSnapshot(studentCode);
    const claimedMilestones = snapshot.milestones.filter(
      (milestone) => milestone.status === 'claimed',
    ).length;
    const eligibleMilestones = snapshot.milestones.filter(
      (milestone) => milestone.eligible,
    ).length;
    const activePendingClaim =
      snapshot.milestones.find((milestone) => milestone.pendingClaim)?.pendingClaim ??
      null;

    return {
      studentCode: snapshot.studentCode,
      fullName: snapshot.fullName,
      checkedInBooths: snapshot.checkedInBooths,
      summary: {
        totalMilestones: snapshot.milestones.length,
        claimedMilestones,
        eligibleMilestones,
        hasPendingClaim: !!activePendingClaim,
      },
      activePendingClaim,
      milestones: snapshot.milestones,
      nextMilestone: snapshot.nextMilestone,
    };
  }

  private async buildStudentRewardSnapshot(studentCode: string) {
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
      const pendingClaim =
        claim?.status === 'pending'
          ? {
              id: claim.id,
              requestCode: claim.requestCode,
              expiresAt: claim.expiresAt,
              requestedAt: claim.requestedAt,
              qrPayload: claim.requestCode,
            }
          : null;

      return {
        id: milestone.id,
        name: milestone.name,
        description: milestone.description,
        requiredBooths: milestone.requiredBooths,
        sortOrder: milestone.sortOrder,
        isActive: milestone.isActive,
        eligible,
        claimed: claim?.status === 'claimed',
        status:
          claim?.status === 'claimed'
            ? 'claimed'
            : pendingClaim
              ? 'pending'
              : eligible
                ? 'eligible'
                : 'locked',
        pendingClaim,
        remainingBooths:
          checkedInBooths >= milestone.requiredBooths
            ? 0
            : milestone.requiredBooths - checkedInBooths,
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
          qrPayload: activePending.requestCode,
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
        qrPayload: saved.requestCode,
        milestone: {
          id: milestone.id,
          name: milestone.name,
          requiredBooths: milestone.requiredBooths,
        },
      };
    });
  }

  async getClaimByRequestCode(requestCode: string) {
    const claim = await this.claimRepo.findOne({
      where: { requestCode },
      relations: ['student', 'milestone'],
    });
    if (!claim) throw new NotFoundException('Mã đổi quà không tồn tại');

    const normalizedClaim = await this.normalizeClaimStatus(claim);

    return {
      id: normalizedClaim.id,
      requestCode: normalizedClaim.requestCode,
      status: normalizedClaim.status,
      requestedAt: normalizedClaim.requestedAt,
      expiresAt: normalizedClaim.expiresAt,
      claimedAt: normalizedClaim.claimedAt,
      student: {
        id: normalizedClaim.student.id,
        studentCode: normalizedClaim.student.studentCode,
        fullName: normalizedClaim.student.fullName,
      },
      milestone: {
        id: normalizedClaim.milestone.id,
        name: normalizedClaim.milestone.name,
        requiredBooths: normalizedClaim.milestone.requiredBooths,
      },
    };
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

  async redeemByRequestCode(
    dto: RedeemRewardCodeDto,
    confirmedByUserId: string,
  ) {
    const confirmedByUser = await this.userRepo.findOne({
      where: { id: confirmedByUserId },
    });
    if (!confirmedByUser) {
      throw new NotFoundException('Người xác nhận không tồn tại');
    }

    try {
      return await this.dataSource.transaction(async (manager) => {
        const claim = await manager
          .createQueryBuilder(RewardClaim, 'claim')
          // Reward claims must always reference a student and milestone.
          // Use inner joins here so Postgres row locking does not fail on
          // the nullable side of an outer join when applying FOR UPDATE.
          .innerJoinAndSelect('claim.student', 'student')
          .innerJoinAndSelect('claim.milestone', 'milestone')
          .setLock('pessimistic_write')
          .where('claim.requestCode = :requestCode', {
            requestCode: dto.requestCode,
          })
          .getOne();

        if (!claim) throw new NotFoundException('Mã đổi quà không tồn tại');

        if (
          claim.status === 'pending' &&
          claim.expiresAt &&
          claim.expiresAt.getTime() <= Date.now()
        ) {
          claim.status = 'expired';
          await manager.save(RewardClaim, claim);
        }

        if (claim.status === 'claimed') {
          return {
            result: 'already_claimed',
            message: 'Mã này đã được đổi quà trước đó',
            claim: {
              id: claim.id,
              requestCode: claim.requestCode,
              status: claim.status,
              requestedAt: claim.requestedAt,
              expiresAt: claim.expiresAt,
              claimedAt: claim.claimedAt,
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
            },
          };
        }

        if (claim.status === 'expired') {
          return {
            result: 'expired',
            message: 'Mã đổi quà đã hết hạn',
            claim: {
              id: claim.id,
              requestCode: claim.requestCode,
              status: claim.status,
              requestedAt: claim.requestedAt,
              expiresAt: claim.expiresAt,
              claimedAt: claim.claimedAt,
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
            },
          };
        }

        if (claim.status !== 'pending') {
          return {
            result: 'invalid_state',
            message: 'Mã đổi quà không còn hiệu lực',
            claim: {
              id: claim.id,
              requestCode: claim.requestCode,
              status: claim.status,
              requestedAt: claim.requestedAt,
              expiresAt: claim.expiresAt,
              claimedAt: claim.claimedAt,
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
            },
          };
        }

        claim.status = 'claimed';
        claim.claimedAt = new Date();
        claim.confirmedByUserId = confirmedByUser.id;
        const saved = await manager.save(RewardClaim, claim);

        return {
          result: 'claimed_now',
          message: 'Đổi quà thành công',
          claim: {
            id: saved.id,
            requestCode: saved.requestCode,
            status: saved.status,
            requestedAt: saved.requestedAt,
            expiresAt: saved.expiresAt,
            claimedAt: saved.claimedAt,
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
          },
        };
      });
    } catch (error) {
      this.logger.error(
        `redeemByRequestCode failed: requestCode=${dto.requestCode}, confirmedByUserId=${confirmedByUserId}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
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

  private async normalizeClaimStatus(claim: RewardClaim) {
    if (
      claim.status === 'pending' &&
      claim.expiresAt &&
      claim.expiresAt.getTime() <= Date.now()
    ) {
      claim.status = 'expired';
      return this.claimRepo.save(claim);
    }
    return claim;
  }
}
