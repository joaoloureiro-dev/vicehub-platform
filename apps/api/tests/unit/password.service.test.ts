import { describe, expect, it } from 'vitest';

import { PasswordService } from '../../src/modules/auth/services/password.service.js';

const passwordService = new PasswordService();

describe('PasswordService', () => {
    it('produz um hash Argon2id que não contém a password', async () => {
        const hash = await passwordService.hash('password-forte-123');

        expect(hash).toMatch(/^\$argon2id\$/);
        expect(hash).not.toContain('password-forte-123');
    });

    it('gera hashes diferentes para a mesma password', async () => {
        const [first, second] = await Promise.all([
            passwordService.hash('password-forte-123'),
            passwordService.hash('password-forte-123'),
        ]);

        expect(first).not.toBe(second);
    });

    it('confirma a password correta e recusa a errada', async () => {
        const hash = await passwordService.hash('password-forte-123');

        await expect(
            passwordService.verify(hash, 'password-forte-123'),
        ).resolves.toBe(true);

        await expect(
            passwordService.verify(hash, 'password-errada'),
        ).resolves.toBe(false);
    });

    it('simulateVerification termina sem revelar nada', async () => {
        await expect(passwordService.simulateVerification()).resolves.toBeUndefined();
    });
});
