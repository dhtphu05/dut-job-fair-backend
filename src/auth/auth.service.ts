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
import { AuthResponseDto, LoginDto, RegisterDto } from './dto/auth.dto';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AuthService {
    constructor(
        @InjectRepository(User)
        private readonly userRepo: Repository<User>,
        private readonly jwtService: JwtService,
        private readonly configService: ConfigService,
    ) { }

    // ── Register ────────────────────────────────────────────────────────────────
    async register(dto: RegisterDto): Promise<AuthResponseDto> {
        const exists = await this.userRepo.findOne({ where: { email: dto.email } });
        if (exists) throw new BadRequestException('Email đã được sử dụng');

        const passwordHash = await bcrypt.hash(dto.password, 10);
        const user = this.userRepo.create({
            email: dto.email,
            passwordHash,
            name: dto.name,
            role: dto.role,
        });
        await this.userRepo.save(user);

        return this.generateTokens(user);
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
        };
    }
}
