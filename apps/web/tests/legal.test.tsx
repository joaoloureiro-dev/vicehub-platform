import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';

import { PrivacyPage, TermsPage } from '../src/legal/pages/legal.page.js';
import { Rodape } from '../src/components/rodape.js';
import {
    OPERATOR,
    operatorIsComplete,
    orPlaceholder,
    type LegalOperator,
} from '../src/legal/operator.js';
import { privacyDocument } from '../src/legal/privacy.document.js';
import { termsDocument } from '../src/legal/terms.document.js';
import { montarEcra, t } from './helpers.js';

const PREENCHIDO: LegalOperator = {
    legalName: 'Exemplo Unipessoal Lda',
    address: 'Rua de Exemplo 1, Lisboa, Portugal',
    registration: 'PT000000000',
    email: 'legal@exemplo.pt',
    jurisdiction: 'Portugal',
    hostingRegion: 'the European Union',
};

/** Todo o texto do documento, para procurar nele sem saber onde está. */
const corridoDe = (documento: {
    intro: readonly string[];
    sections: readonly { body: readonly string[]; list?: readonly string[] }[];
}): string =>
    [
        ...documento.intro,
        ...documento.sections.flatMap((seccao) => [
            ...seccao.body,
            ...(seccao.list ?? []),
        ]),
    ].join('\n');

/**
 * As páginas legais.
 *
 * O que aqui se prova não é redação — essa há-de mudar com a revisão do
 * João e de quem o aconselhar. É o que não pode mudar por descuido:
 *
 * - **que o documento diga que ainda não vincula**, enquanto não
 *   souber quem vincula;
 * - **que os campos por preencher se vejam**, em vez de desaparecerem
 *   no meio de uma frase que continua a ler-se a dizer menos;
 * - **que as duas cláusulas que são a razão de isto existir continuem
 *   lá**: a que diz que a tesouraria não é um serviço de pagamentos, e
 *   a que diz que não temos nada a ver com quem faz o jogo.
 */
describe('as páginas legais', () => {
    describe('enquanto a entidade não estiver preenchida', () => {
        it('a identidade em falta aparece marcada, e não em branco', () => {
            const texto = corridoDe(termsDocument(OPERATOR));

            expect(texto).toContain('[legal name]');
            expect(texto).toContain('[registered address]');
            expect(texto).toContain('[contact email]');
        });

        it('os termos dizem em cima que ainda não estão em vigor', () => {
            montarEcra(<TermsPage />);

            expect(screen.getByText(t.legal.rascunho)).toBeTruthy();
        });

        it('a privacidade diz o mesmo', () => {
            montarEcra(<PrivacyPage />);

            expect(screen.getByText(t.legal.rascunho)).toBeTruthy();
        });
    });

    describe('depois de preenchida', () => {
        it('deixa de haver campos marcados', () => {
            const texto = [
                corridoDe(termsDocument(PREENCHIDO)),
                corridoDe(privacyDocument(PREENCHIDO)),
            ].join('\n');

            expect(texto).not.toMatch(/\[[a-z][a-z ]+\]/);
            expect(texto).toContain('Exemplo Unipessoal Lda');
            expect(texto).toContain('legal@exemplo.pt');
        });

        it('a entidade passa a contar como completa', () => {
            expect(operatorIsComplete(PREENCHIDO)).toBe(true);
            expect(operatorIsComplete(OPERATOR)).toBe(false);
        });

        /**
         * Um espaço não é uma morada. Sem isto, um campo deixado com um
         * espaço a mais tirava o aviso da página sem preencher nada.
         */
        it('um campo só com espaços não conta como preenchido', () => {
            expect(
                operatorIsComplete({ ...PREENCHIDO, address: '   ' }),
            ).toBe(false);
            expect(orPlaceholder('   ', 'address')).toBe('[address]');
        });
    });

    describe('o que os termos não podem deixar de dizer', () => {
        /**
         * A tesouraria tem saldos, movimentos e aprovações. Sem esta
         * cláusula escrita onde o utilizador a lê, pode ser lida como
         * guarda de fundos alheios — que é uma actividade regulada, e
         * que o produto não faz: não há levantamento em lado nenhum.
         */
        it('que a tesouraria não é um serviço de pagamentos', () => {
            const texto = corridoDe(termsDocument(PREENCHIDO));

            expect(texto).toContain('not money');
            expect(texto).toMatch(/does not hold, transmit/);
        });

        /**
         * A apresentação nomeia o GTA VI nos quatro idiomas.
         */
        it('que não temos ligação a quem faz o jogo', () => {
            const texto = corridoDe(termsDocument(PREENCHIDO));

            expect(texto).toContain('Rockstar Games');
            expect(texto).toContain('not affiliated with');
        });

        /**
         * O direito de arrependimento de 14 dias não é uma cortesia: é
         * lei para consumidores na UE. Uma secção de reembolsos que o
         * perca pelo caminho passa a descrever menos do que a lei já
         * dá — e os testes dos títulos não dariam por isso, porque
         * percorrem as secções que existem e não as que têm de existir.
         */
        it('que há 14 dias para desistir da compra', () => {
            const texto = corridoDe(termsDocument(PREENCHIDO));

            expect(texto).toContain('14 days');
            expect(texto).toMatch(/consumer in the EU/);
        });

        it('que é preciso ter 16 anos', () => {
            expect(corridoDe(termsDocument(PREENCHIDO))).toContain(
                'at least 16 years old',
            );
        });
    });

    describe('o que a privacidade não pode deixar de dizer', () => {
        /**
         * Os dois cookies que o código escreve, pelo nome. Se um for
         * renomeado e esta linha não o acompanhar, a política passa a
         * descrever um cookie que não existe — e a calar o que existe.
         */
        it('nomeia os cookies que a plataforma mesmo põe', () => {
            const texto = corridoDe(privacyDocument(PREENCHIDO));

            expect(texto).toContain('vicehub_refresh_token');
            expect(texto).toContain('vicehub_discord_state');
            expect(texto).toContain('vicehub_google_state');
        });

        it('diz que não há análise de tráfego nem venda de dados', () => {
            const texto = corridoDe(privacyDocument(PREENCHIDO));

            expect(texto).toContain('No analytics');
            expect(texto).toMatch(/never sold/);
        });

        /**
         * A exportação e a eliminação existem mesmo, e são botões. Uma
         * política que as prometesse sem elas existirem era pior do que
         * uma que se calasse.
         */
        it('aponta para a exportação e a eliminação', () => {
            const texto = corridoDe(privacyDocument(PREENCHIDO));

            expect(texto).toContain('Take it with you');
            expect(texto).toContain('Delete it');
        });
    });

    describe('o documento no ecrã', () => {
        it('desenha todas as secções, e numera-as', () => {
            const documento = privacyDocument(OPERATOR);

            montarEcra(<PrivacyPage />);

            for (const seccao of documento.sections) {
                expect(screen.getByText(seccao.heading)).toBeTruthy();
            }

            expect(screen.getByText(`${documento.sections.length}.`)).toBeTruthy();
        });

        /**
         * Metade das cláusulas vive em listas, e não em parágrafos: a
         * utilização aceitável, os planos, os cookies. Os testes de
         * conteúdo leem os dados do documento — se a página deixasse de
         * desenhar as listas, eles continuavam verdes e as cláusulas
         * desapareciam do ecrã sem ninguém dar por isso.
         */
        it('desenha também o que está em lista, e não só os parágrafos', () => {
            montarEcra(<TermsPage />);

            expect(
                screen.getByText(/No harassment, threats, hate speech/),
            ).toBeTruthy();
            expect(
                screen.getByText(/Payments are handled by Stripe/),
            ).toBeTruthy();
        });

        it('diz que o inglês é o texto que vale', () => {
            montarEcra(<TermsPage />);

            expect(screen.getByText(t.legal.idioma)).toBeTruthy();
        });

        /**
         * Sem data não se sabe que versão se aceitou. Duas pessoas a
         * discordar sobre o que os termos diziam não teriam sequer como
         * saber se leram o mesmo documento.
         */
        it('mostra quando o texto mudou pela última vez', () => {
            const documento = termsDocument(OPERATOR);

            montarEcra(<TermsPage />);

            expect(
                screen.getByText(t.legal.atualizado(documento.updatedAt)),
            ).toBeTruthy();
        });

        /**
         * A introdução não é decoração: é onde está quem é a entidade
         * que o documento vincula. Perdê-la deixava um documento sem
         * dono a dizer que obriga quem o lê.
         */
        it('desenha a introdução, onde está quem isto vincula', () => {
            const [primeiro] = termsDocument(OPERATOR).intro;

            montarEcra(<TermsPage />);

            expect(screen.getByText(String(primeiro))).toBeTruthy();
            expect(screen.getByText(/ViceHub is operated by/)).toBeTruthy();
        });
    });

    describe('o rodapé', () => {
        /**
         * A razão concreta de o rodapé existir: a Stripe não activa uma
         * conta sem estes dois endereços alcançáveis de qualquer página.
         */
        it('leva aos dois documentos', () => {
            montarEcra(<Rodape />);

            expect(
                screen.getByText(t.legal.termos).getAttribute('href'),
            ).toBe('/termos');
            expect(
                screen.getByText(t.legal.privacidade).getAttribute('href'),
            ).toBe('/privacidade');
        });

        it('avisa que não temos ligação a quem faz o jogo', () => {
            montarEcra(<Rodape />);

            expect(screen.getByText(t.legal.marcas)).toBeTruthy();
        });
    });
});
