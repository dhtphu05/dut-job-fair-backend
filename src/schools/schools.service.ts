import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { School } from '../entities/school.entity';
import { CreateSchoolDto, UpdateSchoolDto } from './dto/school.dto';

@Injectable()
export class SchoolsService {
    constructor(@InjectRepository(School) private readonly repo: Repository<School>) { }

    findAll() {
        return this.repo.find({ order: { name: 'ASC' } });
    }

    async findOne(id: string) {
        const school = await this.repo.findOne({ where: { id }, relations: ['students'] });
        if (!school) throw new NotFoundException('Trường không tồn tại');
        return school;
    }

    create(dto: CreateSchoolDto) {
        return this.repo.save(this.repo.create(dto));
    }

    async update(id: string, dto: UpdateSchoolDto) {
        const school = await this.repo.findOne({ where: { id } });
        if (!school) throw new NotFoundException('Trường không tồn tại');
        Object.assign(school, dto);
        return this.repo.save(school);
    }

    async remove(id: string) {
        const school = await this.repo.findOne({ where: { id } });
        if (!school) throw new NotFoundException('Trường không tồn tại');
        await this.repo.remove(school);
        return { message: 'Đã xóa trường thành công' };
    }
}
