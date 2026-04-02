import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsIn,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';

export class CreateRewardMilestoneDto {
  @ApiProperty({ example: 'Moc khoa DUT Job Fair' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({
    example: 'Qua tang cho sinh vien check-in du 3 booth',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ example: 3 })
  @IsInt()
  @Min(1)
  requiredBooths: number;

  @ApiPropertyOptional({ example: 1, default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @ApiPropertyOptional({ example: true, default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateRewardMilestoneDto {
  @ApiPropertyOptional({ example: 'Ao thun DUT Job Fair' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @ApiPropertyOptional({
    example: 'Qua tang cho sinh vien check-in du 5 booth',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: 5 })
  @IsOptional()
  @IsInt()
  @Min(1)
  requiredBooths?: number;

  @ApiPropertyOptional({ example: 2 })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class CreateRewardClaimRequestDto {
  @ApiProperty({ example: '102230313' })
  @IsString()
  @IsNotEmpty()
  studentCode: string;

  @ApiProperty({ example: 'uuid-of-milestone' })
  @IsUUID('4')
  milestoneId: string;
}

export class RedeemRewardCodeDto {
  @ApiProperty({ example: 'RW-AB12CD34' })
  @IsString()
  @IsNotEmpty()
  requestCode: string;
}

export class RewardMilestoneStudentsQueryDto {
  @ApiPropertyOptional({
    example: 'all',
    enum: ['all', 'eligible', 'pending', 'claimed', 'expired', 'cancelled'],
  })
  @IsOptional()
  @IsString()
  @IsIn(['all', 'eligible', 'pending', 'claimed', 'expired', 'cancelled'])
  status?: 'all' | 'eligible' | 'pending' | 'claimed' | 'expired' | 'cancelled';

  @ApiPropertyOptional({ example: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ example: 20, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pageSize?: number;

  @ApiPropertyOptional({
    example: '102280313',
    description: 'Tìm theo MSSV hoặc họ tên',
  })
  @IsOptional()
  @IsString()
  search?: string;
}
