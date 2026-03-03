import {
    Column,
    CreateDateColumn,
    Entity,
    OneToMany,
    PrimaryGeneratedColumn,
} from 'typeorm';
import { Booth } from './booth.entity';

@Entity('businesses')
export class Business {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ length: 255 })
    name: string;

    @Column({ length: 100, nullable: true })
    industry: string;

    @Column({ length: 255, nullable: true })
    website: string;

    @Column({ type: 'text', nullable: true })
    description: string;

    @CreateDateColumn({ name: 'created_at' })
    createdAt: Date;

    // Relations
    @OneToMany(() => Booth, (booth) => booth.business)
    booths: Booth[];
}
