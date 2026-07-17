import crypto from 'node:crypto';

import type { FastifyInstance } from 'fastify';
import argon2 from 'argon2';

import { env } from '../../../config/env.js';
import type { AccessTokenPayload } from '../types/auth.types.js';


/**
 * Serviço responsável pela criação e validação
 * dos tokens de autenticação.
 */
export class TokenService {
    constructor(
        private readonly app: FastifyInstance,
    ) { }


    /**
     * Cria Access Token JWT.
     *
     * Este token é curto:
     * 15 minutos por configuração.
     */
    async createAccessToken(
        payload: AccessTokenPayload,
    ): Promise<string> {
        return this.app.jwt.sign(payload, {
            expiresIn: `${env.JWT_ACCESS_TOKEN_TTL_SECONDS}s`,
        });
    }


    /**
     * Gera um refresh token aleatório.
     *
     * O valor original nunca é guardado.
     */
    generateRefreshToken(): string {
        return crypto
            .randomBytes(64)
            .toString('hex');
    }


    /**
     * Cria hash do refresh token
     * antes de guardar na base de dados.
     */
    async hashRefreshToken(
        token: string,
    ): Promise<string> {
        return argon2.hash(token, {
            type: argon2.argon2id,
        });
    }


    /**
     * Compara um refresh token recebido
     * com o hash existente na base de dados.
     */
    async verifyRefreshToken(
        token: string,
        hash: string,
    ): Promise<boolean> {
        return argon2.verify(hash, token);
    }
}