import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Business } from '../entities/business.entity';
import { CreateBusinessDto, UpdateBusinessDto } from './dto/business.dto';

@Injectable()
export class BusinessesService {
    constructor(@InjectRepository(Business) private readonly repo: Repository<Business>) { }

    findAll(page = 1, pageSize = 20) {
        return this.repo.find({ order: { name: 'ASC' }, skip: (page - 1) * pageSize, take: pageSize });
    }

    async findOne(id: string) {
        const biz = await this.repo.findOne({ where: { id }, relations: ['booths'] });
        if (!biz) throw new NotFoundException('Doanh nghiệp không tồn tại');
        return biz;
    }

    create(dto: CreateBusinessDto) {
        return this.repo.save(this.repo.create(dto));
    }

    async update(id: string, dto: UpdateBusinessDto) {
        const biz = await this.repo.findOne({ where: { id } });
        if (!biz) throw new NotFoundException('Doanh nghiệp không tồn tại');
        Object.assign(biz, dto);
        return this.repo.save(biz);
    }

    async remove(id: string) {
        const biz = await this.repo.findOne({ where: { id } });
        if (!biz) throw new NotFoundException('Doanh nghiệp không tồn tại');
        await this.repo.remove(biz);
        return { message: 'Đã xóa doanh nghiệp thành công' };
    }
}
