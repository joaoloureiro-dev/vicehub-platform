import { useState, type FormEvent } from 'react';

import { Alert } from '../../auth/components/alert.js';
import { Field } from '../../auth/components/field.js';
import { useT } from '../../i18n/i18n.js';
import {
    CATEGORIAS,
    CORPO_MAXIMO,
    TITULO_MAXIMO,
    type CamposDoAnuncio,
    type CategoriaDeAnuncio,
} from '../market.api.js';

/**
 * O formulário de um anúncio, o mesmo para o pôr e para o mudar.
 *
 * Um só, e não dois: os campos são exatamente os mesmos, e duas cópias
 * é como um campo novo aparece a quem cria e falta a quem edita.
 */
interface FormularioProps {
    /** O que lá está, quando se está a editar. */
    inicial?: CamposDoAnuncio;
    /** O que o botão diz. Pôr à venda não é guardar alterações. */
    rotuloDoBotao: string;
    /**
     * O que se diz quando falha.
     *
     * Também não é o mesmo nos dois sítios: "não foi possível pôr o
     * anúncio" dito a quem estava a mudar o preço de um anúncio que já
     * lá está é uma frase a falar de outra coisa.
     */
    recursoDoErro: string;
    aoGravar: (campos: CamposDoAnuncio) => Promise<unknown>;
    aoCancelar?: () => void;
}

/**
 * Só algarismos, e é o mesmo que o servidor exige.
 *
 * Aqui a verificação existe para o erro chegar antes do pedido, e não
 * para substituir a de lá: quem escrever `12,50` fica a saber porquê
 * sem esperar por uma viagem à API.
 */
const SO_ALGARISMOS = /^\d+$/;

export const FormularioDeAnuncio = ({
    inicial,
    rotuloDoBotao,
    recursoDoErro,
    aoGravar,
    aoCancelar,
}: FormularioProps) => {
    const t = useT();

    const [categoria, setCategoria] = useState<CategoriaDeAnuncio>(
        inicial?.category ?? 'vehicle',
    );
    const [titulo, setTitulo] = useState(inicial?.title ?? '');
    const [corpo, setCorpo] = useState(inicial?.body ?? '');
    const [preco, setPreco] = useState(inicial?.price ?? '');
    const [imagem, setImagem] = useState(inicial?.imageUrl ?? '');
    const [aGravar, setAGravar] = useState(false);
    const [erro, setErro] = useState<string | null>(null);

    const gravar = async (evento: FormEvent) => {
        evento.preventDefault();
        setErro(null);

        if (!SO_ALGARISMOS.test(preco.trim())) {
            setErro(t.mercado.precoInvalido);

            return;
        }

        setAGravar(true);

        try {
            await aoGravar({
                category: categoria,
                title: titulo,
                body: corpo,
                price: preco.trim(),
                /**
                 * Sem endereço escrito é `null` e não uma cadeia vazia:
                 * vazio não é um endereço, e mandá-lo fazia a API
                 * recusar um anúncio a que ninguém quis pôr imagem.
                 */
                imageUrl: imagem.trim() === '' ? null : imagem.trim(),
            });
        } catch {
            setErro(recursoDoErro);
        } finally {
            setAGravar(false);
        }
    };

    return (
        <form className="anuncio-form" onSubmit={gravar}>
            <div className="field">
                <label htmlFor="anuncio-categoria">
                    {t.mercado.categoriaLabel}
                </label>
                <select
                    id="anuncio-categoria"
                    value={categoria}
                    onChange={(evento) => {
                        setCategoria(evento.target.value as CategoriaDeAnuncio);
                    }}
                >
                    {CATEGORIAS.map((uma) => (
                        <option key={uma} value={uma}>
                            {t.mercado.categorias[uma]}
                        </option>
                    ))}
                </select>
            </div>

            <Field
                id="anuncio-titulo"
                label={t.mercado.tituloDoAnuncio}
                type="text"
                value={titulo}
                onChange={setTitulo}
                maxLength={TITULO_MAXIMO}
            />

            <div className="field">
                <label htmlFor="anuncio-corpo">
                    {t.mercado.corpoDoAnuncio}
                </label>
                <textarea
                    id="anuncio-corpo"
                    rows={6}
                    maxLength={CORPO_MAXIMO}
                    value={corpo}
                    onChange={(evento) => {
                        setCorpo(evento.target.value);
                    }}
                />
            </div>

            {/*
              O preço é um campo de texto com teclado numérico, e não um
              `type="number"`: um `number` aceita `1e6` e vírgulas
              conforme o idioma do browser, e o que a API quer são
              algarismos e mais nada.
            */}
            <Field
                id="anuncio-preco"
                label={t.mercado.preco}
                type="text"
                inputMode="numeric"
                value={preco}
                onChange={setPreco}
                hint={t.mercado.precoAjuda}
            />

            <Field
                id="anuncio-imagem"
                label={t.mercado.imagem}
                type="url"
                value={imagem}
                onChange={setImagem}
                required={false}
                hint={t.mercado.imagemAjuda}
            />

            {erro ? <Alert kind="bad">{erro}</Alert> : null}

            <div className="grupo-botoes">
                <button className="primary" type="submit" disabled={aGravar}>
                    {aGravar ? t.comum.aGuardar : rotuloDoBotao}
                </button>
                {aoCancelar ? (
                    <button
                        className="btn-secondary"
                        type="button"
                        onClick={aoCancelar}
                    >
                        {t.mercado.cancelar}
                    </button>
                ) : null}
            </div>
        </form>
    );
};
