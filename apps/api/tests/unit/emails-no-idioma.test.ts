import { describe, expect, it } from 'vitest';

import {
    IDIOMAS,
    IDIOMA_POR_OMISSAO,
    idiomaOuOmissao,
} from '../../src/modules/mail/idiomas.js';
import {
    emailDeConfirmacao,
    emailDeRecuperacao,
} from '../../src/modules/mail/mensagens.js';

/**
 * O email sai na língua de quem o recebe.
 *
 * Estavam os dois escritos à mão em português. Quem usasse a plataforma
 * em inglês, francês ou espanhol e pedisse para recuperar a password
 * recebia português — no momento exato em que estava trancado fora da
 * conta e mais precisava de perceber o que estava a ler.
 *
 * Havia até um teste a defender esta regra do lado do ecrã, o
 * `um-idioma-so.test.ts` da web, e o comentário dele diz que o português
 * da API "serve quem lê registos e quem escreve código". Um email não é
 * nenhuma das duas coisas. Era o buraco na regra que esse teste existe
 * para guardar.
 */
const DADOS = {
    username: 'kestrel',
    link: 'https://vicehub.example/recuperar-password?token=abc',
    horas: 2,
};

describe('os emails da plataforma', () => {
    it.each(IDIOMAS)('a recuperação existe em %s', (idioma) => {
        const email = emailDeRecuperacao(idioma, DADOS);

        expect(email.subject.length).toBeGreaterThan(0);
        expect(email.text).toContain(DADOS.link);
        expect(email.text).toContain(DADOS.username);
    });

    it.each(IDIOMAS)('a confirmação existe em %s', (idioma) => {
        const email = emailDeConfirmacao(idioma, DADOS);

        expect(email.subject.length).toBeGreaterThan(0);
        expect(email.text).toContain(DADOS.link);
        expect(email.text).toContain(DADOS.username);
    });

    /**
     * O prazo é um número que muda com a configuração, e por isso tem de
     * aparecer em todas as versões. Uma tradução que o esquecesse dizia
     * a quem a lê que o link não expira.
     */
    it.each(IDIOMAS)('a recuperação diz o prazo em %s', (idioma) => {
        expect(emailDeRecuperacao(idioma, DADOS).text).toContain('2');
    });

    /**
     * E nenhuma das quatro versões é a mesma frase.
     *
     * É a maneira de apanhar uma tradução por fazer: copiar o inglês
     * para o francês compila, passa em todos os outros testes, e só se
     * nota quando o email já saiu.
     */
    it('não tem duas versões iguais', () => {
        const assuntos = IDIOMAS.map(
            (idioma) => emailDeRecuperacao(idioma, DADOS).subject,
        );

        expect(new Set(assuntos).size).toBe(IDIOMAS.length);

        const corpos = IDIOMAS.map(
            (idioma) => emailDeConfirmacao(idioma, DADOS).text,
        );

        expect(new Set(corpos).size).toBe(IDIOMAS.length);
    });
});

describe('o idioma pedido', () => {
    it.each(IDIOMAS)('%s é aceite', (idioma) => {
        expect(idiomaOuOmissao(idioma)).toBe(idioma);
    });

    /**
     * Um pedido sem idioma, ou com um que não existe, sai em inglês.
     *
     * Em inglês e não em português: o produto abre em inglês, e escolher
     * a língua de quem fez a plataforma em vez da de quem a usa é
     * precisamente o erro que isto veio corrigir. E não dá erro, porque
     * recusar um pedido de recuperação de password por causa da língua
     * seria trancar alguém à porta por uma questão de forma.
     */
    it.each([undefined, '', 'de', 'pt-BR', 'EN'])(
        '%s cai no idioma por omissão',
        (pedido) => {
            expect(idiomaOuOmissao(pedido)).toBe(IDIOMA_POR_OMISSAO);
        },
    );

    it('e o idioma por omissão é inglês, como o produto', () => {
        expect(IDIOMA_POR_OMISSAO).toBe('en');
    });
});
