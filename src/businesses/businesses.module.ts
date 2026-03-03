import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Business } from '../entities/business.entity';
import { BusinessesController } from './businesses.controller';
import { BusinessesService } from './businesses.service';

@Module({
    imports: [TypeOrmModule.forFeature([Business])],
    providers: [BusinessesService],
    controllers: [BusinessesController],
    exports: [BusinessesService],
})
export class BusinessesModule { }
