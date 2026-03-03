import {
    Column,
    CreateDateColumn,
    Entity,
    PrimaryGeneratedColumn,
    UpdateDateColumn,
} from 'typeorm';

export enum UserRole {
    STUDENT = 'student',
    BOOTH_STAFF = 'booth_staff',
    BUSINESS_ADMIN = 'business_admin',
    SCHOOL_ADMIN = 'school_admin',
    SYSTEM_ADMIN = 'system_admin',
}

@Entity('users')
export class User {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ length: 255, unique: true })
    email: string;

    @Column({ name: 'password_hash', length: 255 })
    passwordHash: string;

    @Column({ length: 255 })
    name: string;

    @Column({
        type: 'enum',
        enum: UserRole,
        default: UserRole.STUDENT,
    })
    role: UserRole;

    @Column({ name: 'refresh_token', type: 'text', nullable: true })
    refreshToken: string | null;

    @Column({ name: 'is_active', default: true })
    isActive: boolean;

    @CreateDateColumn({ name: 'created_at' })
    createdAt: Date;

    @UpdateDateColumn({ name: 'updated_at' })
    updatedAt: Date;
}
