/**
 * A sonda: o que é que um cliente mal-intencionado consegue pedir.
 *
 * Duas pessoas, cada uma com as suas crews, servidores, eventos,
 * anúncios e dinheiro. A segunda tenta fazer à primeira tudo o que a
 * primeira pode fazer a si mesma.
 *
 * A classe que mais interessa é a **confusão de âmbito**. As rotas
 * autorizam pela permissão no âmbito que o caminho diz, e depois
 * operam sobre um identificador que vem do mesmo caminho: quem puser o
 * seu próprio âmbito no caminho e o identificador de outra pessoa no
 * fim passa a porta — se o serviço não verificar que as duas coisas
 * batem certo. É por isso que há sondas em pares: a mesma operação
 * pelo caminho da vítima e pelo caminho do intruso.
 *
 * **Cada sonda corre duas vezes, e é isso que a faz valer alguma
 * coisa.** Uma vez com o intruso, que tem de ser recusado, e outra com
 * o dono, que tem de conseguir. A primeira versão disto deu trinta e
 * cinco portas fechadas, e três delas fechavam-se com 404 — que é
 * exactamente o que uma rota mal escrita também responde. Uma sonda
 * que erra o caminho passa sempre, e uma bateria que passa sempre não
 * prova nada. É o mesmo que um mutante de controlo faz por uma suite
 * de testes.
 *
 * Não corre no CI: precisa de uma API de pé com uma base de dados
 * atrás, e escreve nela. Corre-se à mão antes de uma entrega, ou
 * depois de mexer em autorização.
 *
 *   1. a API a correr com a base de desenvolvimento
 *   2. `npm run sondar --workspace @vicehub/api`
 *
 * **E a API que responde tem de ser a que se acabou de compilar.** Um
 * servidor antigo agarrado à porta faz o novo morrer a arrancar sem
 * dizer nada, e a sonda passa a medir a versão anterior: uma bateria de
 * mutantes contra ela deu primeiro uma falha que não existia e depois
 * quatro passagens que também não. Se os números não baterem certo com
 * o que se mudou, a primeira coisa a confirmar é qual é o processo que
 * está na porta.
 *
 * **Com os travões levantados**, como a varredura: montar duas dúzias
 * de cenários são centenas de pedidos, e a API conta-os como contaria
 * os de uma pessoa. `RATE_LIMIT_MAX=100000 FORUM_RATE_LIMIT_MAX=10000`.
 *
 * Opção: `--base=http://127.0.0.1:4011`.
 *
 * Sai com código 1 se encontrar uma porta aberta **ou** uma sonda que
 * não prove nada. As duas coisas são falhas: uma é um buraco, a outra
 * é não se saber se há buraco.
 */
const argumento = (nome, omissao) => {
    const encontrado = process.argv.find((a) => a.startsWith(`--${nome}=`));

    return encontrado === undefined ? omissao : encontrado.split('=')[1];
};

const BASE = `${argumento('base', 'http://127.0.0.1:4011')}/api/v1`;

const pedir = async (caminho, opcoes = {}) => {
    const resposta = await fetch(`${BASE}${caminho}`, {
        method: opcoes.method ?? 'GET',
        headers: {
            ...(opcoes.body === undefined
                ? {}
                : { 'content-type': 'application/json' }),
            ...(opcoes.headers ?? {}),
        },
        ...(opcoes.body === undefined ? {} : { body: JSON.stringify(opcoes.body) }),
    });

    const texto = await resposta.text();

    return { status: resposta.status, corpo: texto === '' ? null : JSON.parse(texto) };
};

const api = async (caminho, opcoes = {}) => {
    const r = await pedir(caminho, opcoes);

    if (r.status >= 400) {
        throw new Error(`${caminho}: ${r.status} ${JSON.stringify(r.corpo)}`);
    }

    return r.corpo;
};

const marca = `t${Date.now().toString().slice(-7)}`;
const aut = (t) => ({ authorization: `Bearer ${t}` });
const etiqueta = () =>
    Array.from({ length: 6 }, () =>
        'ABCDEFGHJKLMNPQRSTUVWXYZ'[Math.floor(Math.random() * 24)]).join('');

let contador = 0;

const registar = async (nome) => {
    const conta = await api('/auth/register', {
        method: 'POST',
        body: {
            email: `${nome}@vicehub.test`,
            username: nome,
            password: 'Sup3rS3cret!Pass',
        },
    });

    return { nome, token: conta.accessToken, id: conta.user.id };
};

const A = await registar(`${marca}a`);
const B = await registar(`${marca}b`);

/** Uma crew nova de A, descartável: a sonda do dono costuma gastá-la. */
const crewDeA = () =>
    api('/crews', {
        method: 'POST', headers: aut(A.token),
        body: { name: `Crew ${marca} ${(contador += 1)}`, tag: etiqueta() },
    }).then((c) => c.id);

const servidorDeA = () =>
    api('/servers', {
        method: 'POST', headers: aut(A.token),
        body: { name: `Server ${marca} ${(contador += 1)}`, region: 'EU' },
    }).then((s) => s.id);

const resultados = [];

/**
 * Corre a mesma coisa duas vezes: o intruso tem de ser recusado, o
 * dono tem de conseguir.
 *
 * `montar` devolve o caminho e o corpo, e é chamado de novo para o
 * dono — com objetos frescos, porque a tentativa do dono costuma
 * gastar aquilo em que mexe.
 */
const sonda = async (nome, montar, recusas = [401, 403]) => {
    const doIntruso = await montar();
    const r1 = await pedir(doIntruso.caminho, {
        ...doIntruso.opcoes,
        headers: aut(B.token),
    });

    const doDono = await montar();
    const r2 = await pedir(doDono.caminho, {
        ...doDono.opcoes,
        headers: aut(A.token),
    });

    const recusado = recusas.includes(r1.status);
    const permitido = r2.status < 400;
    const passa = recusado && permitido;

    resultados.push({ nome, intruso: r1.status, dono: r2.status, passa, recusado, permitido });

    const veredito = passa
        ? '  ok  '
        : permitido
            ? 'ABERTO'
            : 'SONDA?';

    console.log(
        `${veredito} intruso=${String(r1.status).padEnd(3)}`
        + ` dono=${String(r2.status).padEnd(3)} ${nome}`,
    );

    if (!passa) {
        const qual = permitido ? r1 : r2;
        console.log(`         ${JSON.stringify(qual.corpo).slice(0, 180)}`);
    }
};

console.log(`A=${A.nome} B=${B.nome}\n--- a tesouraria de outra pessoa ---`);

const comMovimento = async () => {
    const crew = await crewDeA();
    const mov = await api(`/treasury/crews/${crew}/movements`, {
        method: 'POST', headers: aut(A.token),
        body: {
            amount: '100000', direction: 'credit',
            category: 'contribution', description: 'Entrada.',
        },
    });

    return { crew, mov: mov.id };
};

await sonda('ler a tesouraria de uma crew alheia', async () => ({
    caminho: `/treasury/crews/${await crewDeA()}`,
    opcoes: {},
}));

await sonda('propor um movimento numa crew alheia', async () => ({
    caminho: `/treasury/crews/${await crewDeA()}/movements`,
    opcoes: {
        method: 'POST',
        body: {
            amount: '1', direction: 'debit',
            category: 'other', description: 'ola',
        },
    },
}));

await sonda('aprovar o movimento de outra crew, pelo caminho dela', async () => {
    const { crew, mov } = await comMovimento();

    return { caminho: `/treasury/crews/${crew}/movements/${mov}/approve`, opcoes: { method: 'POST' } };
});

await sonda('apagar o movimento de outra crew', async () => {
    const { crew, mov } = await comMovimento();

    return { caminho: `/treasury/crews/${crew}/movements/${mov}`, opcoes: { method: 'DELETE' } };
});

console.log('\n--- eventos ---');

const comEvento = async () => {
    const crew = await crewDeA();
    const evento = await api(`/events/crews/${crew}`, {
        method: 'POST', headers: aut(A.token),
        body: {
            name: `Assalto ${marca}`,
            startsAt: new Date(Date.now() + 86_400_000).toISOString(),
        },
    });

    return { crew, evento: evento.id };
};

await sonda('ler o calendário de uma crew alheia', async () => ({
    caminho: `/events/crews/${await crewDeA()}`,
    opcoes: {},
}));

await sonda('cancelar o evento de uma crew alheia', async () => {
    const { crew, evento } = await comEvento();

    return {
        caminho: `/events/crews/${crew}/${evento}/status`,
        opcoes: { method: 'POST', body: { status: 'canceled' } },
    };
});

await sonda('confirmar presenças no evento de uma crew alheia', async () => {
    const { crew, evento } = await comEvento();

    await api(`/events/crews/${crew}/${evento}/signup`, {
        method: 'POST', headers: aut(A.token),
    });

    return {
        caminho: `/events/crews/${crew}/${evento}/participants/${A.id}/confirm`,
        opcoes: { method: 'POST', body: {} },
    };
});

console.log('\n--- mercado ---');

const comAnuncio = async () => {
    const servidor = await servidorDeA();
    const anuncio = await api(`/market/servers/${servidor}/listings`, {
        method: 'POST', headers: aut(A.token),
        body: {
            category: 'vehicle', title: `Carro ${marca} ${(contador += 1)}`,
            body: 'Entrego no porto depois das oito.', price: '250000',
        },
    });

    return anuncio.id;
};

await sonda('fechar o anúncio de outra pessoa', async () => ({
    caminho: `/market/listings/${await comAnuncio()}/close`,
    opcoes: { method: 'POST', body: { outcome: 'sold' } },
}));

await sonda('apagar o anúncio de outra pessoa', async () => ({
    caminho: `/market/listings/${await comAnuncio()}`,
    opcoes: { method: 'DELETE' },
}));

console.log('\n--- fórum ---');

const comTopico = async () => {
    const t = await api('/forum/topics', {
        method: 'POST', headers: aut(A.token),
        body: {
            title: `Uma pergunta ${marca} ${(contador += 1)} sobre tesourarias`,
            body: 'Somos cinco e ninguém sabe como se divide. Como fazem?',
        },
    });

    return t.id;
};

await sonda('retirar o tópico de outra pessoa', async () => ({
    caminho: `/forum/topics/${await comTopico()}`,
    opcoes: { method: 'DELETE' },
}));

console.log('\n--- crews e servidores ---');

await sonda('mudar o nome de uma crew alheia', async () => ({
    caminho: `/crews/${await crewDeA()}`,
    opcoes: { method: 'PATCH', body: { name: `Outro nome ${marca} ${(contador += 1)}` } },
}));

await sonda('apagar uma crew alheia', async () => ({
    caminho: `/crews/${await crewDeA()}`,
    opcoes: { method: 'DELETE' },
}));

/*
 * Com uma terceira pessoa lá dentro: A não se pode expulsar a si
 * mesma — a API manda-a usar a porta de saída —, e uma sonda cujo dono
 * também é recusado não prova nada.
 */
await sonda('expulsar alguém de uma crew alheia', async () => {
    const crew = await crewDeA();
    const C = await registar(`${marca}m${(contador += 1)}`);

    await api(`/crews/${crew}/join`, {
        method: 'POST', headers: aut(C.token),
        body: { message: 'Conduzo bem e apareço às horas.' },
    });

    await api(`/crews/${crew}/requests/${C.id}/accept`, {
        method: 'POST', headers: aut(A.token),
    });

    return {
        caminho: `/crews/${crew}/members/${C.id}`,
        opcoes: { method: 'DELETE' },
    };
});

await sonda('mudar o nome de um servidor alheio', async () => ({
    caminho: `/servers/${await servidorDeA()}`,
    opcoes: { method: 'PATCH', body: { name: `Outro servidor ${marca} ${(contador += 1)}` } },
}));

await sonda('ler a folga do plano de um servidor alheio', async () => ({
    caminho: `/servers/${await servidorDeA()}/affiliations/allowance`,
    opcoes: {},
}));

await sonda('ler os pedidos de filiação de um servidor alheio', async () => ({
    caminho: `/servers/${await servidorDeA()}/affiliations/requests`,
    opcoes: {},
}));

console.log('\n--- dinheiro ---');

await sonda('ler o plano de uma crew alheia', async () => ({
    caminho: `/subscriptions/crews/${await crewDeA()}`,
    opcoes: {},
}));

/*
 * O portal de faturação não se prova aqui: sem Stripe configurado, o
 * dono leva 503 antes de a autorização chegar a dizer alguma coisa, e
 * uma sonda cujo dono é recusado não distingue uma porta fechada de um
 * caminho mal escrito. Fica registada como o que é.
 */
{
    const r = await pedir('/billing/portal', {
        method: 'POST', headers: aut(B.token),
        body: { ownerKind: 'crew', ownerId: await crewDeA() },
    });

    console.log(
        `  —    intruso=${r.status}    abrir o portal de faturação de uma`
        + ' crew alheia (sem Stripe, não se prova)',
    );
}

console.log('\n--- as chaves do servidor de jogo ---');

/** Um servidor de A com uma chave por lá. */
const comChave = async () => {
    const servidor = await servidorDeA();
    const chave = await api(`/servers/${servidor}/api-keys`, {
        method: 'POST', headers: aut(A.token),
        body: { label: `producao ${(contador += 1)}` },
    });

    return { servidor, chave: chave.id ?? chave.apiKeyId };
};

await sonda('listar as chaves de um servidor alheio', async () => ({
    caminho: `/servers/${await servidorDeA()}/api-keys`,
    opcoes: {},
}));

await sonda('criar uma chave num servidor alheio', async () => ({
    caminho: `/servers/${await servidorDeA()}/api-keys`,
    opcoes: { method: 'POST', body: { label: 'a minha' } },
}));

await sonda('revogar a chave de outro servidor, pelo caminho dela', async () => {
    const { servidor, chave } = await comChave();

    return {
        caminho: `/servers/${servidor}/api-keys/${chave}`,
        opcoes: { method: 'DELETE' },
    };
});

/*
 * E a mesma chave, pelo caminho do servidor **do intruso**.
 *
 * É a confusão de âmbito na sua forma mais pura: a porta olha para o
 * servidor que está no caminho — que é mesmo dele — e a operação usa o
 * identificador que vem a seguir. Se ninguém verificar que a chave é
 * daquele servidor, qualquer pessoa com um servidor seu desliga o
 * recurso de jogo de qualquer outro.
 */
const servidorDeB = await api('/servers', {
    method: 'POST', headers: aut(B.token),
    body: { name: `Server do B ${marca}`, region: 'EU' },
});

{
    const { chave } = await comChave();

    const r = await pedir(`/servers/${servidorDeB.id}/api-keys/${chave}`, {
        method: 'DELETE', headers: aut(B.token),
    });

    const passa = r.status >= 400;

    resultados.push({
        nome: 'revogar a chave de outro servidor, pelo caminho do próprio',
        intruso: r.status, dono: 204, passa, recusado: passa, permitido: true,
    });

    console.log(
        `${passa ? '  ok  ' : 'ABERTO'} intruso=${String(r.status).padEnd(3)}`
        + ' dono=—   revogar a chave de outro servidor, pelo caminho do próprio',
    );
}

console.log('\n--- conversas e avisos ---');

/** Uma conversa entre A e uma terceira pessoa, onde B não entra. */
const comConversa = async () => {
    const servidor = await servidorDeA();
    const anuncio = await api(`/market/servers/${servidor}/listings`, {
        method: 'POST', headers: aut(A.token),
        body: {
            category: 'vehicle', title: `Carro ${marca} ${(contador += 1)}`,
            body: 'Entrego no porto depois das oito.', price: '250000',
        },
    });

    const C = await registar(`${marca}c${(contador += 1)}`);

    const conversa = await api(`/market/listings/${anuncio.id}/conversations`, {
        method: 'POST', headers: aut(C.token),
    });

    await api(`/market/conversations/${conversa.id}/messages`, {
        method: 'POST', headers: aut(C.token),
        body: { body: 'Ainda tens isso? Pago hoje.' },
    });

    return conversa.id;
};

await sonda('ler uma conversa de que não se faz parte', async () => ({
    caminho: `/market/conversations/${await comConversa()}`,
    opcoes: {},
}), [401, 403, 404]);

await sonda('escrever numa conversa de que não se faz parte', async () => ({
    caminho: `/market/conversations/${await comConversa()}/messages`,
    opcoes: { method: 'POST', body: { body: 'Vendo-te eu mais barato.' } },
}), [401, 403, 404]);

console.log('\n--- o que é meu só aparece na minha lista ---');

/**
 * As rotas que respondem 200 a toda a gente.
 *
 * Tudo o que está acima é uma porta: o intruso pede o que não é dele e
 * tem de levar com 403. Estas não são portas — são listas do próprio, e
 * respondem 200 a quem quer que pergunte. O que as guarda é uma
 * condição lá dentro da consulta, e uma condição que desapareça não dá
 * erro nenhum: dá a lista de outra pessoa, com o mesmo 200 de sempre.
 *
 * É a avaria que uma sonda de permissões não vê. Por isso estas
 * comparam **o que chega**: o que é de A não pode aparecer na resposta
 * que B recebe.
 *
 * E a lista de A tem de ter alguma coisa. Duas listas vazias também não
 * se cruzam, e uma sonda que passa por estar tudo vazio é uma sonda que
 * não prova nada — que é a mesma regra do dono que tem de conseguir.
 */
const soMeu = async (nome, caminho, extrair) => {
    const deA = await api(caminho, { headers: aut(A.token) });
    const deB = await api(caminho, { headers: aut(B.token) });

    const meus = extrair(deA);
    const dele = new Set(extrair(deB));

    const cruzados = meus.filter((x) => dele.has(x));

    const prova = meus.length > 0;
    const passa = prova && cruzados.length === 0;

    resultados.push({
        nome, intruso: 200, dono: 200, passa,
        recusado: cruzados.length === 0, permitido: prova,
    });

    console.log(
        `${passa ? '  ok  ' : prova ? 'ABERTO' : '  ?   '}`
        + ` intruso=200 dono=200 ${nome}`
        + (prova ? '' : ' (a lista de A está vazia: não prova nada)'),
    );
};

/* Para a caixa do que espera resposta ter o que mostrar. */
{
    const crew = await crewDeA();

    await api(`/crews/${crew}/join`, {
        method: 'POST', headers: aut(B.token), body: {},
    });
}

await soMeu('quem sou eu é quem pergunta', '/users/me', (r) => [r.email]);

await soMeu(
    'a caixa de avisos não mistura pessoas',
    '/notifications',
    (r) => (r.notifications ?? r.items ?? []).map((n) => n.id),
);

await soMeu(
    'o que espera resposta é o que espera por mim',
    '/users/me/pending',
    (r) => (r.items ?? []).map((i) => i.communityId),
);

/*
 * Aqui o que não pode cruzar-se não é a comunidade: é a **minha
 * ligação a ela**. A mesma crew aparece na lista de quem a lidera e na
 * de quem lhe pediu entrada, e é assim que tem de ser — o que nunca
 * pode aparecer na lista de B é a ligação de A, com o cargo e o estado
 * dela.
 */
const ligacao = (id) => (m) => `${m[id]}:${m.role ?? '—'}:${m.status}`;

await soMeu(
    'as minhas crews são as minhas, com o meu cargo',
    '/crews/me/memberships',
    (r) => (r.items ?? r ?? []).map(ligacao('crewId')),
);

await soMeu(
    'os meus servidores são os meus, com o meu cargo',
    '/servers/me/memberships',
    (r) => (r.items ?? r ?? []).map(ligacao('serverId')),
);

console.log(
    `\n${resultados.length} sondas`
    + ` · ${resultados.filter((r) => r.passa).length} fechadas como deve ser`
    + ` · ${resultados.filter((r) => r.permitido && !r.recusado).length} portas abertas`
    + ` · ${resultados.filter((r) => !r.permitido).length} sondas que não provam nada`,
);

for (const r of resultados.filter((x) => !x.passa)) {
    console.log(
        `  ${r.permitido ? '✗ ABERTA' : '? SONDA '} ${r.nome}`
        + ` (intruso ${r.intruso}, dono ${r.dono})`,
    );
}

/*
 * Uma sonda que não prova nada conta como falha.
 *
 * Deixá-la passar em silêncio era o erro que esta bateria existe para
 * não repetir: três sondas com o caminho mal escrito davam trinta e
 * cinco portas fechadas e não tinham sequer batido à porta.
 */
if (resultados.some((r) => !r.passa)) {
    process.exitCode = 1;
}
