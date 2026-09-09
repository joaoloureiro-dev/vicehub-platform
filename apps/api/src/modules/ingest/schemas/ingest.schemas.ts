import { z } from 'zod';

export const serverIdParamSchema = z.object({
    serverId: z.string().uuid(),
});

export const apiKeyParamSchema = z.object({
    serverId: z.string().uuid(),
    apiKeyId: z.string().uuid(),
});

export const createApiKeySchema = z.object({
    /** Para distinguir "produção" de "o meu portátil" numa lista. */
    label: z.string().trim().min(1).max(60),
});

/**
 * O que o recurso do FiveM manda a cada batida.
 *
 * O número de jogadores tem um teto porque é um número que vem de fora:
 * sem limite, um script com um erro punha o diretório a mostrar um
 * servidor com dois mil milhões de pessoas dentro.
 */
export const heartbeatSchema = z.object({
    playersOnline: z.coerce.number().int().min(0).max(10_000),
});
