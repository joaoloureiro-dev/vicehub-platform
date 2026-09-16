import { useT } from '../../i18n/i18n.js';
import { OPERATOR, operatorIsComplete } from '../operator.js';
import { privacyDocument } from '../privacy.document.js';
import { termsDocument } from '../terms.document.js';
import type { LegalDocument } from '../legal-document.js';

/**
 * Um documento legal no ecrã.
 *
 * A mesma página desenha os dois. Duas páginas quase iguais divergiam:
 * uma ganhava um espaçamento, um aviso ou um cabeçalho que a outra não
 * tinha, e a diferença entre a página dos termos e a da privacidade
 * acabava por ser acidental em vez de decidida.
 *
 * As secções são numeradas aqui, e não escritas com número no texto: um
 * documento legal cita-se por número, e um número escrito à mão em cada
 * título fica errado assim que se insere uma secção pelo meio.
 */
const Documento = ({ documento }: { documento: LegalDocument }) => {
    const t = useT();
    const completo = operatorIsComplete(OPERATOR);

    return (
        <article className="legal">
            <h1>{documento.title}</h1>
            <p className="legal-data">{t.legal.atualizado(documento.updatedAt)}</p>

            {/*
              Enquanto faltar a identidade da entidade, isto diz-se em
              cima e em destaque.

              Um documento com a firma por preencher não é um documento
              a que falta um pormenor: é um texto que afirma vincular
              quem o lê sem dizer a quem. Publicá-lo calado era pior do
              que não o publicar.
            */}
            {completo ? null : (
                <aside className="legal-rascunho" role="note">
                    <b>{t.legal.rascunho}</b>
                    <p>{t.legal.rascunhoTexto}</p>
                </aside>
            )}

            <p className="hint legal-idioma">{t.legal.idioma}</p>

            {documento.intro.map((paragrafo) => (
                <p key={paragrafo}>{paragrafo}</p>
            ))}

            {documento.sections.map((seccao, indice) => (
                <section key={seccao.heading}>
                    <h2>
                        <span className="legal-numero">{indice + 1}.</span>{' '}
                        {seccao.heading}
                    </h2>

                    {seccao.body.map((paragrafo) => (
                        <p key={paragrafo}>{paragrafo}</p>
                    ))}

                    {seccao.list === undefined ? null : (
                        <ul>
                            {seccao.list.map((item) => (
                                <li key={item}>{item}</li>
                            ))}
                        </ul>
                    )}
                </section>
            ))}
        </article>
    );
};

export const TermsPage = () => <Documento documento={termsDocument(OPERATOR)} />;

export const PrivacyPage = () => (
    <Documento documento={privacyDocument(OPERATOR)} />
);
