import {
    Column,
    CreateDateColumn,
    Entity,
    OneToMany,
    PrimaryGeneratedColumn,
} from 'typeorm';
import { Student } from './student.entity';

@Entity('schools')
export class School {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ length: 255 })
    name: string;

    @Column({ length: 50, unique: true, nullable: true })
    code: string;

    @Column({ length: 255, nullable: true })
    address: string;

    @Column({ name: 'student_count', type: 'int', default: 0 })
    studentCount: number;

    @CreateDateColumn({ name: 'created_at' })
    createdAt: Date;

    // Relations
    @OneToMany(() => Student, (student) => student.school)
    students: Student[];
}
