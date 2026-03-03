import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Booth } from '../entities/booth.entity';
import { BoothsController } from './booths.controller';
import { BoothsService } from './booths.service';

@Module({
    imports: [TypeOrmModule.forFeature([Booth])],
    providers: [BoothsService],
    controllers: [BoothsController],
    exports: [BoothsService],
})
export class BoothsModule { }
