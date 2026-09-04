import { useState } from 'react';
import { Link } from 'react-router';

import { Alert } from '../../auth/components/alert.js';
import { ApiError } from '../../lib/api.js';
import { useAuth } from '../../auth/auth.context.js';
import { useAsync } from '../../lib/use-async.js';
import { useIdioma, useT } from '../../i18n/i18n.js';
import { formatarPreco } from '../billing.format.js';
import {
    getMySubscription,
    getPlans,
    startCheckout,
    type SubscriptionSummary,
} from '../billing.api.js';

/**
 * O ecrã de onde se compra o plano.
 *
 * Mostra o preço a toda a gente, com sessão ou sem ela: quem ainda não
 * tem conta é precisamente quem precisa de ver quanto custa antes de a
 * criar. O que muda com a sessão é o botão — e o que ele diz depende do
 * que a pessoa já tem.
 */
export const PremiumPage = () => {
    const t = useT();
    const { idioma } = useIdioma();
    const { user } = useAuth();

    const catalogo = useAsync(() => getPlans(), []);

    /**
     * Sem sessão não há plano a consultar, e pedi-lo daria 401. O `null`
     * é a resposta honesta a "que plano tem quem não tem conta".
     */
    const plano = useAsync<SubscriptionSummary | null>(
        () => (user ? getMySubscription() : Promise.resolve(null)),
        [user?.id],
    );

    const [aComprar, setAComprar] = useState(false);
    const [falhou, setFalhou] = useState<string | null>(null);

    if (catalogo.loading || plano.loading) {
        return <p className="centered">{t.comum.aCarregar}</p>;
    }

    const premium = catalogo.data?.plans.find((linha) => linha.key === 'premium');

    if (!premium) {
        return (
            <section className="panel">
                <Alert kind="bad">{t.comum.naoFoiPossivel}</Alert>
            </section>
        );
    }

    const meu = plano.data;
    const aberto = catalogo.data?.available === true;

    const comprar = async () => {
        if (!user) {
            return;
        }

        setAComprar(true);
        setFalhou(null);

        try {
            const sessao = await startCheckout({
                ownerKind: 'user',
                ownerId: user.id,
            });

            /**
             * Sai-se do site para o Stripe. `replace` não serve: quem
             * desistir e carregar em "voltar" tem de voltar para aqui, e
             * não para o pagamento que acabou de abandonar.
             */
            window.location.assign(sessao.url);
        } catch (erro: unknown) {
            /**
             * O 503 não é avaria: é a instalação a dizer que a compra
             * ainda não abriu. Fica com a mesma mensagem que aparece
             * antes do clique, para que as duas digam o mesmo.
             */
            setFalhou(
                erro instanceof ApiError && erro.status === 503
                    ? t.premium.aindaNaoAbriu
                    : t.premium.naoFoiPossivelComprar,
            );

            setAComprar(false);
        }
    };

    return (
        <section className="panel premium-pagina">
            <header className="premium-hero">
                <span className="pill">{t.premium.etiqueta}</span>
                <h1>{t.premium.titulo}</h1>
                <p className="hint">{t.premium.subtitulo}</p>
            </header>

            <div className="preco">
                <strong>
                    {formatarPreco(premium.priceCents, premium.currency, idioma)}
                </strong>
                <span>{t.premium.porMes}</span>
            </div>

            <ul className="premium-lista">
                <li>{t.premium.oQueDaPersonalizacao}</li>
                <li>{t.premium.oQueDaCrew}</li>
                <li>{t.premium.oQueDaApoio}</li>
            </ul>

            {falhou ? <Alert kind="bad">{falhou}</Alert> : null}

            {/*
              Quatro situações, e cada uma tem uma resposta diferente. A
              que se decide primeiro é a de quem já tem vitalício: a essa
              pessoa, um botão de compra seria pedir dinheiro por uma
              coisa que já lhe foi oferecida.
            */}
            {meu?.isLifetime ? (
                <div className="premium-estado ativo">
                    <p>{t.premium.tensVitalicio}</p>
                    <Link className="primary" to="/eu">
                        {t.premium.irParaPerfil}
                    </Link>
                </div>
            ) : meu?.isPremium ? (
                <div className="premium-estado ativo">
                    <p>
                        {meu.activeUntil === null
                            ? t.premium.tensPlano
                            : t.premium.tensPlanoAte(
                                new Date(meu.activeUntil).toLocaleDateString(
                                    idioma,
                                ),
                            )}
                    </p>
                    <Link className="primary" to="/eu">
                        {t.premium.irParaPerfil}
                    </Link>
                </div>
            ) : !aberto ? (
                /*
                 * A compra não estar aberta é um facto da instalação, e
                 * não da pessoa: vem antes de saber se ela tem conta.
                 * Ao contrário, quem chegasse de fora era convidado a
                 * criar conta para comprar uma coisa que ainda não se
                 * vende — e só descobria isso depois de a criar.
                 */
                <div className="premium-estado">
                    <Alert kind="bad">{t.premium.aindaNaoAbriu}</Alert>
                </div>
            ) : !user ? (
                <div className="premium-estado">
                    <Link className="primary" to="/registo">
                        {t.premium.criarConta}
                    </Link>
                    <Link to="/entrar">{t.premium.jaTenhoConta}</Link>
                </div>
            ) : (
                <div className="premium-estado">
                    <button
                        className="primary"
                        type="button"
                        disabled={aComprar}
                        onClick={() => void comprar()}
                    >
                        {aComprar ? t.premium.aAbrir : t.premium.comprar}
                    </button>
                    <p className="hint">{t.premium.cancelarQuando}</p>
                </div>
            )}

            {/*
              O vitalício aparece aqui a toda a gente, e não só a quem o
              tem. É o que os primeiros a chegar vão receber, e uma coisa
              que ninguém sabe que existe não é um gesto — é um segredo.
            */}
            <p className="hint vitalicio-nota">{t.premium.notaVitalicio}</p>
        </section>
    );
};
