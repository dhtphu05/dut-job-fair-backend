import {
    Column,
    CreateDateColumn,
    Entity,
    JoinColumn,
    ManyToOne,
    OneToMany,
    PrimaryGeneratedColumn,
    UpdateDateColumn,
} from 'typeorm';
import { School } from './school.entity';
import { Checkin } from './checkin.entity';

@Entity('students')
export class Student {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ name: 'school_id', type: 'uuid', nullable: true })
    schoolId: string;

    @Column({ name: 'student_code', length: 50, unique: true })
    studentCode: string; // Mã sinh viên (MSSV)

    @Column({ name: 'full_name', length: 255 })
    fullName: string;

    @Column({ type: 'varchar', length: 255, unique: true, nullable: true })
    email: string | null;

    @Column({ type: 'varchar', length: 20, nullable: true })
    phone: string | null;

    @Column({ type: 'varchar', length: 100, nullable: true })
    major: string;

    @Column({ type: 'varchar', length: 100, nullable: true })
    department: string; // Khoa

    @Column({ name: 'class_name', type: 'varchar', length: 50, nullable: true })
    className: string; // Lớp (e.g. 23DT3)

    @Column({ type: 'int', nullable: true })
    year: number; // 1–4

    @Column({ type: 'float', nullable: true })
    gpa: number;

    @CreateDateColumn({ name: 'created_at' })
    createdAt: Date;

    @UpdateDateColumn({ name: 'updated_at' })
    updatedAt: Date;

    // Relations
    @ManyToOne(() => School, (school) => school.students, { onDelete: 'SET NULL', nullable: true })
    @JoinColumn({ name: 'school_id' })
    school: School;

    @OneToMany(() => Checkin, (checkin) => checkin.student)
    checkins: Checkin[];
}
