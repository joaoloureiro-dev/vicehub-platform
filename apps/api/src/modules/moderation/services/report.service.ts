import {
    DENUNCIAS_POR_PAGINA,
    type ReportReason,
    type ReportStatus,
} from '@vicehub/database';

import { ModerationError } from '../errors/moderation.errors.js';
import type {
    Alvo,
    ReportRepository,
} from '../repositories/report.repository.js';
import type { DenunciaView } from '../types/moderation.types.js';

export interface PaginaDeDenuncias {
    denuncias: DenunciaView[];
    pagina: number;
    paginas: number;
    total: number;
}

/**
 * A moderação do que o público escreve.
 *
 * Uma fila só para a plataforma inteira. O fórum e o mercado são duas
 * superfícies da mesma coisa — sítios onde qualquer pessoa com conta
 * escreve à vista de todos —, e dar a cada uma a sua fila era garantir
 * que uma delas ficava por abrir.
 *
 * Quem decide é uma pessoa. Nada daqui retira seja o que for sozinho.
 */
export class ReportService {
    constructor(private readonly reportRepository: ReportRepository) { }

    /**
     * Denunciar.
     *
     * Existe porque sem isto a moderação dependia de sorte: alguém tinha
     * de calhar de ler a publicação para ela ser vista. Quem lê é quem
     * encontra.
     *
     * Duas recusas, e ambas por razões práticas. **Não se denuncia o que
     * já foi retirado**, porque não há lá nada para um moderador ver. E
     * **não se denuncia o que é nosso** — quem quer o seu texto fora tem
     * o botão de retirar, e uma denúncia a si próprio só põe trabalho na
     * fila de outra pessoa.
     *
     * Denunciar duas vezes a mesma coisa é recusado pela base de dados,
     * e não aqui: entre a leitura e a escrita cabe um segundo clique, e
     * o índice é o único sítio onde isso não cabe.
     */
    async report(
        alvo: Alvo,
        reporterId: string,
        reason: ReportReason,
        note?: string,
    ): Promise<{ id: string }> {
        const publicacao = await this.reportRepository.findTarget(alvo);

        if (publicacao === null) {
            throw new ModerationError(
                'TARGET_NOT_FOUND',
                'Isto não existe ou foi retirado.',
            );
        }

        if (publicacao.authorId === reporterId) {
            throw new ModerationError(
                'IS_YOURS',
                'Isto é teu. Para o tirares daqui, usa o botão de retirar.',
            );
        }

        try {
            return await this.reportRepository.createReport({
                alvo,
                reporterId,
                reason,
                ...(note === undefined ? {} : { note }),
            });
        } catch (erro: unknown) {
            /**
             * O índice único a recusar a segunda denúncia da mesma
             * pessoa à mesma publicação. Não é um erro do ponto de vista
             * de quem carregou no botão: já tinha avisado.
             */
            if (
                erro !== null
                && typeof erro === 'object'
                && (erro as { code?: string }).code === 'P2002'
            ) {
                throw new ModerationError(
                    'ALREADY_REPORTED',
                    'Já denunciaste isto. Um moderador vai ver.',
                );
            }

            throw erro;
        }
    }

    async listReports(
        status: ReportStatus,
        pagina: number,
    ): Promise<PaginaDeDenuncias> {
        const [linhas, total] = await Promise.all([
            this.reportRepository.listReports(status, pagina),
            this.reportRepository.countReports(status),
        ]);

        return {
            denuncias: linhas.map((linha) => ({
                id: linha.id,
                reason: linha.reason,
                note: linha.note,
                status: linha.status,
                createdAt: linha.created_at,
                handledAt: linha.handled_at,
                reporter: linha.reporter,
                target: alvoDaLinha(linha),
            })),
            pagina,
            paginas: Math.max(1, Math.ceil(total / DENUNCIAS_POR_PAGINA)),
            total,
        };
    }

    async handleReport(
        reportId: string,
        actorId: string,
        outcome: 'acted' | 'dismissed',
    ): Promise<void> {
        const denuncia = await this.reportRepository.findReport(reportId);

        if (denuncia === null) {
            throw new ModerationError(
                'REPORT_NOT_FOUND',
                'Esta denúncia não existe.',
            );
        }

        if (denuncia.status !== 'open') {
            throw new ModerationError(
                'REPORT_ALREADY_HANDLED',
                'Esta denúncia já foi vista por alguém.',
            );
        }

        await this.reportRepository.handleReport(reportId, outcome, actorId);
    }
}

/**
 * A linha da base de dados, com as três relações, virada no alvo único
 * que a fila mostra.
 *
 * O `CHECK` da tabela garante que exatamente uma delas vem preenchida.
 * O lançamento no fim não é defesa contra o improvável: é o que impede
 * uma quarta espécie de alvo de aparecer na fila como uma linha vazia
 * em vez de uma falha que alguém vê.
 */
const alvoDaLinha = (linha: {
    topic: {
        id: string;
        title: string;
        body: string | null;
        is_deleted: boolean;
        author: DenunciaView['reporter'];
    } | null;
    reply: {
        id: string;
        topicId: string;
        body: string | null;
        is_deleted: boolean;
        author: DenunciaView['reporter'];
    } | null;
    listing: {
        id: string;
        title: string;
        body: string;
        is_deleted: boolean;
        seller: DenunciaView['reporter'];
    } | null;
}): DenunciaView['target'] => {
    if (linha.topic !== null) {
        return {
            kind: 'topic',
            openId: linha.topic.id,
            title: linha.topic.title,
            body: linha.topic.body,
            author: linha.topic.author,
            isRemoved: linha.topic.is_deleted,
        };
    }

    if (linha.reply !== null) {
        return {
            kind: 'reply',
            /**
             * O tópico da resposta, e não a resposta: é para onde o
             * moderador vai ler o caso completo, que é o que lhe
             * permite decidir.
             */
            openId: linha.reply.topicId,
            title: null,
            body: linha.reply.body,
            author: linha.reply.author,
            isRemoved: linha.reply.is_deleted,
        };
    }

    if (linha.listing !== null) {
        return {
            kind: 'listing',
            openId: linha.listing.id,
            title: linha.listing.title,
            body: linha.listing.body,
            author: linha.listing.seller,
            isRemoved: linha.listing.is_deleted,
        };
    }

    throw new Error('Denúncia sem alvo: o CHECK da tabela devia impedi-lo.');
};
