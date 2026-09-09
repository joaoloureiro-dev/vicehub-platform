import { api } from '../lib/api.js';

/** Quem está do outro lado de uma amizade. */
export interface Friend {
    userId: string;
    username: string;
    avatarUrl: string | null;
    level: number;
    /** ISO 8601, como todas as datas que chegam da API. */
    since: string;
}

/**
 * Um pedido por responder.
 *
 * O sentido decide o que o ecrã mostra: um pedido que me fizeram tem
 * botão de aceitar, um que eu fiz tem só "à espera".
 */
export interface FriendRequest extends Friend {
    direction: 'incoming' | 'outgoing';
}

export const listFriends = (): Promise<Friend[]> => api<Friend[]>('/friends');

export const listFriendRequests = (): Promise<FriendRequest[]> =>
    api<FriendRequest[]>('/friends/requests');

/**
 * Pede amizade.
 *
 * Pedir a quem já nos pediu **aceita** o pedido dele: a API responde 200
 * em vez de 201, e do lado de cá o resultado é o mesmo — ficam amigos.
 */
export const requestFriend = (userId: string): Promise<{ resultado: string }> =>
    api<{ resultado: string }>(`/friends/${encodeURIComponent(userId)}`, {
        method: 'POST',
    });

export const acceptFriend = (userId: string): Promise<void> =>
    api<void>(`/friends/${encodeURIComponent(userId)}/accept`, {
        method: 'POST',
    });

/** Recusar, retirar e desfazer: do lado de quem carrega, a mesma coisa. */
export const removeFriend = (userId: string): Promise<void> =>
    api<void>(`/friends/${encodeURIComponent(userId)}`, { method: 'DELETE' });
