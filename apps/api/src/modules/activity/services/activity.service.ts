import type { ActivityRepository } from '../repositories/activity.repository.js';
import type { ActivityItem } from '../types/activity.types.js';

/** Quantas coisas o feed devolve de uma vez. */
export const TAMANHO_DO_FEED = 30;

/**
 * O que aconteceu enquanto estive fora.
 *
 * O feed é uma **vista** dos factos que já existem, e não uma segunda
 * cópia deles. Podia ser uma tabela escrita a cada acontecimento — seria
 * mais rápido de ler — mas seria também mais uma coisa a divergir da
 * verdade: uma linha de feed a dizer o que a origem já não diz é pior do
 * que não haver feed nenhum. Aqui, apagar um evento apaga-o do feed
 * sozinho, sem ninguém ter de se lembrar disso.
 *
 * **Nada aqui é novo.** Cada linha é uma coisa que eu já podia ver se
 * navegasse até lá: os eventos das crews a que pertenço, quem entrou
 * nessas crews, e as crews em que os meus amigos entraram — as listas de
 * membros são públicas. O feed poupa a caminhada, não abre portas.
 *
 * O dinheiro fica de fora de propósito. A tesouraria tem o seu ecrã e as
 * suas permissões, e um montante num feed é um montante a um passo de
 * chegar a quem não devia vê-lo.
 */
export class ActivityService {
    constructor(private readonly activityRepository: ActivityRepository) { }

    async listForUser(userId: string): Promise<ActivityItem[]> {
        const [crewIds, friendIds] = await Promise.all([
            this.activityRepository.listMyCrewIds(userId),
            this.activityRepository.listMyFriendIds(userId),
        ]);

        /**
         * Cada origem traz as suas mais recentes, e depois junta-se tudo.
         *
         * Pedir `TAMANHO_DO_FEED` a cada uma chega: as mais recentes de
         * todas estão sempre entre as mais recentes de cada uma, por
         * isso a lista final é exata e não uma aproximação.
         */
        const [eventos, entradas, amigos] = await Promise.all([
            crewIds.length === 0
                ? []
                : this.activityRepository.listCrewEvents(crewIds, TAMANHO_DO_FEED),
            crewIds.length === 0
                ? []
                : this.activityRepository.listCrewJoins(
                    { crewIds },
                    TAMANHO_DO_FEED,
                ),
            friendIds.length === 0
                ? []
                : this.activityRepository.listCrewJoins(
                    { userIds: friendIds },
                    TAMANHO_DO_FEED,
                ),
        ]);

        const itens: ActivityItem[] = [
            ...eventos.flatMap((ganho) =>
                ganho.crew === null
                    ? []
                    : [
                        {
                            kind: 'crew_event' as const,
                            id: ganho.id,
                            at: ganho.created_at,
                            crew: ganho.crew,
                            event: ganho.event,
                            amount: ganho.amount,
                        },
                    ],
            ),
            ...entradas.flatMap((adesao) =>
                adesao.crew === null
                    ? []
                    : [
                        {
                            kind: 'crew_joined' as const,
                            id: adesao.id,
                            /** Quem funda a crew entra sem ninguém responder. */
                            at: adesao.responded_at ?? adesao.created_at,
                            crew: adesao.crew,
                            person: adesao.user,
                        },
                    ],
            ),
            ...amigos.flatMap((adesao) =>
                adesao.crew === null
                    ? []
                    : [
                        {
                            kind: 'friend_joined_crew' as const,
                            id: adesao.id,
                            at: adesao.responded_at ?? adesao.created_at,
                            crew: adesao.crew,
                            person: adesao.user,
                        },
                    ],
            ),
        ];

        return this.juntar(itens);
    }

    /**
     * Ordena, tira repetidos e corta.
     *
     * Um amigo que entra numa crew minha chega por dois caminhos. É a
     * mesma coisa, e por isso aparece uma vez só: a chave é o
     * identificador da linha de origem, e fica a primeira — que, depois
     * de ordenar, é sempre a mais recente das iguais.
     */
    private juntar(itens: ActivityItem[]): ActivityItem[] {
        const vistos = new Set<string>();

        return itens
            .sort((um, outro) => outro.at.getTime() - um.at.getTime())
            .filter((item) => {
                if (vistos.has(item.id)) {
                    return false;
                }

                vistos.add(item.id);

                return true;
            })
            .slice(0, TAMANHO_DO_FEED);
    }
}
