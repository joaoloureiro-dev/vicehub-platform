import { describe, expect, it } from 'vitest';

// @ts-expect-error -- é um script, e não faz parte do build da API.
import { legivel, resumir } from '../../scripts/caixa-de-correio.mjs';

/**
 * A caixa de correio de mentira lê o que a API manda.
 *
 * `scripts/caixa-de-correio.mjs` existe para se ver, antes de um
 * deploy, o que sai mesmo pelo SMTP: quem manda, para quem, e o
 * endereço dos links. Se ela lesse mal, o erro que devia apanhar —
 * links a apontar para a máquina de quem fez o deploy — passava por
 * mensagem boa, e ninguém dava por isso até alguém não conseguir
 * recuperar a palavra-passe.
 *
 * Correr a caixa precisa de uma porta; ler uma mensagem não. É essa
 * metade que o CI guarda.
 */
const MENSAGEM = [
    'From: ViceHub <no-reply@vicehub.com>',
    'To: alguem@exemplo.com',
    'Subject: Reset your ViceHub password',
    'Content-Type: text/plain; charset=utf-8',
    'Content-Transfer-Encoding: quoted-printable',
    '',
    'Ol=C3=A1! Para definir uma palavra-passe nova, segue este link:',
    /* O `=3D` é como um `=` viaja em quoted-printable. */
    'https://vicehub.com/recuperar-password?token=3Dabc123',
    '',
    'Se n=C3=A3o foste tu, ignora este email.',
].join('\n');

describe('a caixa de correio de mentira', () => {
    it('lê quem manda, para quem, e o assunto', () => {
        const { de, para, assunto } = resumir(MENSAGEM);

        expect(de).toBe('ViceHub <no-reply@vicehub.com>');
        expect(para).toBe('alguem@exemplo.com');
        expect(assunto).toBe('Reset your ViceHub password');
    });

    /**
     * O corpo vem em quoted-printable: os acentos chegam como `=C3=A1`
     * e as linhas compridas partidas com um `=` no fim. Sem desfazer
     * isso, um link partido a meio não se reconhece como link.
     */
    it('e desfaz o quoted-printable', () => {
        expect(legivel('Ol=C3=A1')).toBe('Olá');
        expect(legivel('https://vicehub.com/recu=\r\nperar')).toBe(
            'https://vicehub.com/recuperar',
        );
    });

    it('e encontra os links', () => {
        expect(resumir(MENSAGEM).links).toEqual([
            'https://vicehub.com/recuperar-password?token=abc123',
        ]);
    });

    /**
     * **E marca os que não levam ninguém a lado nenhum.**
     *
     * É a razão de isto existir. Um `APP_PUBLIC_URL` por definir manda
     * toda a gente para o `localhost` de quem fez o deploy, e o pedido
     * parece ter corrido bem: 202, sem erro nenhum, e o email até
     * chega.
     */
    it('e marca os links que apontam para a máquina de quem fez o deploy', () => {
        const local = MENSAGEM.replace(
            'https://vicehub.com/',
            'http://localhost:5173/',
        );

        expect(resumir(local).parados).toEqual([
            'http://localhost:5173/recuperar-password?token=abc123',
        ]);

        /* E não marca os que estão bem. */
        expect(resumir(MENSAGEM).parados).toEqual([]);
    });
});
