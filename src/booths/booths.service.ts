import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Booth, BoothType } from '../entities/booth.entity';
import { CreateBoothDto, UpdateBoothDto } from './dto/booth.dto';

@Injectable()
export class BoothsService {
    constructor(@InjectRepository(Booth) private readonly repo: Repository<Booth>) { }

    findAll(businessId?: string, type?: BoothType) {
        const where = {
            ...(businessId ? { businessId } : {}),
            ...(type ? { type } : {}),
        };
        return this.repo.find({ where, relations: ['business'], order: { createdAt: 'ASC' } });
    }

    async findOne(id: string) {
        const booth = await this.repo.findOne({ where: { id }, relations: ['business', 'checkins'] });
        if (!booth) throw new NotFoundException('Gian hàng không tồn tại');
        return booth;
    }

    async create(dto: CreateBoothDto) {
        const qrCode = `BOOTH-${dto.businessId.slice(0, 8)}-${Date.now()}`;
        return this.repo.save(this.repo.create({ ...dto, qrCode }));
    }

    async update(id: string, dto: UpdateBoothDto) {
        const booth = await this.repo.findOne({ where: { id } });
        if (!booth) throw new NotFoundException('Gian hàng không tồn tại');
        Object.assign(booth, dto);
        return this.repo.save(booth);
    }

    async remove(id: string) {
        const booth = await this.repo.findOne({ where: { id } });
        if (!booth) throw new NotFoundException('Gian hàng không tồn tại');
        await this.repo.remove(booth);
        return { message: 'Đã xóa gian hàng thành công' };
    }
}
