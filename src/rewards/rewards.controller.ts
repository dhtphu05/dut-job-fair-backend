import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../entities/user.entity';
import {
  CreateRewardClaimRequestDto,
  CreateRewardMilestoneDto,
  RedeemRewardCodeDto,
  UpdateRewardMilestoneDto,
} from './dto/reward.dto';
import { RewardsService } from './rewards.service';

@ApiTags('rewards')
@Controller('rewards')
export class RewardsController {
  constructor(private readonly rewardsService: RewardsService) {}

  @ApiOperation({ summary: 'Tiến độ nhận quà của sinh viên theo MSSV' })
  @Get('public/progress/:studentCode')
  getStudentRewardProgress(@Param('studentCode') studentCode: string) {
    return this.rewardsService.getStudentRewardProgress(studentCode);
  }

  @ApiOperation({
    summary:
      'Trạng thái nhận quà hiện tại của sinh viên theo MSSV cho frontend progress bar',
  })
  @Get('public/student-status/:studentCode')
  getStudentRewardStatus(@Param('studentCode') studentCode: string) {
    return this.rewardsService.getStudentRewardStatus(studentCode);
  }

  @ApiOperation({ summary: 'Sinh viên tạo yêu cầu nhận quà' })
  @Post('public/claim-request')
  createClaimRequest(@Body() dto: CreateRewardClaimRequestDto) {
    return this.rewardsService.createClaimRequest(dto);
  }

  @ApiOperation({ summary: 'Tra cứu trạng thái mã đổi quà theo request code' })
  @Get('public/claim-status/:requestCode')
  getClaimStatus(@Param('requestCode') requestCode: string) {
    return this.rewardsService.getClaimByRequestCode(requestCode);
  }

  @ApiOperation({ summary: 'Danh sách mốc quà' })
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SCHOOL_ADMIN, UserRole.SYSTEM_ADMIN)
  @Get('milestones')
  getMilestones() {
    return this.rewardsService.getMilestones(true);
  }

  @ApiOperation({ summary: 'Tạo mốc quà mới' })
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SCHOOL_ADMIN, UserRole.SYSTEM_ADMIN)
  @Post('milestones')
  createMilestone(@Body() dto: CreateRewardMilestoneDto) {
    return this.rewardsService.createMilestone(dto);
  }

  @ApiOperation({ summary: 'Cập nhật mốc quà' })
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SCHOOL_ADMIN, UserRole.SYSTEM_ADMIN)
  @Patch('milestones/:id')
  updateMilestone(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateRewardMilestoneDto,
  ) {
    return this.rewardsService.updateMilestone(id, dto);
  }

  @ApiOperation({ summary: 'Danh sách yêu cầu nhận quà đang chờ xác nhận' })
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SCHOOL_ADMIN, UserRole.SYSTEM_ADMIN)
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'pageSize', required: false, example: 20 })
  @Get('claims/pending')
  getPendingClaims(@Query('page') p?: string, @Query('pageSize') ps?: string) {
    return this.rewardsService.getPendingClaims(p ? +p : 1, ps ? +ps : 20);
  }

  @ApiOperation({ summary: 'Xác nhận sinh viên đã nhận quà' })
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SCHOOL_ADMIN, UserRole.SYSTEM_ADMIN)
  @Post('claims/:claimId/confirm')
  confirmClaim(
    @Param('claimId', ParseUUIDPipe) claimId: string,
    @Request() req: { user: { id: string } },
  ) {
    return this.rewardsService.confirmClaim(claimId, req.user.id);
  }

  @ApiOperation({
    summary: 'Quầy quà redeem mã đổi quà one-time theo request code',
  })
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SCHOOL_ADMIN, UserRole.SYSTEM_ADMIN)
  @Post('redeem')
  redeemByRequestCode(
    @Body() dto: RedeemRewardCodeDto,
    @Request() req: { user: { id: string } },
  ) {
    return this.rewardsService.redeemByRequestCode(dto, req.user.id);
  }
}
