import { useState, type FormEvent } from 'react';

import { Alert } from '../../auth/components/alert.js';
import { useT } from '../../i18n/i18n.js';
import { mensagemDoErro } from '../../lib/erro.js';
import {
    AVALIACAO_MAXIMA,
    AVALIACAO_MINIMA,
    AVALIACAO_TEXTO_MAXIMO,
    createReview,
} from '../avaliacoes.api.js';

/**
 * Avaliar uma venda.
 *
 * Fechado por omissão, como a denúncia: a coisa mais comum ao abrir um
 * anúncio vendido é não se ter nada a dizer sobre ele, e um formulário
 * aberto convidava quem passa a pôr uma nota por passar.
 *
 * Quem **pode** avaliar decide-se na API — tem de ter falado com quem
 * vendeu sobre aquele anúncio. O botão aparece a toda a gente que não
 * vendeu, e a recusa é dita por palavras: esconder o botão deixava a
 * pessoa sem saber o que lhe faltava.
 */
const NOTAS = Array.from(
    { length: AVALIACAO_MAXIMA - AVALIACAO_MINIMA + 1 },
    (_, indice) => AVALIACAO_MINIMA + indice,
);

export const FormularioDeAvaliacao = ({
    listingId,
    aoAvaliar,
}: {
    listingId: string;
    aoAvaliar: () => void;
}) => {
    const t = useT();

    const [aberto, setAberto] = useState(false);
    const [nota, setNota] = useState(AVALIACAO_MAXIMA);
    const [texto, setTexto] = useState('');
    const [aEnviar, setAEnviar] = useState(false);
    const [erro, setErro] = useState<string | null>(null);
    const [feito, setFeito] = useState(false);

    if (feito) {
        return <p className="hint">{t.mercado.avaliacaoPublica}</p>;
    }

    if (!aberto) {
        return (
            <div className="grupo-botoes">
                <button
                    className="btn-secondary"
                    type="button"
                    onClick={() => {
                        setAberto(true);
                    }}
                >
                    {t.mercado.avaliar}
                </button>
            </div>
        );
    }

    const enviar = async (evento: FormEvent) => {
        evento.preventDefault();
        setErro(null);
        setAEnviar(true);

        try {
            await createReview(
                listingId,
                nota,
                texto.trim() === '' ? undefined : texto.trim(),
            );

            setFeito(true);
            aoAvaliar();
        } catch (falha) {
            setErro(mensagemDoErro(falha, t, t.mercado.naoFoiPossivelAvaliar));
        } finally {
            setAEnviar(false);
        }
    };

    return (
        <form className="anuncio-form" onSubmit={enviar}>
            {/*
              A promessa antes de se escrever: é pública, e quem vendeu
              tem direito a responder. Depois de enviada já não serve de
              aviso nenhum.
            */}
            <p className="hint">{t.mercado.avaliacaoPublica}</p>

            <fieldset>
                <legend>{t.mercado.aNota}</legend>

                {NOTAS.map((uma) => (
                    <label key={uma} className="escolha">
                        <input
                            type="radio"
                            name="nota"
                            value={uma}
                            checked={nota === uma}
                            onChange={() => {
                                setNota(uma);
                            }}
                        />
                        <span>{t.mercado.estrelas(uma)}</span>
                    </label>
                ))}
            </fieldset>

            <div className="field">
                <label htmlFor="comentario">{t.mercado.oComentario}</label>
                <textarea
                    id="comentario"
                    rows={4}
                    maxLength={AVALIACAO_TEXTO_MAXIMO}
                    value={texto}
                    onChange={(evento) => {
                        setTexto(evento.target.value);
                    }}
                />
            </div>

            {erro ? <Alert kind="bad">{erro}</Alert> : null}

            <div className="grupo-botoes">
                <button className="primary" type="submit" disabled={aEnviar}>
                    {aEnviar ? t.comum.aGuardar : t.mercado.enviarAvaliacao}
                </button>
                <button
                    className="btn-secondary"
                    type="button"
                    onClick={() => {
                        setAberto(false);
                        setErro(null);
                    }}
                >
                    {t.mercado.cancelar}
                </button>
            </div>
        </form>
    );
};
