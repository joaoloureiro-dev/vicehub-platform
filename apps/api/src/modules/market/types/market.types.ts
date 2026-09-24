import type {
    CategoriaDeAnuncio,
    EstadoDeAnuncio,
} from '@vicehub/database';

/** Quem anuncia, tal como aparece ao lado do anúncio. */
export interface VendedorView {
    id: string;
    username: string;
    avatarUrl: string | null;
}

/**
 * Um anúncio na lista.
 *
 * Sem o corpo: uma página de vinte e quatro anúncios com quatro mil
 * caracteres cada mandava cem mil caracteres para desenhar títulos e
 * preços.
 */
export interface AnuncioResumo {
    id: string;
    category: CategoriaDeAnuncio;
    title: string;
    price: bigint;
    imageUrl: string | null;
    status: EstadoDeAnuncio;
    seller: VendedorView | null;
    createdAt: Date;
    updatedAt: Date;
}

/** Um anúncio inteiro. */
export interface AnuncioView extends AnuncioResumo {
    body: string;
    serverId: string;
    serverName: string;
    sellerId: string | null;
    closedAt: Date | null;
}

/**
 * O que uma pessoa escreve num anúncio.
 *
 * Escrito uma vez e usado nas duas pontas — criar leva-o inteiro,
 * editar leva-o em `Partial` — para que acrescentar um campo ao anúncio
 * não deixe o outro caminho para trás.
 */
export interface CamposDoAnuncio {
    category: CategoriaDeAnuncio;
    title: string;
    body: string;
    price: bigint;
    /** Ausente é "não mexas"; `null` é "tira a que lá está". */
    imageUrl?: string | null | undefined;
}

/**
 * O que se muda num anúncio já escrito.
 *
 * Os `| undefined` são escritos à mão e não vêm de um `Partial`: com
 * `exactOptionalPropertyTypes`, `Partial` diz "a chave pode faltar" e
 * não "a chave pode estar lá a valer nada" — e o que chega de um corpo
 * de pedido é a segunda coisa.
 */
export interface MudancasDoAnuncio {
    category?: CategoriaDeAnuncio | undefined;
    title?: string | undefined;
    body?: string | undefined;
    price?: bigint | undefined;
    imageUrl?: string | null | undefined;
}

/** O anúncio de que uma conversa fala, resumido. */
export interface AnuncioDaConversa {
    id: string;
    title: string;
    price: bigint;
    status: EstadoDeAnuncio;
    isRemoved: boolean;
}

export interface MensagemView {
    id: string;
    body: string;
    sender: VendedorView | null;
    /** Para o ecrã saber de que lado a desenhar. */
    isMine: boolean;
    createdAt: Date;
}

export interface ConversaView {
    id: string;
    listing: AnuncioDaConversa;
    buyer: VendedorView | null;
    seller: VendedorView | null;
    messages: MensagemView[];
}

/** Uma conversa na caixa de entrada. */
export interface ConversaResumo {
    id: string;
    listing: AnuncioDaConversa;
    /** Quem está do outro lado, visto de quem pede a lista. */
    comQuem: VendedorView | null;
    ultima: {
        body: string;
        isMine: boolean;
        createdAt: Date;
    } | null;
    updatedAt: Date;
}
