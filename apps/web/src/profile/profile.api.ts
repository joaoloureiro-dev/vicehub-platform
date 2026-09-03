import { api } from '../lib/api.js';
import type { PrivateProfile, PublicProfile } from './profile.types.js';

export const getMyProfile = (): Promise<PrivateProfile> =>
    api<PrivateProfile>('/users/me');

export const getProfile = (username: string): Promise<PublicProfile> =>
    api<PublicProfile>(`/users/${encodeURIComponent(username)}`);

export const updateMyProfile = (input: {
    avatarUrl?: string | null;
    bio?: string | null;
}): Promise<PrivateProfile> =>
    api<PrivateProfile>('/users/me', { method: 'PATCH', body: input });

/**
 * A personalização é uma funcionalidade do plano.
 *
 * Sem plano ativo a API responde **402**, e não 403: o pedido é legítimo
 * e quem o faz tem autorização — o que falta é o pagamento. O ecrã lê
 * esse 402 como "isto é premium", e não como avaria.
 */
export const updateMyAppearance = (input: {
    bannerUrl?: string | null;
    accentColor?: string | null;
}): Promise<unknown> =>
    api<unknown>('/users/me/appearance', { method: 'PATCH', body: input });
