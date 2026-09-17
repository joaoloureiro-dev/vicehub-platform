import fp from 'fastify-plugin';

/**
 * O estado "estou a fechar, não me mandem mais ninguém".
 *
 * Entre o sinal de encerramento e a porta fechar há um intervalo que
 * ninguém controla: o balanceador só sabe que esta instância saiu
 * quando a sonda de prontidão lho disser, e ele só volta a perguntar
 * dentro de alguns segundos. Fechar a porta primeiro e avisar depois
 * é a ordem errada — os pedidos que ele mandar nesse intervalo batem
 * numa ligação recusada, e quem estava do outro lado vê um erro por
 * causa de um deploy que correu bem.
 *
 * Com isto, o encerramento diz primeiro que está de saída, deixa o
 * balanceador reparar, e só então fecha.
 */
const drenagemPlugin = fp(
    async (fastify) => {
        fastify.decorate('aEncerrar', false);

        fastify.decorate('comecarAEncerrar', function comecarAEncerrar() {
            fastify.aEncerrar = true;
        });
    },
    {
        name: 'drenagem-plugin',
    },
);

export default drenagemPlugin;
