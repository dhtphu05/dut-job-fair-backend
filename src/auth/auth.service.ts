import {
    BadRequestException,
    ForbiddenException,
    Injectable,
    UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcryptjs';
import { Repository } from 'typeorm';
import { User } from '../entities/user.entity';
import { Booth } from '../entities/booth.entity';
import { Business } from '../entities/business.entity';
import { AuthResponseDto, LoginDto, RegisterDto } from './dto/auth.dto';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AuthService {
    constructor(
        @InjectRepository(User)
        private readonly userRepo: Repository<User>,
        @InjectRepository(Booth)
        private readonly boothRepo: Repository<Booth>,
        @InjectRepository(Business)
        private readonly businessRepo: Repository<Business>,
        private readonly jwtService: JwtService,
        private readonly configService: ConfigService,
    ) { }

    // ── Register ────────────────────────────────────────────────────────────────
    async register(dto: RegisterDto): Promise<AuthResponseDto> {
        const exists = await this.userRepo.findOne({ where: { email: dto.email } });
        if (exists) throw new BadRequestException('Email đã được sử dụng');

        let boothId: string | null = null;

        if (dto.role === 'business_admin' && dto.businessId) {
            // Find booth(s) for this business
            const booths = await this.boothRepo.find({ where: { businessId: dto.businessId } });
            if (booths.length === 0)
                throw new BadRequestException('Doanh nghiệp chưa có gian hàng nào. Liên hệ Ban Tổ Chức.');

            // Enforce 1 account per business: check if any booth is already claimed
            for (const b of booths) {
                const taken = await this.userRepo.findOne({ where: { boothId: b.id } });
                if (taken) throw new BadRequestException('Doanh nghiệp này đã có tài khoản. Vui lòng đăng nhập.');
            }

            boothId = booths[0].id; // assign the first (usually only) booth
        }

        const passwordHash = await bcrypt.hash(dto.password, 10);
        const user = this.userRepo.create({
            email: dto.email,
            passwordHash,
            name: dto.name,
            role: dto.role,
            boothId,
        });
        await this.userRepo.save(user);

        return this.generateTokens(user);
    }

    // GET /auth/businesses – public list of businesses for registration form
    async getPublicBusinesses() {
        const businesses = await this.businessRepo.find({
            relations: ['booths'],
            order: { name: 'ASC' },
        });
        const result: { id: string; name: string; industry: string; registered: boolean }[] = [];
        for (const biz of businesses) {
            if (!biz.booths || biz.booths.length === 0) continue;
            // Check if any booth of this business is already claimed
            let registered = false;
            for (const b of biz.booths) {
                const user = await this.userRepo.findOne({ where: { boothId: b.id } });
                if (user) { registered = true; break; }
            }
            result.push({ id: biz.id, name: biz.name, industry: biz.industry, registered });
        }
        return result;
    }

    // ── Login ───────────────────────────────────────────────────────────────────
    async login(dto: LoginDto): Promise<AuthResponseDto> {
        const user = await this.userRepo.findOne({ where: { email: dto.email } });
        if (!user) throw new UnauthorizedException('Email hoặc mật khẩu không đúng');
        if (!user.isActive) throw new ForbiddenException('Tài khoản đã bị vô hiệu hóa');

        const isMatch = await bcrypt.compare(dto.password, user.passwordHash);
        if (!isMatch) throw new UnauthorizedException('Email hoặc mật khẩu không đúng');

        return this.generateTokens(user);
    }

    // ── Refresh Token ───────────────────────────────────────────────────────────
    async refreshTokens(userId: string, refreshToken: string): Promise<AuthResponseDto> {
        const user = await this.userRepo.findOne({ where: { id: userId } });
        if (!user || !user.refreshToken)
            throw new ForbiddenException('Không có quyền truy cập');

        const isValid = await bcrypt.compare(refreshToken, user.refreshToken);
        if (!isValid) throw new ForbiddenException('Refresh token không hợp lệ');

        return this.generateTokens(user);
    }

    // ── Logout ──────────────────────────────────────────────────────────────────
    async logout(userId: string): Promise<void> {
        await this.userRepo.update(userId, { refreshToken: null });
    }

    // ── Get profile ─────────────────────────────────────────────────────────────
    async getProfile(userId: string) {
        const user = await this.userRepo.findOne({ where: { id: userId } });
        if (!user) throw new UnauthorizedException();
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { passwordHash, refreshToken, ...profile } = user;
        return profile;
    }

    // ── Helpers ─────────────────────────────────────────────────────────────────
    private async generateTokens(user: User): Promise<AuthResponseDto> {
        const payload = { sub: user.id, email: user.email, role: user.role };

        const [accessToken, refreshToken] = await Promise.all([
            this.jwtService.signAsync(payload, {
                secret: this.configService.get<string>('JWT_SECRET'),
                expiresIn: (this.configService.get<string>('JWT_EXPIRES_IN') ?? '15m') as unknown as number,
            }),
            this.jwtService.signAsync(payload, {
                secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
                expiresIn: (this.configService.get<string>('JWT_REFRESH_EXPIRES_IN') ?? '7d') as unknown as number,
            }),
        ]);

        // Store hashed refresh token
        const hashedRefresh = await bcrypt.hash(refreshToken, 10);
        await this.userRepo.update(user.id, { refreshToken: hashedRefresh });

        return {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            accessToken,
            refreshToken,
            boothId: user.boothId,
        };
    }
}
