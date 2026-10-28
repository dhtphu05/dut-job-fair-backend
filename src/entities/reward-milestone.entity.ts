import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { RewardClaim } from './reward-claim.entity';

@Entity('reward_milestones')
export class RewardMilestone {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 255 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ name: 'required_booths', type: 'int' })
  requiredBooths: number;

  @Column({ name: 'requires_special_stamps', default: false })
  requiresSpecialStamps: boolean;

  @Column({ name: 'required_workshop_ids', type: 'uuid', array: true, nullable: true })
  requiredWorkshopIds: string[] | null;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @OneToMany(() => RewardClaim, (claim) => claim.milestone)
  claims: RewardClaim[];
}
