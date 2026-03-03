import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Request } from 'express';

@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(Strategy, 'jwt-refresh') {
    constructor(configService: ConfigService) {
        super({
            jwtFromRequest: ExtractJwt.fromBodyField('refreshToken'),
            ignoreExpiration: false,
            secretOrKey: configService.get<string>('JWT_REFRESH_SECRET') as string,
            passReqToCallback: true as true,
        });
    }

    async validate(req: Request, payload: { sub: string; email: string; role: string }) {
        const refreshToken = (req.body as { refreshToken: string })?.refreshToken;
        return { id: payload.sub, email: payload.email, role: payload.role, refreshToken };
    }
}
