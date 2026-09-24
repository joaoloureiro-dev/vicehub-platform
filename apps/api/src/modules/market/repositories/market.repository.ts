import {
    ANUNCIOS_POR_PAGINA,
    MembershipStatus,
    MembershipType,
    type CategoriaDeAnuncio,
    type DatabaseClient,
    type EstadoDeAnuncio,
} from '@vicehub/database';

import type { MudancasDoAnuncio } from '../types/market.types.js';

/** O que se lê de quem anuncia, e nada mais. */
const VENDEDOR = {
    select: { id: true, username: true, avatarUrl: true },
} as const;

/** As colunas de um anúncio numa lista. Sem o corpo, de propósito. */
const RESUMO = {
    id: true,
    category: true,
    title: true,
    price: true,
    imageUrl: true,
    status: true,
    created_at: true,
    updated_at: true,
    seller: VENDEDOR,
} as const;

interface Filtro {
    serverId: string;
    status: EstadoDeAnuncio;
    category?: CategoriaDeAnuncio;
}

export class MarketRepository {
    constructor(private readonly database: DatabaseClient) { }

    /**
     * O `where` da listagem, escrito uma vez.
     *
     * A contagem e a página têm de filtrar exatamente pelo mesmo. Duas
     * cópias da mesma condição é como uma lista passa a dizer "página 1
     * de 3" e a ter uma página só.
     */
    private onde(filtro: Filtro) {
        return {
            serverId: filtro.serverId,
            status: filtro.status,
            is_deleted: false,
            ...(filtro.category === undefined
                ? {}
                : { category: filtro.category }),
        };
    }

    listListings(filtro: Filtro, pagina: number) {
        return this.database.marketListing.findMany({
            where: this.onde(filtro),
            /**
             * Pela última alteração, e não pela criação: um anúncio a
             * que o dono baixou o preço hoje interessa mais do que um
             * posto ontem e esquecido — e baixar o preço é a única
             * forma que quem vende tem de se fazer ver outra vez.
             */
            orderBy: [{ updated_at: 'desc' }, { id: 'desc' }],
            skip: (pagina - 1) * ANUNCIOS_POR_PAGINA,
            take: ANUNCIOS_POR_PAGINA,
            select: RESUMO,
        });
    }

    countListings(filtro: Filtro) {
        return this.database.marketListing.count({ where: this.onde(filtro) });
    }

    findListing(listingId: string) {
        return this.database.marketListing.findFirst({
            where: { id: listingId, is_deleted: false },
            select: {
                ...RESUMO,
                body: true,
                serverId: true,
                sellerId: true,
                closed_at: true,
                server: { select: { name: true } },
            },
        });
    }

    findServer(serverId: string) {
        return this.database.server.findFirst({
            where: { id: serverId, is_deleted: false },
            select: { id: true, name: true },
        });
    }

    /**
     * Esta pessoa joga mesmo neste servidor?
     *
     * Por dois caminhos, porque há dois: uma adesão direta ao servidor,
     * e uma adesão a uma crew que joga lá. Verificar só um deixava
     * metade das pessoas de fora do mercado do sítio onde jogam todos os
     * dias.
     *
     * Ativa dos dois lados. Uma crew que se candidatou e ainda não foi
     * aceite não é uma crew deste servidor, e quem já saiu de uma crew
     * não anuncia pelo lugar que ela lá tem.
     */
    async userPlaysOnServer(
        userId: string,
        serverId: string,
    ): Promise<boolean> {
        const adesao = await this.database.membership.findFirst({
            where: {
                userId,
                status: MembershipStatus.active,
                is_deleted: false,
                OR: [
                    { type: MembershipType.server, serverId },
                    {
                        type: MembershipType.crew,
                        crew: {
                            is_deleted: false,
                            affiliations: {
                                some: {
                                    serverId,
                                    status: MembershipStatus.active,
                                    is_deleted: false,
                                },
                            },
                        },
                    },
                ],
            },
            select: { id: true },
        });

        return adesao !== null;
    }

    createListing(input: {
        serverId: string;
        sellerId: string;
        category: CategoriaDeAnuncio;
        title: string;
        body: string;
        price: bigint;
        imageUrl: string | null;
    }) {
        return this.database.marketListing.create({
            data: {
                serverId: input.serverId,
                sellerId: input.sellerId,
                category: input.category,
                title: input.title,
                body: input.body,
                price: input.price,
                imageUrl: input.imageUrl,
                created_by: input.sellerId,
            },
            select: { id: true },
        });
    }

    updateListing(
        listingId: string,
        porQuem: string,
        mudancas: MudancasDoAnuncio,
    ) {
        return this.database.marketListing.update({
            where: { id: listingId },
            /**
             * Campo a campo, e não um espalhar do que chegou: uma chave
             * presente a valer `undefined` e uma chave ausente são a
             * mesma coisa para o JavaScript e coisas diferentes para o
             * Prisma. Assim, o que não foi enviado não é tocado.
             */
            data: {
                ...(mudancas.category === undefined
                    ? {}
                    : { category: mudancas.category }),
                ...(mudancas.title === undefined
                    ? {}
                    : { title: mudancas.title }),
                ...(mudancas.body === undefined ? {} : { body: mudancas.body }),
                ...(mudancas.price === undefined
                    ? {}
                    : { price: mudancas.price }),
                ...(mudancas.imageUrl === undefined
                    ? {}
                    : { imageUrl: mudancas.imageUrl }),
                updated_by: porQuem,
                version: { increment: 1 },
            },
            select: { id: true },
        });
    }

    /**
     * Fecha o anúncio e marca a hora.
     *
     * A hora é escrita aqui e não deixada ao `updated_at`: esse mexe-se
     * a cada edição, e "quando é que isto saiu da venda" é uma pergunta
     * que tem de sobreviver à edição seguinte.
     */
    closeListing(
        listingId: string,
        porQuem: string,
        estado: Exclude<EstadoDeAnuncio, 'open'>,
        quando: Date,
    ) {
        return this.database.marketListing.update({
            where: { id: listingId },
            data: {
                status: estado,
                closed_at: quando,
                updated_by: porQuem,
                version: { increment: 1 },
            },
            select: { id: true },
        });
    }

    /**
     * Retirar é apagar em brando, como no fórum: a linha fica, e deixa
     * de se ver. Sem isso, um anúncio apagado levava consigo a prova de
     * que alguma vez existiu.
     *
     * E fecha, na mesma transação, as denúncias que pediam isto. Quem
     * retira já agiu; deixá-las abertas mandava o moderador seguinte
     * olhar para um anúncio que já não existe.
     */
    softDeleteListing(listingId: string, porQuem: string, quando: Date) {
        return this.database.$transaction(async (tx) => {
            const anuncio = await tx.marketListing.update({
                where: { id: listingId },
                data: {
                    is_deleted: true,
                    deleted_at: quando,
                    updated_by: porQuem,
                    version: { increment: 1 },
                },
                select: { id: true },
            });

            await tx.report.updateMany({
                where: { listingId, status: 'open' },
                data: {
                    status: 'acted',
                    handled_at: quando,
                    handled_by: porQuem,
                    updated_by: porQuem,
                    version: { increment: 1 },
                },
            });

            return anuncio;
        });
    }
}
