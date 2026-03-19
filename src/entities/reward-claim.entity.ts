import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { RewardMilestone } from './reward-milestone.entity';
import { Student } from './student.entity';
import { User } from './user.entity';

export type RewardClaimStatus = 'pending' | 'claimed' | 'expired' | 'cancelled';

@Entity('reward_claims')
@Index('IDX_REWARD_CLAIMS_STUDENT_STATUS', ['studentId', 'status'])
@Index('IDX_REWARD_CLAIMS_REQUEST_CODE', ['requestCode'], { unique: true })
export class RewardClaim {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'student_id', type: 'uuid' })
  studentId: string;

  @Column({ name: 'milestone_id', type: 'uuid' })
  milestoneId: string;

  @Column({
    type: 'enum',
    enum: ['pending', 'claimed', 'expired', 'cancelled'],
    default: 'pending',
  })
  status: RewardClaimStatus;

  @Column({ name: 'request_code', length: 50 })
  requestCode: string;

  @Column({ name: 'confirmed_by_user_id', type: 'uuid', nullable: true })
  confirmedByUserId: string | null;

  @CreateDateColumn({ name: 'requested_at' })
  requestedAt: Date;

  @Column({ name: 'expires_at', type: 'timestamp', nullable: true })
  expiresAt: Date | null;

  @Column({ name: 'claimed_at', type: 'timestamp', nullable: true })
  claimedAt: Date | null;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @ManyToOne(() => Student, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'student_id' })
  student: Student;

  @ManyToOne(() => RewardMilestone, (milestone) => milestone.claims, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'milestone_id' })
  milestone: RewardMilestone;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'confirmed_by_user_id' })
  confirmedByUser: User | null;
}
