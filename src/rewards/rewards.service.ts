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
  RewardMilestoneStudentsQueryDto,
  UpdateRewardMilestoneDto,
} from './dto/reward.dto';

type RewardMilestoneStudentStatus =
  | 'eligible'
  | 'pending'
  | 'claimed'
  | 'expired'
  | 'cancelled'
  | 'locked';

type RewardMilestoneStudentRow = {
  student_id: string;
  student_code: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  major: string | null;
  department: string | null;
  class_name: string | null;
  year: number | null;
  school_name: string | null;
  checked_in_booths: string | number;
  derived_status: RewardMilestoneStudentStatus;
  claim_id: string | null;
  claim_request_code: string | null;
  claim_status: RewardClaim['status'] | null;
  claim_requested_at: Date | string | null;
  claim_expires_at: Date | string | null;
  claim_claimed_at: Date | string | null;
  claim_confirmed_by_user_id: string | null;
  confirmed_by_id: string | null;
  confirmed_by_name: string | null;
  confirmed_by_email: string | null;
};

type RewardMilestoneSummaryRow = {
  total_eligible: string | number;
  total_pending: string | number;
  total_claimed: string | number;
  total_expired: string | number;
  total_cancelled: string | number;
};

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
      throw new NotFoundException('Không tìm thấy sinh viên với MSSV này');
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
          `Bạn chưa đủ điều kiện nhận quà này. Cần tối thiểu ${milestone.requiredBooths} booth check-in.`,
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
        throw new BadRequestException(
          'Bạn đã nhận quà ở mốc này rồi. Vui lòng kiểm tra lại tiến trình nhận quà.',
        );
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

  async getMilestoneStudents(
    milestoneId: string,
    query: RewardMilestoneStudentsQueryDto,
  ) {
    const milestone = await this.milestoneRepo.findOne({
      where: { id: milestoneId },
    });
    if (!milestone) throw new NotFoundException('Mốc quà không tồn tại');

    const statusFilter = query.status ?? 'all';
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const search = query.search?.trim() ?? '';

    await this.expirePendingClaimsForMilestone(milestoneId);

    const baseParams = [milestoneId, milestone.requiredBooths] as Array<
      string | number
    >;
    const { clause: filterClause, params: filterParams } =
      this.buildMilestoneStudentsFilterClause(statusFilter, search, baseParams);

    const dataQuery = `
      WITH booth_counts AS (
        SELECT c.student_id, COUNT(DISTINCT c.booth_id)::int AS checked_in_booths
        FROM checkins c
        GROUP BY c.student_id
      ),
      latest_claims AS (
        SELECT DISTINCT ON (rc.student_id)
          rc.id,
          rc.student_id,
          rc.status,
          rc.request_code,
          rc.requested_at,
          rc.expires_at,
          rc.claimed_at,
          rc.confirmed_by_user_id
        FROM reward_claims rc
        WHERE rc.milestone_id = $1
        ORDER BY rc.student_id, rc.requested_at DESC, rc.updated_at DESC, rc.id DESC
      ),
      classified AS (
        SELECT
          s.id AS student_id,
          s.student_code,
          s.full_name,
          s.email,
          s.phone,
          s.major,
          s.department,
          s.class_name,
          s.year,
          sch.name AS school_name,
          COALESCE(bc.checked_in_booths, 0) AS checked_in_booths,
          lc.id AS claim_id,
          lc.request_code AS claim_request_code,
          lc.status AS claim_status,
          lc.requested_at AS claim_requested_at,
          lc.expires_at AS claim_expires_at,
          lc.claimed_at AS claim_claimed_at,
          lc.confirmed_by_user_id AS claim_confirmed_by_user_id,
          u.id AS confirmed_by_id,
          u.name AS confirmed_by_name,
          u.email AS confirmed_by_email,
          CASE
            WHEN lc.status = 'claimed' THEN 'claimed'
            WHEN lc.status = 'pending' AND lc.expires_at IS NOT NULL AND lc.expires_at <= NOW() THEN 'expired'
            WHEN lc.status = 'pending' THEN 'pending'
            WHEN lc.status = 'expired' THEN 'expired'
            WHEN lc.status = 'cancelled' THEN 'cancelled'
            WHEN COALESCE(bc.checked_in_booths, 0) >= $2 THEN 'eligible'
            ELSE 'locked'
          END AS derived_status
        FROM students s
        LEFT JOIN schools sch ON sch.id = s.school_id
        LEFT JOIN booth_counts bc ON bc.student_id = s.id
        LEFT JOIN latest_claims lc ON lc.student_id = s.id
        LEFT JOIN users u ON u.id = lc.confirmed_by_user_id
      )
      SELECT *
      FROM classified
      ${filterClause}
      ORDER BY
        CASE WHEN claim_requested_at IS NULL THEN 1 ELSE 0 END ASC,
        claim_requested_at DESC,
        student_code ASC
      LIMIT $${filterParams.length + 1}
      OFFSET $${filterParams.length + 2}
    `;

    const totalQuery = `
      WITH booth_counts AS (
        SELECT c.student_id, COUNT(DISTINCT c.booth_id)::int AS checked_in_booths
        FROM checkins c
        GROUP BY c.student_id
      ),
      latest_claims AS (
        SELECT DISTINCT ON (rc.student_id)
          rc.id,
          rc.student_id,
          rc.status,
          rc.request_code,
          rc.requested_at,
          rc.expires_at,
          rc.claimed_at,
          rc.confirmed_by_user_id
        FROM reward_claims rc
        WHERE rc.milestone_id = $1
        ORDER BY rc.student_id, rc.requested_at DESC, rc.updated_at DESC, rc.id DESC
      ),
      classified AS (
        SELECT
          s.id AS student_id,
          s.student_code,
          s.full_name,
          COALESCE(bc.checked_in_booths, 0) AS checked_in_booths,
          CASE
            WHEN lc.status = 'claimed' THEN 'claimed'
            WHEN lc.status = 'pending' AND lc.expires_at IS NOT NULL AND lc.expires_at <= NOW() THEN 'expired'
            WHEN lc.status = 'pending' THEN 'pending'
            WHEN lc.status = 'expired' THEN 'expired'
            WHEN lc.status = 'cancelled' THEN 'cancelled'
            WHEN COALESCE(bc.checked_in_booths, 0) >= $2 THEN 'eligible'
            ELSE 'locked'
          END AS derived_status
        FROM students s
        LEFT JOIN booth_counts bc ON bc.student_id = s.id
        LEFT JOIN latest_claims lc ON lc.student_id = s.id
      )
      SELECT COUNT(*)::int AS total
      FROM classified
      ${filterClause}
    `;

    const summaryQuery = `
      WITH booth_counts AS (
        SELECT c.student_id, COUNT(DISTINCT c.booth_id)::int AS checked_in_booths
        FROM checkins c
        GROUP BY c.student_id
      ),
      latest_claims AS (
        SELECT DISTINCT ON (rc.student_id)
          rc.student_id,
          rc.status,
          rc.expires_at
        FROM reward_claims rc
        WHERE rc.milestone_id = $1
        ORDER BY rc.student_id, rc.requested_at DESC, rc.updated_at DESC, rc.id DESC
      ),
      classified AS (
        SELECT
          CASE
            WHEN lc.status = 'claimed' THEN 'claimed'
            WHEN lc.status = 'pending' AND lc.expires_at IS NOT NULL AND lc.expires_at <= NOW() THEN 'expired'
            WHEN lc.status = 'pending' THEN 'pending'
            WHEN lc.status = 'expired' THEN 'expired'
            WHEN lc.status = 'cancelled' THEN 'cancelled'
            WHEN COALESCE(bc.checked_in_booths, 0) >= $2 THEN 'eligible'
            ELSE 'locked'
          END AS derived_status
        FROM students s
        LEFT JOIN booth_counts bc ON bc.student_id = s.id
        LEFT JOIN latest_claims lc ON lc.student_id = s.id
      )
      SELECT
        COUNT(*) FILTER (WHERE derived_status = 'eligible')::int AS total_eligible,
        COUNT(*) FILTER (WHERE derived_status = 'pending')::int AS total_pending,
        COUNT(*) FILTER (WHERE derived_status = 'claimed')::int AS total_claimed,
        COUNT(*) FILTER (WHERE derived_status = 'expired')::int AS total_expired,
        COUNT(*) FILTER (WHERE derived_status = 'cancelled')::int AS total_cancelled
      FROM classified
      WHERE derived_status <> 'locked'
    `;

    const [rows, totalRows, summaryRows] = (await Promise.all([
      this.dataSource.query(dataQuery, [
        ...filterParams,
        pageSize,
        (page - 1) * pageSize,
      ]),
      this.dataSource.query(totalQuery, filterParams),
      this.dataSource.query(summaryQuery, baseParams),
    ])) as [
      RewardMilestoneStudentRow[],
      Array<{ total: string | number }>,
      RewardMilestoneSummaryRow[],
    ];

    const total = Number(totalRows[0]?.total ?? 0);
    const summary = summaryRows[0];

    return {
      milestone: {
        id: milestone.id,
        name: milestone.name,
        requiredBooths: milestone.requiredBooths,
        description: milestone.description,
        isActive: milestone.isActive,
      },
      summary: {
        totalEligible: Number(summary?.total_eligible ?? 0),
        totalPending: Number(summary?.total_pending ?? 0),
        totalClaimed: Number(summary?.total_claimed ?? 0),
        totalExpired: Number(summary?.total_expired ?? 0),
        totalCancelled: Number(summary?.total_cancelled ?? 0),
      },
      filter: {
        status: statusFilter,
        search: search ? search : null,
      },
      items: rows.map((row) =>
        this.mapMilestoneStudentRowToItem(row, milestone.requiredBooths),
      ),
      total,
      page,
      pageSize,
      hasMore: page * pageSize < total,
    };
  }

  private generateRequestCode() {
    return `RW-${randomBytes(4).toString('hex').toUpperCase()}`;
  }

  private async expirePendingClaimsForMilestone(milestoneId: string) {
    const now = new Date();
    await this.claimRepo
      .createQueryBuilder()
      .update(RewardClaim)
      .set({ status: 'expired' })
      .where('milestoneId = :milestoneId', { milestoneId })
      .andWhere('status = :status', { status: 'pending' })
      .andWhere('expiresAt IS NOT NULL')
      .andWhere('expiresAt <= :now', { now })
      .execute();
  }

  private buildMilestoneStudentsFilterClause(
    statusFilter: Exclude<RewardMilestoneStudentsQueryDto['status'], undefined>,
    search: string,
    baseParams: Array<string | number>,
  ) {
    const conditions = [`derived_status <> 'locked'`];
    const params = [...baseParams];

    if (statusFilter !== 'all') {
      params.push(statusFilter);
      conditions.push(`derived_status = $${params.length}`);
    }

    if (search) {
      params.push(`%${search.toLowerCase()}%`);
      conditions.push(
        `(LOWER(student_code) LIKE $${params.length} OR LOWER(full_name) LIKE $${params.length})`,
      );
    }

    return {
      clause: `WHERE ${conditions.join(' AND ')}`,
      params,
    };
  }

  private mapMilestoneStudentRowToItem(
    row: RewardMilestoneStudentRow,
    requiredBooths: number,
  ) {
    const checkedInBooths = Number(row.checked_in_booths ?? 0);
    const eligible = checkedInBooths >= requiredBooths;
    const status = row.derived_status === 'locked' ? 'eligible' : row.derived_status;

    return {
      student: {
        id: row.student_id,
        studentCode: row.student_code,
        fullName: row.full_name,
        email: row.email,
        phone: row.phone,
        major: row.major,
        department: row.department,
        className: row.class_name,
        year: row.year,
        school: row.school_name,
      },
      checkedInBooths,
      requiredBooths,
      remainingBooths:
        checkedInBooths >= requiredBooths ? 0 : requiredBooths - checkedInBooths,
      eligible,
      status,
      claim:
        status === 'eligible' || !row.claim_id
          ? null
          : {
              id: row.claim_id,
              requestCode: row.claim_request_code,
              status,
              requestedAt: row.claim_requested_at,
              expiresAt: row.claim_expires_at,
              claimedAt: row.claim_claimed_at,
              confirmedByUserId: row.claim_confirmed_by_user_id,
              confirmedBy: row.confirmed_by_id
                ? {
                    id: row.confirmed_by_id,
                    name: row.confirmed_by_name,
                    email: row.confirmed_by_email,
                  }
                : null,
            },
    };
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
