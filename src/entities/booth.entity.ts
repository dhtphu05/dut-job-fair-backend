import {
    Column,
    CreateDateColumn,
    Entity,
    JoinColumn,
    ManyToOne,
    OneToMany,
    PrimaryGeneratedColumn,
} from 'typeorm';
import { Business } from './business.entity';
import { Checkin } from './checkin.entity';

@Entity('booths')
export class Booth {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ name: 'business_id', type: 'uuid' })
    businessId: string;

    @Column({ length: 255 })
    name: string;

    @Column({ length: 100, nullable: true })
    location: string;

    @Column({ type: 'int', default: 0 })
    capacity: number;

    @Column({ name: 'qr_code', length: 255, unique: true, nullable: true })
    qrCode: string;

    @CreateDateColumn({ name: 'created_at' })
    createdAt: Date;

    // Relations
    @ManyToOne(() => Business, (business) => business.booths, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'business_id' })
    business: Business;

    @OneToMany(() => Checkin, (checkin) => checkin.booth)
    checkins: Checkin[];
}
