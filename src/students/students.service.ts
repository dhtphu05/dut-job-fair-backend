import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Student } from '../entities/student.entity';
import { CreateStudentDto, UpdateStudentDto } from './dto/student.dto';

@Injectable()
export class StudentsService {
    constructor(
        @InjectRepository(Student)
        private readonly repo: Repository<Student>,
    ) { }

    async findAll(page = 1, pageSize = 20, search?: string) {
        const qb = this.repo.createQueryBuilder('s').leftJoinAndSelect('s.school', 'school');
        if (search) {
            qb.where('s.fullName ILIKE :q OR s.studentCode ILIKE :q OR s.email ILIKE :q', { q: `%${search}%` });
        }
        const [items, total] = await qb
            .orderBy('s.createdAt', 'DESC')
            .skip((page - 1) * pageSize)
            .take(pageSize)
            .getManyAndCount();
        return { items, total, page, pageSize, hasMore: page * pageSize < total };
    }

    async findOne(id: string) {
        const student = await this.repo.findOne({ where: { id }, relations: ['school', 'checkins'] });
        if (!student) throw new NotFoundException('Sinh viên không tồn tại');
        return student;
    }

    async create(dto: CreateStudentDto) {
        const exists = await this.repo.findOne({ where: { studentCode: dto.studentCode } });
        if (exists) throw new ConflictException(`Mã sinh viên ${dto.studentCode} đã tồn tại`);
        return this.repo.save(this.repo.create(dto));
    }

    async update(id: string, dto: UpdateStudentDto) {
        const student = await this.findOne(id);
        Object.assign(student, dto);
        return this.repo.save(student);
    }

    async remove(id: string) {
        const student = await this.findOne(id);
        await this.repo.remove(student);
        return { message: 'Đã xóa sinh viên thành công' };
    }
}
