import { useEffect, useState, type FormEvent } from 'react';

import { Alert } from '../auth/components/alert.js';
import { ApiError } from '../lib/api.js';
import { useT } from '../i18n/i18n.js';

/**
 * Hexadecimal de seis dígitos, tal como a API o exige.
 *
 * A forma curta (#abc) fica de fora dos dois lados: aceitá-la aqui
 * mandaria para a API um valor que ela recusa, e o erro apareceria
 * depois de o utilizador carregar em guardar.
 */
const COR_VALIDA = /^#[0-9A-Fa-f]{6}$/;

export interface Appearance {
    bannerUrl: string | null;
    accentColor: string | null;
}

interface AppearanceFormProps {
    /** O que está gravado. Só é mostrado enquanto houver plano ativo. */
    atual: Appearance;
    /** Prefixo dos `id` dos campos, para dois formulários na mesma página. */
    prefixo: string;
    guardar: (input: Appearance) => Promise<unknown>;
    aoGuardar: () => void;
}

/**
 * O formulário da personalização, um só para pessoas, crews e servidores.
 *
 * Vive num sítio porque as regras são as mesmas nos três: a cor é um
 * hexadecimal de seis dígitos, o campo vazio limpa em vez de deixar como
 * está, e **um 402 não é avaria** — é a API a dizer que isto é do plano.
 * Três cópias divergiriam, e a que divergisse mostraria um erro genérico
 * onde devia dizer o que falta.
 */
export const AppearanceForm = ({
    atual,
    prefixo,
    guardar,
    aoGuardar,
}: AppearanceFormProps) => {
    const t = useT();

    const [banner, setBanner] = useState(atual.bannerUrl ?? '');
    const [cor, setCor] = useState(atual.accentColor ?? '');
    const [aGuardar, setAGuardar] = useState(false);
    const [mensagem, setMensagem] = useState<{
        tipo: 'good' | 'bad';
        texto: string;
    } | null>(null);

    /**
     * O que está gravado chega depois do primeiro render, e pode mudar
     * ao trocar de crew sem sair da página. Sem isto, os campos ficavam
     * com o que veio da crew anterior.
     */
    useEffect(() => {
        setBanner(atual.bannerUrl ?? '');
        setCor(atual.accentColor ?? '');
    }, [atual.bannerUrl, atual.accentColor]);

    const corMa = cor.length > 0 && !COR_VALIDA.test(cor);

    const submeter = async (event: FormEvent) => {
        event.preventDefault();
        setMensagem(null);
        setAGuardar(true);

        try {
            await guardar({
                bannerUrl: banner.trim() || null,
                accentColor: cor.trim() || null,
            });

            setMensagem({
                tipo: 'good',
                texto: t.perfil.personalizacaoGuardada,
            });

            aoGuardar();
        } catch (falha) {
            /**
             * 402 não é avaria: é a API a dizer que isto é do plano.
             * Distingui-lo dá uma mensagem útil em vez de um erro
             * genérico que ninguém sabe o que fazer com ele.
             */
            setMensagem({
                tipo: 'bad',
                texto:
                    falha instanceof ApiError && falha.status === 402
                        ? t.perfil.ehPremium
                        : falha instanceof ApiError
                          ? falha.message
                          : t.perfil.naoFoiPossivelPersonalizacao,
            });
        } finally {
            setAGuardar(false);
        }
    };

    return (
        <>
            {mensagem ? <Alert kind={mensagem.tipo}>{mensagem.texto}</Alert> : null}

            <form onSubmit={(event) => void submeter(event)}>
                <div className="field">
                    <label htmlFor={`${prefixo}-banner`}>{t.perfil.banner}</label>
                    <input
                        id={`${prefixo}-banner`}
                        type="url"
                        value={banner}
                        placeholder="https://…"
                        onChange={(event) => {
                            setBanner(event.target.value);
                        }}
                    />
                </div>

                <div className="field">
                    <label htmlFor={`${prefixo}-cor`}>{t.perfil.cor}</label>
                    <div className="cor-linha">
                        <input
                            id={`${prefixo}-cor`}
                            type="text"
                            value={cor}
                            placeholder="#E93CEF"
                            aria-invalid={corMa}
                            aria-describedby={`${prefixo}-cor-hint`}
                            onChange={(event) => {
                                setCor(event.target.value);
                            }}
                        />
                        <span
                            className="amostra"
                            aria-hidden="true"
                            style={
                                COR_VALIDA.test(cor) ? { background: cor } : undefined
                            }
                        />
                    </div>
                    <p className="hint" id={`${prefixo}-cor-hint`}>
                        {t.perfil.corAjuda}
                    </p>
                </div>

                <button className="primary" type="submit" disabled={aGuardar || corMa}>
                    {aGuardar ? t.comum.aGuardar : t.perfil.guardarPersonalizacao}
                </button>
            </form>
        </>
    );
};
