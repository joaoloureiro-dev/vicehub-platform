import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';

import { Alert } from '../auth/components/alert.js';
import { useT } from '../i18n/i18n.js';
import { ApiError } from '../lib/api.js';

interface ApagarComunidadeProps {
    tipo: 'crew' | 'servidor';

    /** O nome que se escreve para confirmar. */
    nome: string;

    apagar: () => Promise<void>;
}

/**
 * Apagar uma crew ou um servidor.
 *
 * Escrever o nome é a única confirmação, e é de propósito que não é um
 * "tens a certeza?": um botão de confirmação a seguir a um botão é dois
 * cliques no mesmo sítio, e quem carregou por engano no primeiro carrega
 * por engano no segundo. Escrever o nome obriga a olhar para o que se
 * está a apagar.
 *
 * As recusas da API não são falhas desta página: cada uma diz uma coisa
 * que se desfaz — dividir o saldo, decidir os movimentos, cancelar o
 * plano — e por isso são mostradas como estão, e não como "não foi
 * possível".
 */
export const ApagarComunidade = ({
    tipo,
    nome,
    apagar,
}: ApagarComunidadeProps) => {
    const t = useT();
    const navegar = useNavigate();

    const [escrito, setEscrito] = useState('');
    const [aApagar, setAApagar] = useState(false);
    const [erro, setErro] = useState<string | null>(null);

    const textos
        = tipo === 'crew'
            ? {
                titulo: t.zonaPerigo.crewTitulo,
                explicacao: t.zonaPerigo.crewExplicacao,
                saldo: 'CREW_HAS_FUNDS',
                decisoes: 'CREW_HAS_OPEN_DECISIONS',
                plano: 'CREW_HAS_ACTIVE_PLAN',
            }
            : {
                titulo: t.zonaPerigo.servidorTitulo,
                explicacao: t.zonaPerigo.servidorExplicacao,
                saldo: 'SERVER_HAS_FUNDS',
                decisoes: 'SERVER_HAS_OPEN_DECISIONS',
                plano: 'SERVER_HAS_ACTIVE_PLAN',
            };

    /** Sem espaços à volta: colar o nome traz-lhe um a mais com frequência. */
    const confere = escrito.trim() === nome;

    const submeter = async (event: FormEvent) => {
        event.preventDefault();

        if (!confere) { return; }

        setErro(null);
        setAApagar(true);

        try {
            await apagar();

            /*
              Ficar na página de uma coisa que já não existe daria um
              "não encontrámos" a seguir a uma ação bem sucedida.
            */
            navegar('/eu/comunidades', { replace: true });
        } catch (falha) {
            const codigo = falha instanceof ApiError ? falha.code : null;

            setErro(
                codigo === textos.saldo
                    ? t.zonaPerigo.temSaldo
                    : codigo === textos.decisoes
                      ? t.zonaPerigo.temDecisoes
                      : codigo === textos.plano
                        ? t.zonaPerigo.temPlano
                        : t.zonaPerigo.naoFoiPossivel,
            );

            setAApagar(false);
        }
    };

    const campo = `apagar-${tipo}`;

    return (
        <section className="grupo perigo">
            <h2>{textos.titulo}</h2>

            <p className="hint">{textos.explicacao}</p>

            {erro ? <Alert kind="bad">{erro}</Alert> : null}

            <form onSubmit={(event) => void submeter(event)}>
                <div className="field">
                    <label htmlFor={campo}>{t.zonaPerigo.confirmacao}</label>
                    <input
                        id={campo}
                        type="text"
                        autoComplete="off"
                        value={escrito}
                        placeholder={nome}
                        onChange={(event) => {
                            setEscrito(event.target.value);
                        }}
                    />
                    <p className="hint">{t.zonaPerigo.escreveONome(nome)}</p>
                </div>

                <button
                    className="btn-secondary perigo"
                    type="submit"
                    disabled={!confere || aApagar}
                >
                    {aApagar ? t.zonaPerigo.aApagar : t.zonaPerigo.botao}
                </button>
            </form>
        </section>
    );
};
