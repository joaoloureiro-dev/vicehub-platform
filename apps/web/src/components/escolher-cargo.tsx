import { useT } from '../i18n/i18n.js';

/**
 * O cargo de um membro, para quem manda na comunidade.
 *
 * Existe uma vez e serve as crews e os servidores: são os mesmos três
 * degraus com nomes diferentes, e duas cópias acabariam por divergir
 * numa regra que é a mesma.
 *
 * A API recusa três coisas que o ecrã por isso nem oferece: mudar o
 * próprio cargo, mexer em quem não é membro, e despromover o único
 * líder — essa última não se sabe daqui, e é a API que a diz. As duas
 * primeiras decidem-se onde se sabe quem está a ver, e não aqui dentro.
 */
export const EscolherCargo = <T extends string>({
    cargos,
    atual,
    nome,
    desativado,
    aoEscolher,
}: {
    /** Os cargos desta espécie de comunidade, do mais alto ao mais baixo. */
    cargos: readonly T[];
    /**
     * O cargo em vigor, tal como a API o devolveu.
     *
     * É `string` e não um dos `cargos` de propósito: o que lá está vem
     * da base de dados, e um cargo que este ecrã ainda não conheça
     * continua a ser o cargo daquela pessoa.
     */
    atual: string;
    /** De quem é o cargo, para quem navega por leitor de ecrã. */
    nome: string;
    desativado: boolean;
    aoEscolher: (cargo: T) => void;
}) => {
    const t = useT();

    /**
     * Um cargo que a API devolveu e esta versão do ecrã não conhece
     * entra na lista à mesma, pelo seu nome em bruto.
     *
     * Sem isto, o campo não encontrava o valor, mostrava a primeira
     * opção, e dizia que a pessoa é líder quando não é. Mais vale
     * mostrar `crew_veteran` do que uma mentira legível.
     */
    const conhecidos: readonly string[] = cargos;
    const opcoes = conhecidos.includes(atual) ? cargos : [atual, ...cargos];

    return (
        <select
            className="cargo-escolha"
            aria-label={t.crews.cargoDe(nome)}
            value={atual}
            disabled={desativado}
            onChange={(evento) => {
                /**
                 * Escolher o cargo que já lá está não é uma alteração.
                 * Sem isto, um clique que não muda nada gastava um
                 * pedido e piscava a lista inteira a recarregar.
                 */
                if (evento.target.value !== atual) {
                    /**
                     * O único sítio onde o tipo se estreita, e é são:
                     * as opções deste campo são exatamente `cargos`, por
                     * isso o que sai daqui é um deles. Sem a conversão,
                     * cada página tinha de a fazer na sua chamada — e
                     * uma delas acabaria por converter para o cargo da
                     * outra comunidade.
                     */
                    aoEscolher(evento.target.value as T);
                }
            }}
        >
            {opcoes.map((cargo) => (
                <option key={cargo} value={cargo}>
                    {t.cargos[cargo as keyof typeof t.cargos] ?? cargo}
                </option>
            ))}
        </select>
    );
};
