import { Link } from 'react-router';

import { useT, useIdioma } from '../../i18n/i18n.js';
import {
    formatarMontante,
    separadorDoIdioma,
} from '../../treasury/treasury.types.js';
import type { AnuncioResumo } from '../market.api.js';
import { NotaDoVendedor } from './nota-do-vendedor.js';

/**
 * Um anúncio na grelha do mercado.
 *
 * O preço é o que se lê primeiro, e por isso é o que está em maior: a
 * pergunta de quem percorre um mercado é sempre quanto custa.
 *
 * O montante passa por `formatarMontante`, o mesmo da tesouraria: é
 * texto a entrar e texto a sair, sem nunca virar número. Um preço de
 * novecentos mil milhões que passasse por `Number` voltava arredondado.
 */
export const CartaoDeAnuncio = ({ anuncio }: { anuncio: AnuncioResumo }) => {
    const t = useT();
    const { idioma } = useIdioma();

    return (
        <li className="card anuncio">
            <Link to={`/mercado/${anuncio.id}`}>
                {/*
                  A imagem é de quem anunciou e pode não carregar — o
                  endereço é dele e o ViceHub não o aloja. Sem imagem a
                  grelha continua a ler-se: o que aqui manda é o preço.
                */}
                {anuncio.imageUrl ? (
                    <img
                        className="anuncio-imagem"
                        src={anuncio.imageUrl}
                        alt=""
                        loading="lazy"
                    />
                ) : null}

                <p className="anuncio-preco">
                    {formatarMontante(
                        anuncio.price,
                        separadorDoIdioma(idioma),
                    )}
                </p>

                <h3>{anuncio.title}</h3>
            </Link>

            <p className="hint">
                {t.mercado.categorias[anuncio.category]}
                {' · '}
                {anuncio.seller?.username ?? t.mercado.contaApagada}
                {' '}
                <NotaDoVendedor nota={anuncio.sellerRating} />
                {anuncio.status === 'open'
                    ? ''
                    : ` · ${t.mercado.estados[anuncio.status]}`}
            </p>
        </li>
    );
};
