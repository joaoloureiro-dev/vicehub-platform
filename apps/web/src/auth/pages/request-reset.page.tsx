import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';

import { ApiError } from '../../lib/api.js';
import { mensagemDoErro } from '../../lib/erro.js';
import { Alert } from '../components/alert.js';
import { Captcha } from '../components/captcha.js';
import { Field } from '../components/field.js';
import { requestPasswordReset } from '../auth.api.js';
import { useT } from '../../i18n/i18n.js';

/**
 * Pedir o link de recuperação.
 *
 * **O ecrã não pode dizer se a conta existe.** O servidor responde
 * sempre igual, de propósito; se a interface distinguisse os dois casos,
 * desfazia num segundo o trabalho todo — bastava experimentar endereços
 * e ler o que aparece.
 *
 * Por isso a confirmação é sempre a mesma, e aparece mesmo quando o
 * pedido falha por outra razão qualquer.
 */
export const RequestResetPage = () => {
    const t = useT();
    const [email, setEmail] = useState('');
    const [enviado, setEnviado] = useState(false);
    const [aEnviar, setAEnviar] = useState(false);
    const [erro, setErro] = useState<string | null>(null);

    /**
     * O cartão do CAPTCHA, quando a instalação tem um.
     *
     * Esta é a terceira porta, e a única que faz a plataforma escrever a
     * alguém sem que quem pede prove seja o que for. O limite por IP
     * trava um guião a correr de um sítio só; não trava quem tenha
     * endereços a rodar.
     */
    const [cartao, setCartao] = useState<string | null>(null);

    const submeter = async (event: FormEvent) => {
        event.preventDefault();
        setErro(null);
        setAEnviar(true);

        try {
            await requestPasswordReset(email, cartao ?? undefined);
        } catch (falha) {
            /**
             * O CAPTCHA é a única falha que se mostra aqui.
             *
             * Pode ser dita sem revelar nada: a recusa é sobre o pedido
             * e não sobre a conta, e é a mesma exista ela ou não.
             * Engoli-la seria pior do que o silêncio que protege o
             * resto — a pessoa lia "verifica o teu email" e ficava à
             * espera de um email que nunca foi enviado.
             */
            if (falha instanceof ApiError && falha.code === 'CAPTCHA_FAILED') {
                setErro(mensagemDoErro(falha, t));
                setAEnviar(false);

                return;
            }

            /*
             * O resto é engolido de propósito. Um erro visível aqui
             * seria um canal a dizer alguma coisa sobre a conta.
             */
        }

        setEnviado(true);
        setAEnviar(false);
    };

    if (enviado) {
        return (
            <div className="card">
                <header>
                    <h1>{t.auth.verificaEmail}</h1>
                </header>
                <Alert kind="good">{t.auth.seExistir}</Alert>
                <div className="foot">
                    <Link to="/entrar">{t.auth.voltarAoLogin}</Link>
                </div>
            </div>
        );
    }

    return (
        <div className="card">
            <header>
                <h1>{t.auth.recuperarTitulo}</h1>
                <p>{t.auth.recuperarSub}</p>
            </header>

            {erro ? <Alert kind="bad">{erro}</Alert> : null}

            <form onSubmit={submeter}>
                <Field
                    id="email"
                    label={t.auth.email}
                    type="email"
                    value={email}
                    onChange={setEmail}
                    autoComplete="email"
                />
                <Captcha aoResponder={setCartao} />

                <button className="primary" type="submit" disabled={aEnviar}>
                    {aEnviar ? t.auth.aEnviar : t.auth.enviarLink}
                </button>
            </form>

            <div className="foot">
                <Link to="/entrar">{t.auth.jaMeLembro}</Link>
            </div>
        </div>
    );
};
