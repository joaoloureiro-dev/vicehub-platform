import { useEffect, useRef, useState } from 'react';

import { api } from '../../lib/api.js';
import { useT } from '../../i18n/i18n.js';
import { Alert } from './alert.js';

/**
 * O widget do Cloudflare Turnstile, quando há um.
 *
 * **Nada é carregado sem chave configurada.** A instalação diz se tem
 * CAPTCHA através da própria API, e só depois de ela responder com uma
 * chave é que o script do Cloudflare entra na página. Numa instalação
 * sem CAPTCHA, nenhum pedido sai daqui para fora — que é o que mantém
 * verdadeira a promessa da página de privacidade.
 *
 * O cartão que o widget devolve vai no corpo do pedido, e é o servidor
 * que o confirma. Isto aqui não protege nada por si: é código que corre
 * na máquina de quem o quiser contornar.
 */

/** O endereço do script, e o único sítio onde ele aparece escrito. */
const SCRIPT = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

interface JanelaComTurnstile extends Window {
    turnstile?: {
        render: (
            onde: HTMLElement,
            opcoes: {
                sitekey: string;
                callback: (cartao: string) => void;
                'expired-callback': () => void;
                'error-callback': () => void;
                theme?: 'light' | 'dark' | 'auto';
            },
        ) => string;
        remove: (id: string) => void;
    };
}

/**
 * Carrega o script uma vez por página, e não uma vez por widget.
 *
 * O login e o registo são ecrãs diferentes do mesmo sítio: quem vai de
 * um para o outro não devia pagar o download duas vezes, e dois scripts
 * iguais na mesma página é um erro do Cloudflare à espera de acontecer.
 */
let aCarregar: Promise<void> | null = null;

const carregarScript = (): Promise<void> => {
    if (aCarregar !== null) {
        return aCarregar;
    }

    aCarregar = new Promise<void>((resolver, rejeitar) => {
        const etiqueta = document.createElement('script');

        etiqueta.src = SCRIPT;
        etiqueta.async = true;
        etiqueta.defer = true;
        etiqueta.addEventListener('load', () => resolver());
        etiqueta.addEventListener('error', () => {
            /*
              Falhar a carregar deixa o próximo tentar outra vez: uma
              rede que voltou não devia obrigar a recarregar a página.
            */
            aCarregar = null;
            rejeitar(new Error('o script do Turnstile não carregou'));
        });

        document.head.append(etiqueta);
    });

    return aCarregar;
};

interface CaptchaProps {
    /** Chamado com o cartão, ou com `null` quando ele expira ou falha. */
    aoResponder: (cartao: string | null) => void;
}

export const Captcha = ({ aoResponder }: CaptchaProps) => {
    const t = useT();
    const caixa = useRef<HTMLDivElement | null>(null);
    const [chave, setChave] = useState<string | null>(null);

    /**
     * O script do Cloudflare não chegou.
     *
     * Precisa de ser dito. A instalação exige o cartão, o pedido vai
     * ser recusado, e a pessoa leria uma resposta sobre robôs sem nunca
     * ter visto nada a que responder — com um espaço em branco onde o
     * widget devia estar. Um bloqueador, uma rede de empresa ou uma
     * avaria do Cloudflare bastam para isto acontecer.
     */
    const [naoCarregou, setNaoCarregou] = useState(false);

    /**
     * A chave em referência, além do estado.
     *
     * O efeito que desenha o widget não deve voltar a correr por o
     * `aoResponder` ser outra função a cada render — e desenhar duas
     * vezes dá dois widgets.
     */
    const responder = useRef(aoResponder);
    responder.current = aoResponder;

    useEffect(() => {
        let vivo = true;

        void api<{ siteKey: string | null }>('/auth/captcha')
            .then((resposta) => {
                if (vivo) {
                    setChave(resposta.siteKey);
                }
            })
            .catch(() => {
                /*
                  Sem resposta, não se desenha nada e não se manda
                  cartão nenhum. Se a instalação exigir CAPTCHA, o
                  servidor recusa e a pessoa lê porquê — melhor do que
                  um widget partido a olhar para ela.
                */
            });

        return () => {
            vivo = false;
        };
    }, []);

    useEffect(() => {
        if (chave === null || caixa.current === null) {
            return;
        }

        const onde = caixa.current;
        let desenhado: string | null = null;
        let vivo = true;

        void carregarScript()
            .then(() => {
                const janela = window as JanelaComTurnstile;

                if (!vivo || !janela.turnstile) {
                    return;
                }

                desenhado = janela.turnstile.render(onde, {
                    sitekey: chave,
                    callback: (cartao) => responder.current(cartao),
                    /*
                      Um cartão do Turnstile dura minutos. Quem deixa o
                      formulário aberto e volta tem de ter outro, e
                      limpar aqui é o que impede o pedido de sair com um
                      cartão que o servidor vai recusar.
                    */
                    'expired-callback': () => responder.current(null),
                    'error-callback': () => responder.current(null),
                    theme: 'light',
                });
            })
            .catch(() => {
                responder.current(null);

                if (vivo) {
                    setNaoCarregou(true);
                }
            });

        return () => {
            vivo = false;

            const janela = window as JanelaComTurnstile;

            if (desenhado !== null && janela.turnstile) {
                janela.turnstile.remove(desenhado);
            }
        };
    }, [chave]);

    if (chave === null) {
        return null;
    }

    if (naoCarregou) {
        return <Alert kind="bad">{t.auth.captchaNaoCarregou}</Alert>;
    }

    return <div className="captcha" ref={caixa} />;
};
