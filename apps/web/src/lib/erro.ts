import { ApiError } from './api.js';
import type { Messages } from '../i18n/en.js';

/**
 * O que se diz a uma pessoa quando um pedido é recusado.
 *
 * **A API responde em português.** Todas as mensagens dela estão
 * escritas nessa língua, e estão bem assim: servem quem lê registos e
 * quem escreve código, e não mudam com quem está do outro lado.
 *
 * O que não pode acontecer é chegarem ao ecrã. Antes disto, cada página
 * tratava os dois ou três códigos que conhecia e, para todos os outros,
 * mostrava a frase da API — uma pessoa a usar a plataforma em inglês,
 * espanhol ou francês via português a meio do seu idioma, exatamente no
 * momento em que alguma coisa lhe correu mal e ela mais precisava de
 * perceber.
 *
 * O contrato entre as duas metades é o **código**, não a frase. É por
 * ele que se procura a mensagem, e é por isso que a API pode reescrever
 * o texto dela sem partir nada aqui.
 *
 * Um código que ainda não tenha tradução cai numa frase genérica — no
 * idioma certo. Dizer "não foi possível" em inglês a quem lê inglês é
 * melhor do que dizer-lhe exatamente o que falhou em português.
 */
export const mensagemDoErro = (
    falha: unknown,
    t: Messages,
    /**
     * A frase de recurso deste ecrã, quando ele tiver uma melhor do que a
     * genérica — "a crew não pôde ser criada" diz mais do que "não foi
     * possível" a quem estava a criar uma.
     */
    recurso?: string,
): string => {
    if (!(falha instanceof ApiError)) {
        return recurso ?? t.comum.naoFoiPossivel;
    }

    /*
     * A tabela é indexada pelo código tal como a API o escreve. O
     * `?? ` é o que apanha um código novo: a API ganha um erro, o
     * dicionário ainda não, e ninguém vê uma palavra fora do sítio.
     */
    const traduzida = (t.erros as Record<string, string | undefined>)[
        falha.code
    ];

    return traduzida ?? recurso ?? t.comum.naoFoiPossivel;
};
