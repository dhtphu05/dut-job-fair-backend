import {
    Column,
    CreateDateColumn,
    Entity,
    JoinColumn,
    ManyToOne,
    PrimaryGeneratedColumn,
} from 'typeorm';
import { Booth } from './booth.entity';

export enum JobLevel {
    ENTRY = 'entry',
    JUNIOR = 'junior',
    MID = 'mid',
    SENIOR = 'senior',
}

@Entity('job_positions')
export class JobPosition {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ name: 'booth_id', type: 'uuid' })
    boothId: string;

    @Column({ length: 255 })
    title: string;

    @Column({ type: 'text', nullable: true })
    description: string;

    @Column({ type: 'simple-array', nullable: true })
    requirements: string[];

    @Column({ type: 'int', default: 1 })
    quantity: number;

    @Column({ type: 'enum', enum: JobLevel, default: JobLevel.ENTRY })
    level: JobLevel;

    @Column({ name: 'salary_min', type: 'int', nullable: true })
    salaryMin: number;

    @Column({ name: 'salary_max', type: 'int', nullable: true })
    salaryMax: number;

    @Column({ name: 'salary_currency', length: 10, default: 'VND' })
    salaryCurrency: string;

    @CreateDateColumn({ name: 'created_at' })
    createdAt: Date;

    // Relations
    @ManyToOne(() => Booth, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'booth_id' })
    booth: Booth;
}
