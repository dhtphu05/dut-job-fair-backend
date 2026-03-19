import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Student } from './student.entity';
import { Booth } from './booth.entity';

@Entity('checkins')
@Index('IDX_CHECKINS_BOOTH_TIME', ['boothId', 'checkInTime'])
@Index('IDX_CHECKINS_STUDENT_BOOTH_TIME', [
  'studentId',
  'boothId',
  'checkInTime',
])
@Index('IDX_CHECKINS_STUDENT_TIME', ['studentId', 'checkInTime'])
export class Checkin {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'student_id', type: 'uuid' })
  studentId: string;

  @Column({ name: 'booth_id', type: 'uuid' })
  boothId: string;

  @CreateDateColumn({ name: 'check_in_time' })
  checkInTime: Date;

  @Column({ name: 'duration_minutes', type: 'int', nullable: true })
  durationMinutes: number;

  @Column({
    type: 'enum',
    enum: ['active', 'completed'],
    default: 'active',
  })
  status: 'active' | 'completed';

  @Column({ type: 'text', nullable: true })
  notes: string;

  // Relations
  @ManyToOne(() => Student, (student) => student.checkins, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'student_id' })
  student: Student;

  @ManyToOne(() => Booth, (booth) => booth.checkins, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'booth_id' })
  booth: Booth;
}
