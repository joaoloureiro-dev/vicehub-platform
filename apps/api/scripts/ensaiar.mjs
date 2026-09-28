/**
 * O ensaio: uma instalação nova serve para alguma coisa?
 *
 * A varredura mede o desenho, a sonda tenta as portas e a medição conta
 * as consultas — todas contra uma base de dados que já tem meses de
 * coisas lá dentro. Nenhuma delas responde à pergunta que se faz no dia
 * do deploy, que é outra: **isto, acabado de instalar, funciona?**
 *
 * É uma pergunta diferente porque as avarias são outras. Uma instalação
 * nova falha por falta de `db:seed`, por uma migração que não correu,
 * por um domínio mal posto que faz o cookie do refresh não voltar, por
 * uma variável que se ficou a pensar que estava definida. Nada disso
 * aparece numa máquina de desenvolvimento, onde a base já tem cargos e
 * tudo corre na mesma origem.
 *
 * Por isso este ensaio faz o que a primeira pessoa faria: cria conta,
 * entra, renova a sessão, funda uma crew e um servidor, abre um tópico,
 * põe um anúncio, e vai ver os ecrãs todos que isso produz. Depois
 * **desfaz o que fez** e apaga a própria conta, para poder correr numa
 * plataforma que já está aberta sem lá deixar lixo.
 *
 *   npm run ensaiar --workspace @vicehub/api
 *
 * Opções: `--base=http://127.0.0.1:4011`, `--ficar`, `--controlo`.
 *
 * **A renovação da sessão é o passo que mais interessa.** O refresh
 * token vive num cookie `SameSite=strict`: com a interface e a API em
 * domínios que não são o mesmo sítio registável, ele não volta, o
 * refresh responde 401, e a sessão morre a cada F5 sem nada no ecrã a
 * dizer porquê. O ensaio guarda o cookie do registo e pede a renovação
 * com ele — não prova o cruzamento de domínios do browser, que só o
 * browser prova, mas apanha o lado da API.
 *
 * **O controlo.** Um ensaio que passa sempre e um ensaio avariado dizem
 * a mesma coisa. Com `--controlo` acrescenta-se um passo que não pode
 * correr bem — um perfil de crew que não existe — e exige-se que o
 * ensaio dê por ele. Se com o controlo o ensaio ainda disser que está
 * tudo bem, não se pode confiar nele.
 *
 * **O que fica por provar**: tudo o que precisa de chaves. O pagamento
 * pelo Stripe, o email a sair, o CAPTCHA, entrar pela Google ou pelo
 * Discord. O ensaio diz o que dessas coisas está ligada, e não tenta
 * usá-las.
 *
 * Sai com código 1 se algum passo falhar, ou se a limpeza deixar
 * alguma coisa para trás — e nesse caso diz o que ficou.
 */
const argumento = (nome, omissao) => {
    const encontrado = process.argv.find((a) => a.startsWith(`--${nome}=`));

    return encontrado === undefined ? omissao : encontrado.split('=')[1];
};

const RAIZ = argumento('base', 'http://127.0.0.1:4011');
const BASE = `${RAIZ}/api/v1`;
const FICAR = process.argv.includes('--ficar');
const CONTROLO = process.argv.includes('--controlo');

const marca = `ensaio${Date.now().toString().slice(-7)}`;
const EMAIL = `${marca}@vicehub.test`;
const PASSWORD = 'Sup3rS3cret!Pass';

const etiqueta = () =>
    Array.from({ length: 6 }, () =>
        'ABCDEFGHJKLMNPQRSTUVWXYZ'[Math.floor(Math.random() * 24)]).join('');

let falhas = 0;
let travados = 0;
let token = '';
let cookie = '';

const pedir = async (caminho, opcoes = {}) => {
    const resposta = await fetch(`${BASE}${caminho}`, {
        method: opcoes.method ?? 'GET',
        headers: {
            ...(opcoes.body === undefined
                ? {}
                : { 'content-type': 'application/json' }),
            ...(opcoes.comSessao === false ? {} : { authorization: `Bearer ${token}` }),
            ...(opcoes.comCookie === true && cookie !== '' ? { cookie } : {}),
        },
        ...(opcoes.body === undefined ? {} : { body: JSON.stringify(opcoes.body) }),
    });

    const texto = await resposta.text();

    /*
     * Um 429 não é uma avaria da instalação: é o limite de pedidos a
     * fazer o que lhe compete. O ensaio faz perto de cinquenta pedidos
     * e o limite por omissão são cem por minuto — duas corridas
     * seguidas batem nele. Conta-se, para o dizer no fim em vez de
     * mandar procurar um defeito que não existe.
     */
    if (resposta.status === 429) {
        travados += 1;
    }

    return {
        status: resposta.status,
        corpo: texto === '' ? null : JSON.parse(texto),
        cookies: resposta.headers.getSetCookie?.() ?? [],
    };
};

/**
 * Um passo do ensaio.
 *
 * `espera` é o que a resposta tem de ser para o passo contar como bom:
 * quase sempre "menos de 400", e por vezes um código exacto — apagar a
 * conta tem de deixar o login a responder 401, e um 200 aí era pior do
 * que um erro.
 */
const passo = async (nome, caminho, opcoes = {}) => {
    const { espera = (status) => status < 400, ...resto } = opcoes;

    const r = await pedir(caminho, resto);
    const bom = espera(r.status);

    if (!bom) {
        falhas += 1;
    }

    console.log(
        `  ${bom ? 'ok  ' : 'FALHOU'} ${String(r.status).padEnd(3)} ${nome}`
        + (bom ? '' : `  ${JSON.stringify(r.corpo)?.slice(0, 160) ?? ''}`),
    );

    return r.corpo;
};

const titulo = (texto) => console.log(`\n--- ${texto} ---`);

console.log(`a ensaiar ${RAIZ} com a conta ${EMAIL}`);

titulo('a plataforma está de pé');

await passo('a sonda de vida', '/health', { comSessao: false });
await passo('a sonda de prontidão', '/health/ready', { comSessao: false });

const formas = await passo('as formas de entrar', '/auth/providers', {
    comSessao: false,
});

titulo('a primeira conta');

const registo = await pedir('/auth/register', {
    method: 'POST',
    comSessao: false,
    body: { email: EMAIL, username: marca, password: PASSWORD },
});

if (registo.status >= 400) {
    falhas += 1;
    console.log(
        `  FALHOU ${registo.status} criar conta  `
        + `${JSON.stringify(registo.corpo)?.slice(0, 200)}`,
    );

    console.log(
        registo.status === 429
            ? '\nsem conta não há ensaio. Um 429 aqui é o limite de pedidos,'
            + ' e não a instalação: o ensaio faz perto de cinquenta pedidos'
            + ' e o limite por omissão são cem por minuto. Espera um minuto'
            + ' e corre outra vez.'
            : '\nsem conta não há ensaio. Um 500 aqui numa base acabada de'
            + ' migrar costuma ser o `npm run db:seed` que faltou.',
    );

    process.exit(1);
}

token = registo.corpo.accessToken;
cookie = registo.cookies.map((c) => c.split(';')[0]).join('; ');

console.log(`  ok   ${registo.status} criar conta`);

await passo('quem sou eu', '/users/me');

/*
 * A renovação, com o cookie que o registo pôs. É o passo que apanha
 * um domínio mal posto do lado da API.
 */
const renovado = await passo('renovar a sessão pelo cookie', '/auth/refresh', {
    method: 'POST',
    comSessao: false,
    comCookie: true,
});

if (renovado?.accessToken) {
    token = renovado.accessToken;
}

await passo('entrar com a palavra-passe', '/auth/login', {
    method: 'POST',
    comSessao: false,
    body: { email: EMAIL, password: PASSWORD },
});

titulo('fundar uma comunidade');

const crew = await passo('criar uma crew', '/crews', {
    method: 'POST',
    body: { name: `Crew do ensaio ${marca}`, tag: etiqueta() },
});

const servidor = await passo('criar um servidor', '/servers', {
    method: 'POST',
    body: { name: `Servidor do ensaio ${marca}`, region: 'EU' },
});

const topico = await passo('abrir um tópico no fórum', '/forum/topics', {
    method: 'POST',
    body: {
        title: `Ensaio de instalação ${marca}`,
        body: 'Este tópico foi aberto por um ensaio de instalação e vai ser retirado a seguir.',
        category: 'general',
    },
});

await passo('responder ao tópico', `/forum/topics/${topico?.id}/replies`, {
    method: 'POST',
    body: { body: 'E esta resposta também é do ensaio.' },
});

const anuncio = await passo(
    'pôr um anúncio no mercado',
    `/market/servers/${servidor?.id}/listings`,
    {
        method: 'POST',
        body: {
            category: 'vehicle',
            title: `Carro do ensaio ${marca}`,
            body: 'Um anúncio de ensaio, que vai ser apagado a seguir.',
            price: '1000',
        },
    },
);

titulo('os ecrãs que isso produz');

await passo('o diretório de crews', '/crews?page=1', { comSessao: false });
await passo('o diretório de servidores', '/servers?page=1', { comSessao: false });
await passo('quem está a recrutar', '/crews?page=1&recruiting=true', {
    comSessao: false,
});
await passo('o perfil da crew', `/crews/${crew?.id}`, { comSessao: false });
await passo('o perfil do servidor', `/servers/${servidor?.id}`, {
    comSessao: false,
});
await passo('o quadro do servidor', `/servers/${servidor?.id}/leaderboard`, {
    comSessao: false,
});
await passo('as crews do servidor', `/servers/${servidor?.id}/affiliations`, {
    comSessao: false,
});
await passo('o mercado do servidor', `/market/servers/${servidor?.id}/listings`, {
    comSessao: false,
});
await passo('a lista do fórum', '/forum/topics?page=1', { comSessao: false });
await passo('o tópico com a resposta', `/forum/topics/${topico?.id}`, {
    comSessao: false,
});
await passo('a escada de preços', '/billing/plans', { comSessao: false });
await passo('as notícias da entrada', '/news', { comSessao: false });

await passo('a tesouraria da crew', `/treasury/crews/${crew?.id}`);
await passo('o calendário da crew', `/events/crews/${crew?.id}`);
await passo('as chaves do servidor', `/servers/${servidor?.id}/api-keys`);
await passo('a minha carteira', '/treasury/me');
await passo('as minhas crews', '/crews/me/memberships');
await passo('os meus servidores', '/servers/me/memberships');
await passo('os meus avisos', '/notifications');
await passo('avisos por ler', '/notifications/unread');
await passo('o que espera resposta', '/users/me/pending');

let controloApanhado = false;

if (CONTROLO) {
    /*
     * O passo que não pode correr bem: um perfil de crew com um
     * identificador que não é de ninguém. Se o ensaio não se queixar
     * deste, não se pode acreditar nos outros.
     */
    titulo('controlo');

    const antes = falhas;

    await passo(
        'uma crew que não existe (tem de falhar)',
        '/crews/00000000-0000-4000-8000-000000000000',
        { comSessao: false },
    );

    controloApanhado = falhas > antes;

    /* E a queixa do controlo não conta como avaria do ensaio. */
    falhas = antes;
}

/**
 * Como correu, numa linha, e o código de saída.
 *
 * Com `--controlo`, um ensaio que não deu pelo passo impossível é um
 * ensaio em que não se pode acreditar — e isso é falha, mesmo que tudo
 * o resto tenha passado.
 */
const arrumar = (nota) => {
    const mau = falhas > 0 || (CONTROLO && !controloApanhado);

    console.log(
        `\n${falhas === 0
            ? nota
            : `${falhas} ${falhas === 1 ? 'passo falhou' : 'passos falharam'}`}`
        + (CONTROLO
            ? controloApanhado
                ? ' · o controlo foi apanhado'
                : ' · O CONTROLO PASSOU: não se pode confiar neste ensaio'
            : '')
        + (travados === 0
            ? ''
            : `\n${travados} ${travados === 1 ? 'pedido levou' : 'pedidos levaram'}`
            + ' 429: é o limite de pedidos, não a instalação. O ensaio faz'
            + ' perto de cinquenta pedidos e o limite por omissão são cem por'
            + ' minuto — espera um minuto entre corridas.'),
    );

    process.exitCode = mau ? 1 : 0;
};

if (FICAR) {
    arrumar('ensaio limpo · o que se criou fica, com `--ficar`');
} else {
    titulo('desfazer o que se fez');

    const porLimpar = [];

    const limpar = async (nome, caminho, opcoes = {}) => {
        const r = await pedir(caminho, { method: 'DELETE', ...opcoes });
        const bom = r.status < 400;

        if (!bom) {
            porLimpar.push(`${nome} (${caminho})`);
        }

        console.log(
            `  ${bom ? 'ok  ' : 'FICOU '} ${String(r.status).padEnd(3)} ${nome}`,
        );
    };

    await limpar('o anúncio', `/market/listings/${anuncio?.id}`);
    await limpar('o tópico', `/forum/topics/${topico?.id}`);
    await limpar('o servidor', `/servers/${servidor?.id}`);
    await limpar('a crew', `/crews/${crew?.id}`);
    await limpar('a conta', '/users/me', {
        body: { confirmation: marca, password: PASSWORD },
    });

    /*
     * E a conta apagada tem de deixar de entrar. Uma conta que ainda
     * entra depois de apagada não é lixo: é uma promessa quebrada a
     * quem a mandou apagar.
     */
    await passo('a conta apagada já não entra', '/auth/login', {
        method: 'POST',
        comSessao: false,
        body: { email: EMAIL, password: PASSWORD },
        espera: (status) => status === 401,
    });

    if (porLimpar.length > 0) {
        falhas += 1;

        console.log(`\nficou por apagar: ${porLimpar.join(', ')}`);
    }

    arrumar('ensaio limpo, e sem deixar nada para trás');
}

/*
 * E, no fim, o que não se ensaiou. Dizê-lo é metade do valor disto:
 * quem lê um ensaio limpo tem de saber o que é que ele não cobriu.
 */
const ligadas = Object.entries(formas ?? {})
    .filter(([, ligada]) => ligada === true)
    .map(([nome]) => nome);

console.log(
    '\npor ensaiar, porque precisa de chaves: o pagamento pelo Stripe, o'
    + ' email a sair, o CAPTCHA'
    + (ligadas.length === 0
        ? ', e entrar por Google ou Discord (nenhum está ligado).'
        : `. Formas de entrar ligadas: ${ligadas.join(', ')}.`),
);
