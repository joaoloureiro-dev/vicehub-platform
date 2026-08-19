import crypto from 'node:crypto';

import type { FastifyInstance } from 'fastify';
import argon2 from 'argon2';

import { env } from '../../../config/env.js';
import type { AccessTokenPayload } from '../types/auth.types.js';

interface ParsedRefreshToken {
    refreshTokenId: string;
    secret: string;
}

/**
 * Serviço responsável pela criação e validação
 * dos tokens de autenticação.
 */
export class TokenService {
    constructor(private readonly app: FastifyInstance) { }

    /**
     * Cria Access Token JWT.
     *
     * Este token é curto:
     * 15 minutos por configuração.
     */
    async createAccessToken(payload: AccessTokenPayload): Promise<string> {
        return this.app.jwt.sign(payload, {
            expiresIn: `${env.JWT_ACCESS_TOKEN_TTL_SECONDS}s`,
        });
    }

    /**
     * Gera o segredo privado do refresh token.
     *
     * Este valor nunca é guardado em texto simples.
     */
    generateRefreshTokenSecret(): string {
        return crypto.randomBytes(64).toString('hex');
    }

    /**
     * Junta o ID público do token com o segredo privado.
     *
     * Formato:
     * refreshTokenId.secret
     */
    buildRefreshToken(refreshTokenId: string, secret: string): string {
        return `${refreshTokenId}.${secret}`;
    }

    /**
     * Separa o refresh token recebido pelo cliente.
     */
    parseRefreshToken(token: string | null | undefined): ParsedRefreshToken | null {
        if (!token) {
            return null;
        }

        const [refreshTokenId, secret, ...extraParts] = token.split('.');

        if (!refreshTokenId || !secret || extraParts.length > 0) {
            return null;
        }

        return { refreshTokenId, secret };
    }

    /**
     * Cria hash do refresh token secret
     * antes de guardar na base de dados.
     */
    async hashRefreshTokenSecret(secret: string): Promise<string> {
        return argon2.hash(secret, {
            type: argon2.argon2id,
        });
    }

    /**
     * Compara um refresh token secret recebido
     * com o hash existente na base de dados.
     */
    async verifyRefreshTokenSecret(
        secret: string,
        hash: string,
    ): Promise<boolean> {
        return argon2.verify(hash, secret);
    }
}