import { useEffect, useState, type FormEvent } from 'react';

import { Alert } from '../../auth/components/alert.js';
import { ApiError } from '../../lib/api.js';
import { useT } from '../../i18n/i18n.js';
import { updateCrew } from '../crew.api.js';
import type { CrewProfile } from '../crew.types.js';

interface CrewSettingsProps {
    crew: CrewProfile;
    aoGuardar: () => void;
}

/**
 * O que quem gere a crew pode corrigir depois de a criar.
 *
 * Existia na API desde o princípio e não havia por onde lá chegar: um
 * nome mal escrito ficava mal escrito, e o nome é único, por isso nem
 * criar outra crew resolvia.
 */
export const CrewSettings = ({ crew, aoGuardar }: CrewSettingsProps) => {
    const t = useT();

    const [nome, setNome] = useState(crew.name);
    const [descricao, setDescricao] = useState(crew.description ?? '');
    const [aGuardar, setAGuardar] = useState(false);
    const [mensagem, setMensagem] = useState<{
        tipo: 'good' | 'bad';
        texto: string;
    } | null>(null);

    /**
     * O perfil chega depois do primeiro render, e muda ao trocar de crew
     * sem sair da página. Sem isto, os campos ficavam com o que veio da
     * crew anterior.
     */
    useEffect(() => {
        setNome(crew.name);
        setDescricao(crew.description ?? '');
    }, [crew.name, crew.description]);

    /** O mesmo mínimo que a API exige, para o erro chegar antes do pedido. */
    const nomeCurto = nome.trim().length > 0 && nome.trim().length < 3;

    const submeter = async (event: FormEvent) => {
        event.preventDefault();
        setMensagem(null);
        setAGuardar(true);

        try {
            await updateCrew(crew.id, {
                name: nome.trim(),
                /** Vazio limpa a descrição; não a deixa como estava. */
                description: descricao.trim() || null,
            });

            setMensagem({ tipo: 'good', texto: t.crews.definicoesGuardadas });
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
                    falha instanceof ApiError && falha.code === 'CREW_NAME_TAKEN'
                        ? t.crews.nomeJaExiste
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
            <h2>{t.crews.definicoes}</h2>

            {mensagem ? <Alert kind={mensagem.tipo}>{mensagem.texto}</Alert> : null}

            <form onSubmit={(event) => void submeter(event)}>
                <div className="field">
                    <label htmlFor="crew-nome">{t.crews.nome}</label>
                    <input
                        id="crew-nome"
                        type="text"
                        value={nome}
                        aria-invalid={nomeCurto}
                        onChange={(event) => {
                            setNome(event.target.value);
                        }}
                    />
                </div>

                <div className="field">
                    <label htmlFor="crew-descricao">{t.crews.descricao}</label>
                    <textarea
                        id="crew-descricao"
                        rows={4}
                        maxLength={500}
                        value={descricao}
                        onChange={(event) => {
                            setDescricao(event.target.value);
                        }}
                    />
                </div>

                <button
                    className="primary"
                    type="submit"
                    disabled={aGuardar || nomeCurto || nome.trim().length === 0}
                >
                    {aGuardar ? t.comum.aGuardar : t.comum.guardar}
                </button>
            </form>
        </section>
    );
};
