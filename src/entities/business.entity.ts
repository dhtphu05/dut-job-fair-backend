import {
    Column,
    CreateDateColumn,
    Entity,
    OneToMany,
    PrimaryGeneratedColumn,
} from 'typeorm';
import { Booth } from './booth.entity';

export enum BusinessType {
    BOOTH = 'booth',
    WORKSHOP = 'workshop',
}

@Entity('businesses')
export class Business {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ length: 255 })
    name: string;

    @Column({ name: 'public_id', type: 'varchar', length: 255, nullable: true })
    publicId: string | null;

    @Column({ name: 'logo_url', type: 'varchar', length: 500, nullable: true })
    logoUrl: string | null;

    @Column({ length: 100, nullable: true })
    industry: string;

    @Column({ length: 255, nullable: true })
    website: string;

    @Column({ type: 'text', nullable: true })
    description: string;

    @Column({
        type: 'enum',
        enum: BusinessType,
        default: BusinessType.BOOTH,
    })
    type: BusinessType;

    @CreateDateColumn({ name: 'created_at' })
    createdAt: Date;

    // Relations
    @OneToMany(() => Booth, (booth) => booth.business)
    booths: Booth[];
}
