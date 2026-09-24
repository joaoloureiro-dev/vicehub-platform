import { useState, type FormEvent } from 'react';

import { ApiError } from '../lib/api.js';
import { mensagemDoErro } from '../lib/erro.js';
import { Alert } from '../auth/components/alert.js';
import { useT } from '../i18n/i18n.js';
import { NOTA_MAXIMA, type RazaoDaDenuncia } from './moderation.api.js';

/**
 * Denunciar uma publicação.
 *
 * Um componente só para as três espécies de alvo — uma pergunta, uma
 * resposta, um anúncio. Quem denuncia está a fazer a mesma coisa nos
 * três sítios, e três formulários seriam três listas de razões a
 * divergir.
 *
 * Um botão que abre um formulário pequeno, e não um clique único. A
 * razão é o que o moderador lê primeiro, e pedi-la aqui é a diferença
 * entre uma fila ordenável e uma lista de "alguém não gostou disto".
 *
 * Fechado por omissão: numa página de fórum a coisa mais comum é
 * ninguém querer denunciar nada, e um formulário aberto ao lado de cada
 * resposta transformava a leitura num painel de administração.
 */
const RAZOES: RazaoDaDenuncia[] = ['spam', 'abuse', 'off_topic', 'other'];

interface DenunciarProps {
    /** Chamado com a razão e a nota. Quem denuncia o quê é de quem chama. */
    aoDenunciar: (razao: RazaoDaDenuncia, nota: string) => Promise<unknown>;
}

export const Denunciar = ({ aoDenunciar }: DenunciarProps) => {
    const t = useT();

    const [aberto, setAberto] = useState(false);
    const [razao, setRazao] = useState<RazaoDaDenuncia>('spam');
    const [nota, setNota] = useState('');
    const [aEnviar, setAEnviar] = useState(false);
    const [erro, setErro] = useState<string | null>(null);
    const [feito, setFeito] = useState(false);

    /**
     * Feito é um estado final, e de propósito.
     *
     * Uma segunda denúncia da mesma pessoa à mesma publicação é recusada
     * pela API, e mostrar o formulário outra vez convidava-a a tentar.
     */
    if (feito) {
        return <p className="hint denuncia-feita">{t.moderacao.denunciaRecebida}</p>;
    }

    if (!aberto) {
        return (
            <button
                className="btn-secondary"
                type="button"
                onClick={() => {
                    setAberto(true);
                }}
            >
                {t.moderacao.denunciar}
            </button>
        );
    }

    const enviar = async (evento: FormEvent) => {
        evento.preventDefault();
        setErro(null);
        setAEnviar(true);

        try {
            await aoDenunciar(razao, nota.trim());
            setFeito(true);
        } catch (falha) {
            /**
             * "Já denunciaste isto" não é uma falha para quem carregou
             * no botão: o aviso chegou na mesma, da primeira vez.
             */
            if (falha instanceof ApiError && falha.code === 'ALREADY_REPORTED') {
                setFeito(true);

                return;
            }

            setErro(mensagemDoErro(falha, t, t.moderacao.naoFoiPossivelDenunciar));
        } finally {
            setAEnviar(false);
        }
    };

    return (
        <form className="denuncia" onSubmit={enviar}>
            <fieldset>
                <legend>{t.moderacao.porqueDenuncias}</legend>

                {RAZOES.map((uma) => (
                    <label key={uma} className="escolha">
                        <input
                            type="radio"
                            name="razao"
                            value={uma}
                            checked={razao === uma}
                            onChange={() => {
                                setRazao(uma);
                            }}
                        />
                        <span>{t.moderacao.razoes[uma]}</span>
                    </label>
                ))}
            </fieldset>

            <label className="field">
                <span>{t.moderacao.notaDaDenuncia}</span>
                <textarea
                    rows={3}
                    maxLength={NOTA_MAXIMA}
                    value={nota}
                    onChange={(evento) => {
                        setNota(evento.target.value);
                    }}
                />
            </label>

            {erro ? <Alert kind="bad">{erro}</Alert> : null}

            <div className="grupo-botoes">
                <button className="primary" type="submit" disabled={aEnviar}>
                    {aEnviar ? t.comum.aGuardar : t.moderacao.enviarDenuncia}
                </button>
                <button
                    className="btn-secondary"
                    type="button"
                    onClick={() => {
                        setAberto(false);
                        setErro(null);
                    }}
                >
                    {t.moderacao.cancelarDenuncia}
                </button>
            </div>
        </form>
    );
};
