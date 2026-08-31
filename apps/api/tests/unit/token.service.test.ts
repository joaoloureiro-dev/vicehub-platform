import { describe, expect, it } from 'vitest';

import { createTokenService } from '../helpers/auth.fixtures.js';

const tokenService = createTokenService();

describe('TokenService', () => {
    describe('segredo do refresh token', () => {
        it('gera 64 bytes em hexadecimal', () => {
            expect(tokenService.generateRefreshTokenSecret()).toHaveLength(128);
        });

        it('nunca repete o segredo entre chamadas', () => {
            const secrets = new Set(
                Array.from({ length: 25 }, () =>
                    tokenService.generateRefreshTokenSecret(),
                ),
            );

            expect(secrets.size).toBe(25);
        });
    });

    describe('formato do refresh token', () => {
        it('faz round trip entre construção e leitura', () => {
            const token = tokenService.buildRefreshToken('refresh-1', 'segredo');

            expect(tokenService.parseRefreshToken(token)).toEqual({
                refreshTokenId: 'refresh-1',
                secret: 'segredo',
            });
        });

        it.each([
            ['string vazia', ''],
            ['null', null],
            ['undefined', undefined],
            ['sem separador', 'apenas-um-id'],
            ['sem segredo', 'refresh-1.'],
            ['sem identificador', '.segredo'],
            ['com partes a mais', 'refresh-1.segredo.extra'],
        ])('rejeita um token %s', (_label, token) => {
            expect(tokenService.parseRefreshToken(token)).toBeNull();
        });
    });

    describe('hash do segredo', () => {
        it('guarda um hash Argon2id e não o segredo', async () => {
            const secret = tokenService.generateRefreshTokenSecret();

            const hash = await tokenService.hashRefreshTokenSecret(secret);

            expect(hash).toMatch(/^\$argon2id\$/);
            expect(hash).not.toContain(secret);
        });

        it('confirma o segredo correto e recusa outro', async () => {
            const secret = tokenService.generateRefreshTokenSecret();
            const hash = await tokenService.hashRefreshTokenSecret(secret);

            await expect(
                tokenService.verifyRefreshTokenSecret(secret, hash),
            ).resolves.toBe(true);

            await expect(
                tokenService.verifyRefreshTokenSecret(
                    tokenService.generateRefreshTokenSecret(),
                    hash,
                ),
            ).resolves.toBe(false);
        });
    });
});
