import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';

import { Alert } from '../../auth/components/alert.js';
import { ApiError } from '../../lib/api.js';
import { getMyMovements } from '../../treasury/treasury.api.js';
import {
    formatarMontante,
    separadorDoIdioma,
} from '../../treasury/treasury.types.js';
import { sessionStore } from '../../lib/session.js';
import { useAsync } from '../../lib/use-async.js';
import { useIdioma, useT } from '../../i18n/i18n.js';
import { deleteMyAccount } from '../profile.api.js';

/**
 * Apagar a conta, do lado de quem a apaga.
 *
 * Segue a mesma forma de apagar uma comunidade — a mesma moldura, o
 * mesmo gesto de escrever o nome — e por uma razão que não é só de
 * aparência: é a mesma decisão irreversível, e quem já a tomou uma vez
 * reconhece o que está a fazer sem ter de ler tudo de novo.
 *
 * O que muda é um campo a mais: a password. A confirmação pelo nome
 * separa um clique errado de uma decisão; a password é o que impede que
 * uma sessão roubada apague a conta de alguém — e o nome está à vista
 * no perfil de quem a apanhou.
 *
 * E o que **não** se faz aqui é esconder a saída. Uma conta que se cria
 * num minuto e demora uma semana a apagar não é uma conta, é uma
 * armadilha.
 */
export const ApagarConta = ({ username }: { username: string }) => {
    const t = useT();
    const { idioma } = useIdioma();
    const navigate = useNavigate();

    /**
     * O saldo que se vai perder.
     *
     * Durante muito tempo o saldo **impedia** apagar a conta, com uma
     * mensagem a mandar transferi-lo ou gastá-lo — e não há rota
     * nenhuma por onde uma pessoa tire dinheiro da sua carteira. A
     * decisão passou a ser que o saldo se perde, e isso obriga a dizê-lo
     * **antes**: perder dinheiro sem aviso é pior do que a porta trancada
     * que isto veio substituir.
     *
     * Se a leitura falhar, `useAsync` devolve `data: null` e este ecrã
     * lê isso como "não há aviso a dar" — e não como uma razão para
     * trancar a porta. Uma avaria a ler o saldo não pode ser o que
     * impede alguém de sair, e um número inventado era pior do que
     * aviso nenhum.
     */
    const carteira = useAsync(() => getMyMovements(), []);

    const aPerder = carteira.data?.balances.settled ?? '0';
    const perdeAlgumaCoisa = aPerder !== '0' && aPerder !== '';

    const [escrito, setEscrito] = useState('');
    const [password, setPassword] = useState('');
    const [aApagar, setAApagar] = useState(false);
    const [erro, setErro] = useState<string | null>(null);

    const confere = escrito === username;

    const submeter = async (evento: FormEvent) => {
        evento.preventDefault();

        setAApagar(true);
        setErro(null);

        try {
            await deleteMyAccount({
                confirmation: escrito,
                /**
                 * Vazio é não ter posto nada, e quem entra pelo Discord
                 * ou pela Google não tem password nenhuma para pôr.
                 * Mandar uma string vazia fazia a API procurar uma
                 * password que não existe.
                 */
                ...(password === '' ? {} : { password }),
            });

            /**
             * A sessão local é limpa aqui e não se espera pelo pedido
             * seguinte: o cookie já foi apagado pelo servidor, e deixar
             * a aplicação a achar que ainda há alguém dentro dava um 401
             * sem explicação no primeiro sítio a que fosse.
             */
            sessionStore.clear();

            void navigate('/');
        } catch (falha: unknown) {
            /**
             * A API diz exatamente o que falta fazer primeiro — que crew
             * fica sem dono, que saldo ainda lá está. Substituir isso por
             * uma mensagem nossa era deitar fora a única parte acionável
             * da resposta.
             */
            setErro(
                falha instanceof ApiError
                    ? falha.message
                    : t.comum.naoFoiPossivel,
            );

            setAApagar(false);
        }
    };

    return (
        <section className="grupo perigo">
            <h2>{t.perfil.apagarConta}</h2>

            <p className="hint">{t.perfil.apagarContaExplicacao}</p>

            <p className="hint">{t.perfil.apagarContaFica}</p>

            {/*
              O aviso aparece só a quem tem alguma coisa a perder. A
              quem tem a carteira vazia, dizer-lhe que o saldo se perde
              era assustar por nada.
            */}
            {perdeAlgumaCoisa ? (
                <Alert kind="bad">
                    {t.perfil.apagarContaPerdeSaldo(
                        formatarMontante(aPerder, separadorDoIdioma(idioma)),
                    )}
                </Alert>
            ) : null}

            {erro ? <Alert kind="bad">{erro}</Alert> : null}

            <form onSubmit={(evento) => void submeter(evento)}>
                <div className="field">
                    <label htmlFor="apagar-conta">
                        {t.zonaPerigo.confirmacao}
                    </label>
                    <input
                        autoComplete="off"
                        id="apagar-conta"
                        onChange={(evento) => setEscrito(evento.target.value)}
                        placeholder={username}
                        type="text"
                        value={escrito}
                    />
                    <p className="hint">{t.zonaPerigo.escreveONome(username)}</p>
                </div>

                {/*
                  A password aparece a toda a gente e é opcional: o ecrã
                  não sabe se esta conta tem uma, e perguntá-lo à API
                  antes do clique seria dizer, a quem apanhasse a sessão,
                  por onde é que esta pessoa entra.
                */}
                <div className="field">
                    <label htmlFor="apagar-conta-password">
                        {t.perfil.apagarContaPassword}
                    </label>
                    <input
                        autoComplete="current-password"
                        id="apagar-conta-password"
                        onChange={(evento) => setPassword(evento.target.value)}
                        type="password"
                        value={password}
                    />
                </div>

                <button
                    className="btn-secondary perigo"
                    disabled={!confere || aApagar}
                    type="submit"
                >
                    {aApagar
                        ? t.zonaPerigo.aApagar
                        : t.perfil.apagarContaConfirmar}
                </button>
            </form>
        </section>
    );
};
