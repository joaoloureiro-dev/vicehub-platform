import { useEffect, useState, type FormEvent } from 'react';

import { Alert } from '../../auth/components/alert.js';
import { ApiError } from '../../lib/api.js';
import { useT } from '../../i18n/i18n.js';
import { updateServer } from '../server.api.js';
import type { ServerProfile } from '../server.types.js';

interface ServerSettingsProps {
    servidor: ServerProfile;
    aoGuardar: () => void;
}

/**
 * O que quem gere o servidor pode corrigir depois de o registar.
 *
 * O **estado online** é o que mais falta fazia: aparece no perfil, e é
 * por ele que o diretório filtra. Sem esta rota alcançável, dizia sempre
 * o mesmo e ninguém o podia corrigir.
 */
export const ServerSettings = ({ servidor, aoGuardar }: ServerSettingsProps) => {
    const t = useT();

    const [nome, setNome] = useState(servidor.name);
    const [regiao, setRegiao] = useState(servidor.region ?? '');
    const [descricao, setDescricao] = useState(servidor.description ?? '');
    const [online, setOnline] = useState(servidor.isOnline);
    const [aGuardar, setAGuardar] = useState(false);
    const [mensagem, setMensagem] = useState<{
        tipo: 'good' | 'bad';
        texto: string;
    } | null>(null);

    useEffect(() => {
        setNome(servidor.name);
        setRegiao(servidor.region ?? '');
        setDescricao(servidor.description ?? '');
        setOnline(servidor.isOnline);
    }, [
        servidor.name,
        servidor.region,
        servidor.description,
        servidor.isOnline,
    ]);

    const nomeCurto = nome.trim().length > 0 && nome.trim().length < 3;

    /**
     * A API exige dois caracteres na região quando ela vem preenchida.
     * Um só seria recusado depois de carregar em guardar.
     */
    const regiaoCurta = regiao.trim().length === 1;

    const submeter = async (event: FormEvent) => {
        event.preventDefault();
        setMensagem(null);
        setAGuardar(true);

        try {
            await updateServer(servidor.id, {
                name: nome.trim(),
                region: regiao.trim() || null,
                description: descricao.trim() || null,
                isOnline: online,
            });

            setMensagem({ tipo: 'good', texto: t.servidores.definicoesGuardadas });
            aoGuardar();
        } catch (falha) {
            /**
             * O nome repetido é o único erro que este formulário produz
             * com frequência, e a mensagem da API vem numa língua só.
             * Traduzida aqui, chega a quem lê na sua.
             */
            setMensagem({
                tipo: 'bad',
                texto:
                    falha instanceof ApiError &&
                    falha.code === 'SERVER_NAME_TAKEN'
                        ? t.servidores.nomeJaExiste
                        : falha instanceof ApiError
                          ? falha.message
                          : t.comum.naoFoiPossivel,
            });
        } finally {
            setAGuardar(false);
        }
    };

    return (
        <section className="grupo">
            <h2>{t.servidores.definicoes}</h2>

            {mensagem ? <Alert kind={mensagem.tipo}>{mensagem.texto}</Alert> : null}

            <form onSubmit={(event) => void submeter(event)}>
                <div className="field">
                    <label htmlFor="servidor-nome">{t.servidores.nome}</label>
                    <input
                        id="servidor-nome"
                        type="text"
                        value={nome}
                        aria-invalid={nomeCurto}
                        onChange={(event) => {
                            setNome(event.target.value);
                        }}
                    />
                </div>

                <div className="field">
                    <label htmlFor="servidor-regiao">{t.servidores.regiao}</label>
                    <input
                        id="servidor-regiao"
                        type="text"
                        value={regiao}
                        placeholder="EU"
                        aria-invalid={regiaoCurta}
                        onChange={(event) => {
                            setRegiao(event.target.value);
                        }}
                    />
                </div>

                <div className="field">
                    <label htmlFor="servidor-descricao">
                        {t.servidores.descricao}
                    </label>
                    <textarea
                        id="servidor-descricao"
                        rows={4}
                        maxLength={500}
                        value={descricao}
                        onChange={(event) => {
                            setDescricao(event.target.value);
                        }}
                    />
                </div>

                {/*
                  A mesma caixa do filtro do diretório, e de propósito: é
                  o mesmo estado dos dois lados, e quem o liga aqui
                  reconhece-o lá.
                */}
                <label className="filtro">
                    <input
                        type="checkbox"
                        checked={online}
                        onChange={(event) => {
                            setOnline(event.target.checked);
                        }}
                    />
                    {t.servidores.estaOnline}
                </label>

                <button
                    className="primary"
                    type="submit"
                    disabled={
                        aGuardar ||
                        nomeCurto ||
                        regiaoCurta ||
                        nome.trim().length === 0
                    }
                >
                    {aGuardar ? t.comum.aGuardar : t.comum.guardar}
                </button>
            </form>
        </section>
    );
};
