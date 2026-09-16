import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';

import { prisma, SALDO_MAXIMO } from '@vicehub/database';
import { buildApp } from '../../src/app.js';
import { darPlano } from '../helpers/plans.fixtures.js';

/**
 * O tecto da tesouraria, contra PostgreSQL a sério.
 *
 * O saldo é uma coluna `BigInt` — inteiro de 64 bits com sinal — e isso
 * não é um detalhe de armazenamento: é um limite que se pode bater. A
 * pergunta que estes testes fazem é o que acontece quando se bate nele,
 * e a resposta tem de ser uma recusa explicada, não um 500.
 *
 * São dois casos diferentes, e é por isso que é preciso a base de dados
 * a sério para os separar. Um é um montante que nunca poderia caber, e
 * esse morre na validação. O outro é um montante perfeitamente válido
 * que deixa de caber por causa do que já lá estava — e essa soma só
 * existe dentro da transação que credita.
 */
describe('o tecto da tesouraria', () => {
    let app: FastifyInstance;

    const marca = `lim${Date.now().toString().slice(-8)}`;

    const auth = (token: string) => ({ authorization: `Bearer ${token}` });

    let dono: string;
    let donoId: string;
    let crewId: string;
    let serverId: string;

    /**
     * O maior inteiro de 64 bits com sinal, escrito por extenso e não
     * importado de propósito.
     *
     * Um teste que lesse o limite da mesma constante que o código usa
     * não provava nada: baixar a constante baixava com ela a expectativa,
     * e o teste continuava verde a dizer que o código concorda consigo
     * próprio. O número está aqui porque é o da coluna, e é contra ele
     * que a constante tem de bater certo.
     */
    const TECTO_DA_COLUNA = 9_223_372_036_854_775_807n;

    /** Aceite pela forma de dezanove dígitos, impossível de gravar. */
    const MAIOR_COM_DEZANOVE_DIGITOS = '9999999999999999999';

    const register = async (username: string): Promise<string> => {
        const response = await app.inject({
            method: 'POST',
            url: '/api/v1/auth/register',
            payload: {
                email: `${username}@vicehub.test`,
                username,
                password: 'Sup3rS3cret!Pass',
            },
        });

        expect(response.statusCode, response.body).toBe(201);

        return response.json().accessToken as string;
    };

    const propor = (amount: string, url: string) =>
        app.inject({
            method: 'POST',
            url,
            headers: auth(dono),
            payload: {
                amount,
                direction: 'credit',
                category: 'other',
                description: 'Entrada',
            },
        });

    const proporNaCrew = (amount: string) =>
        propor(amount, `/api/v1/treasury/crews/${crewId}/movements`);

    const aprovarNaCrew = (movementId: string) =>
        app.inject({
            method: 'POST',
            url: `/api/v1/treasury/crews/${crewId}/movements/${movementId}/approve`,
            headers: auth(dono),
        });

    /** Entra mesmo dinheiro na crew, pelo caminho normal. */
    const creditar = async (amount: string) => {
        const proposta = await proporNaCrew(amount);

        expect(proposta.statusCode, proposta.body).toBe(201);

        const aprovacao = await aprovarNaCrew(proposta.json().id as string);

        expect(aprovacao.statusCode, aprovacao.body).toBe(200);
    };

    const saldoDaCrew = async () =>
        (
            await prisma.wallet.findFirstOrThrow({
                where: { crewId },
                select: { balance: true },
            })
        ).balance;

    const saldoDoServidor = async () =>
        (
            await prisma.wallet.findFirstOrThrow({
                where: { serverId },
                select: { balance: true },
            })
        ).balance;

    beforeAll(async () => {
        app = buildApp();
        await app.ready();

        dono = await register(`${marca}d`);
        donoId = (
            await prisma.user.findFirstOrThrow({
                where: { username: `${marca}d` },
                select: { id: true },
            })
        ).id;

        const crew = await app.inject({
            method: 'POST',
            url: '/api/v1/crews',
            headers: auth(dono),
            payload: { name: `Tecto ${marca}`, tag: `T${marca.slice(-6)}` },
        });

        expect(crew.statusCode, crew.body).toBe(201);
        crewId = crew.json().id as string;

        const servidor = await app.inject({
            method: 'POST',
            url: '/api/v1/servers',
            headers: auth(dono),
            payload: { name: `Tecto ${marca}` },
        });

        expect(servidor.statusCode, servidor.body).toBe(201);
        serverId = servidor.json().id as string;

        await darPlano({ crewId });
        await darPlano({ serverId });

        const pedido = await app.inject({
            method: 'POST',
            url: `/api/v1/crews/${crewId}/affiliation`,
            headers: auth(dono),
            payload: { serverId },
        });

        expect(pedido.statusCode, pedido.body).toBe(201);

        const aceite = await app.inject({
            method: 'POST',
            url: `/api/v1/servers/${serverId}/affiliations/${crewId}/accept`,
            headers: auth(dono),
        });

        expect(aceite.statusCode, aceite.body).toBe(200);
    });

    afterAll(async () => {
        await app.close();
        await prisma.$disconnect();
    });

    /**
     * A constante que a aplicação usa é a da coluna, e não um número
     * parecido.
     */
    it('conhece o tecto certo', () => {
        expect(SALDO_MAXIMO).toBe(TECTO_DA_COLUNA);
    });

    /**
     * A faixa que a forma sozinha deixava passar.
     *
     * Dezanove dígitos vão até 9 999 999 999 999 999 999 e a coluna pára
     * em 9 223 372 036 854 775 807: há setecentos e setenta e seis mil
     * biliões de valores que eram aceites a validar e impossíveis de
     * gravar. Saíam como 500 quando são, de facto, pedidos inválidos.
     */
    it.each([
        (TECTO_DA_COLUNA + 1n).toString(),
        MAIOR_COM_DEZANOVE_DIGITOS,
    ])('recusa %s a validar, e não a gravar', async (amount) => {
        const resposta = await proporNaCrew(amount);

        expect(resposta.statusCode, resposta.body).toBe(400);
    });

    it('recusa um total de divisão acima do tecto', async () => {
        const resposta = await app.inject({
            method: 'POST',
            url: `/api/v1/treasury/crews/${crewId}/distributions`,
            headers: auth(dono),
            payload: { basis: 'equal', total: MAIOR_COM_DEZANOVE_DIGITOS },
        });

        expect(resposta.statusCode, resposta.body).toBe(400);
    });

    it('recusa uma parte manual acima do tecto', async () => {
        const resposta = await app.inject({
            method: 'POST',
            url: `/api/v1/treasury/crews/${crewId}/distributions`,
            headers: auth(dono),
            payload: {
                basis: 'manual',
                shares: [
                    { userId: donoId, amount: MAIOR_COM_DEZANOVE_DIGITOS },
                ],
            },
        });

        expect(resposta.statusCode, resposta.body).toBe(400);
    });

    it('recusa uma transferência acima do tecto', async () => {
        const resposta = await app.inject({
            method: 'POST',
            url: `/api/v1/treasury/servers/${serverId}/transfers`,
            headers: auth(dono),
            payload: { crewId, amount: MAIOR_COM_DEZANOVE_DIGITOS },
        });

        expect(resposta.statusCode, resposta.body).toBe(400);
    });

    /**
     * O outro lado da mesma linha: o maior valor que cabe tem de caber
     * mesmo, e não só passar a validação.
     *
     * Por isso o movimento é aprovado e o saldo lido da base de dados.
     * Apertar o limite por engano — um dígito a menos na constante —
     * seria uma tesouraria a recusar dinheiro que a coluna guarda bem.
     */
    it('aceita e guarda o maior montante que a coluna suporta', async () => {
        await creditar(TECTO_DA_COLUNA.toString());

        expect(await saldoDaCrew()).toBe(TECTO_DA_COLUNA);
    });

    /**
     * O caso que a validação não apanha e nunca apanharia.
     *
     * Uma unidade é um montante válido em qualquer tesouraria. Nesta,
     * agora, não cabe — e isso só se sabe somando ao que já lá está,
     * dentro da transação que credita.
     *
     * O que se exige é o par: uma recusa explicada **e** a tesouraria
     * intacta. Antes disto o movimento ficava pendente para sempre,
     * cada aprovação devolvia 500, e quem a tentasse não ficava a saber
     * porquê.
     */
    it('recusa a entrada que faria o saldo passar o tecto, e não lhe toca', async () => {
        const antes = await saldoDaCrew();
        const proposta = await proporNaCrew('1');

        expect(proposta.statusCode, proposta.body).toBe(201);

        const movementId = proposta.json().id as string;
        const aprovacao = await aprovarNaCrew(movementId);

        expect(aprovacao.statusCode, aprovacao.body).toBe(409);
        expect(aprovacao.json().code).toBe('BALANCE_WOULD_OVERFLOW');

        expect(await saldoDaCrew()).toBe(antes);

        /**
         * E o movimento continua a ser recusável. Ficar pendente é a
         * consequência correta de a transação se desfazer; ficar preso
         * não era.
         */
        const recusa = await app.inject({
            method: 'POST',
            url: `/api/v1/treasury/crews/${crewId}/movements/${movementId}/reject`,
            headers: auth(dono),
        });

        expect(recusa.statusCode, recusa.body).toBe(200);
    });

    /**
     * O mesmo do lado de quem recebe uma transferência.
     *
     * A crew está cheia e o servidor tem com que a encher. O dinheiro
     * não pode sair do servidor sem entrar na crew, por isso a
     * transferência inteira é recusada — não meia.
     */
    it('recusa a transferência que não cabe na crew de destino, e não move nada', async () => {
        const proposta = await propor(
            '1000000000',
            `/api/v1/treasury/servers/${serverId}/movements`,
        );

        expect(proposta.statusCode, proposta.body).toBe(201);

        const aprovacao = await app.inject({
            method: 'POST',
            url: `/api/v1/treasury/servers/${serverId}/movements/${proposta.json().id}/approve`,
            headers: auth(dono),
        });

        expect(aprovacao.statusCode, aprovacao.body).toBe(200);

        const servidorAntes = await saldoDoServidor();
        const crewAntes = await saldoDaCrew();

        const resposta = await app.inject({
            method: 'POST',
            url: `/api/v1/treasury/servers/${serverId}/transfers`,
            headers: auth(dono),
            payload: { crewId, amount: '1000000000' },
        });

        expect(resposta.statusCode, resposta.body).toBe(409);
        expect(resposta.json().code).toBe('BALANCE_WOULD_OVERFLOW');

        expect(await saldoDoServidor()).toBe(servidorAntes);
        expect(await saldoDaCrew()).toBe(crewAntes);
    });

    /**
     * E do lado de quem recebe uma parte de uma divisão.
     *
     * A carteira pessoal também é uma coluna com tecto, e uma divisão
     * credita várias de uma vez. Uma parte que não caiba desfaz a
     * divisão inteira: ninguém recebe metade de uma repartição.
     *
     * A crew é reenchida entre as duas divisões de propósito — sem isso
     * a soma das partes nunca passaria o tecto, porque o que sai da
     * tesouraria é limitado pelo mesmo número.
     */
    it('recusa a divisão cuja parte não cabe na carteira de quem recebe', async () => {
        const daPessoa = async () =>
            (
                await prisma.wallet.findFirstOrThrow({
                    where: { userId: donoId },
                    select: { balance: true },
                })
            ).balance;

        const metadeMais = (TECTO_DA_COLUNA / 2n + 1n).toString();

        const dividir = async (total: string) => {
            const proposta = await app.inject({
                method: 'POST',
                url: `/api/v1/treasury/crews/${crewId}/distributions`,
                headers: auth(dono),
                payload: { basis: 'equal', total },
            });

            expect(proposta.statusCode, proposta.body).toBe(201);

            return app.inject({
                method: 'POST',
                url: `/api/v1/treasury/crews/${crewId}/distributions/${proposta.json().id}/approve`,
                headers: auth(dono),
            });
        };

        /** A crew está no tecto e o dono é o único a quem pagar. */
        expect(await saldoDaCrew()).toBe(TECTO_DA_COLUNA);

        const primeira = await dividir(metadeMais);

        expect(primeira.statusCode, primeira.body).toBe(200);
        expect(await daPessoa()).toBe(TECTO_DA_COLUNA / 2n + 1n);

        await creditar((TECTO_DA_COLUNA - (await saldoDaCrew())).toString());

        const crewAntes = await saldoDaCrew();
        const pessoaAntes = await daPessoa();
        const segunda = await dividir(metadeMais);

        expect(segunda.statusCode, segunda.body).toBe(409);
        expect(segunda.json().code).toBe('BALANCE_WOULD_OVERFLOW');

        expect(await saldoDaCrew()).toBe(crewAntes);
        expect(await daPessoa()).toBe(pessoaAntes);
    });
});
