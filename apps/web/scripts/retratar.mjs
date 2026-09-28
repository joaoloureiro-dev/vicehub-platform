/**
 * O retrato do produto: cada ecrã, nas duas larguras, com gente lá dentro.
 *
 * Isto não é a varredura. A varredura mede e não guarda nada; isto guarda
 * e não mede nada. E, sobretudo, semeia outra coisa: a varredura precisa
 * que os nomes sejam únicos entre corridas, e por isso carimba um número
 * em cada um — `Os Corredores 8039663`. Serve para medir e não serve para
 * mostrar, porque uma captura com um carimbo desses lê-se como o que é,
 * uma base de dados de teste.
 *
 * Daqui saem as imagens de `docs/media/tema/`, que são as que vão para o
 * readme, para a galeria e para o que for publicado. Por isso o texto
 * aqui dentro está em inglês, que é o idioma por omissão do produto, e
 * os números são números que uma crew teria mesmo.
 *
 * **Precisa de uma base vazia.** Os nomes são fixos de propósito — é o
 * que os faz parecer nomes —, e nomes fixos só são únicos uma vez. O
 * programa recusa-se a correr se já lá estiver a conta que ia criar, em
 * vez de rebentar a meio com metade das imagens tiradas.
 *
 *   1. base de dados limpa: `npm run db:migrate:reset --workspace @vicehub/database`
 *   2. `npm run build` e a API a servir o `dist` (ver `varrer.mjs`)
 *   3. `npm run retratar --workspace @vicehub/web`
 *
 * Opções: `--base=http://127.0.0.1:4011`, `--para=<pasta>`.
 */

import fs from 'node:fs';
import path from 'node:path';

import { ECRAS } from './varrer.mjs';

const argumento = (nome, omissao) => {
    const achado = process.argv.find((a) => a.startsWith(`--${nome}=`));

    return achado === undefined ? omissao : achado.split('=')[1];
};

const BASE = argumento('base', 'http://127.0.0.1:4011');
const PARA = argumento(
    'para',
    path.resolve(import.meta.dirname, '../../../docs/media/tema'),
);
const PASSWORD = 'Sup3rS3cret!Pass';

const api = async (caminho, opcoes = {}) => {
    const resposta = await fetch(`${BASE}/api/v1${caminho}`, {
        ...opcoes,
        headers: {
            ...(opcoes.body ? { 'content-type': 'application/json' } : {}),
            ...(opcoes.headers ?? {}),
        },
        body: opcoes.body ? JSON.stringify(opcoes.body) : undefined,
    });

    const texto = await resposta.text();

    if (!resposta.ok) {
        throw new Error(`${caminho} respondeu ${resposta.status}: ${texto}`);
    }

    return texto ? JSON.parse(texto) : null;
};

const aut = (token) => ({ authorization: `Bearer ${token}` });

/**
 * A gente.
 *
 * Nomes de pessoas e não `user1`: metade dos ecrãs é uma lista de nomes,
 * e uma lista de `user1, user2, user3` não mostra nada do que o ecrã faz.
 */
const ELENCO = [
    ['kestrel', 'Getaway driver. I play at night, mostly around the docks.'],
    ['marlowe', 'Runs the books. Ask me before you spend it.'],
    ['delacroix', 'Bikes and bad ideas.'],
    ['vance', 'Here for the heists, staying for the paperwork.'],
    ['okonkwo', 'Lookout. I am always early and never armed.'],
];

const semear = async () => {
    const contas = new Map();

    for (const [nome, bio] of ELENCO) {
        const conta = await api('/auth/register', {
            method: 'POST',
            body: { email: `${nome}@vicehub.test`, username: nome, password: PASSWORD },
        });

        await api('/users/me', {
            method: 'PATCH', headers: aut(conta.accessToken), body: { bio },
        });

        contas.set(nome, conta);
    }

    const eu = contas.get('kestrel');
    const token = aut(eu.accessToken);

    const crew = await api('/crews', {
        method: 'POST', headers: token,
        body: {
            name: 'Neon Harbour',
            tag: 'NHB',
            description: 'Night crew out of the east docks. We run cargo, and we run it clean.',
            requirements: '18+\nMicrophone\nTwo nights a week, no more',
        },
    });

    const servidor = await api('/servers', {
        method: 'POST', headers: token,
        body: {
            name: 'Leonida Nights',
            region: 'EU',
            description: 'Serious roleplay, European hours, 200 slots.',
        },
    });

    /* Um servidor sem passado não tem tira de atividade nem lugar no
     * diretório por onde há gente: são dois ecrãs em branco. */
    const chave = await api(`/servers/${servidor.id}/api-keys`, {
        method: 'POST', headers: token, body: { label: 'heartbeat' },
    });

    for (const quantos of [31, 48, 64, 87, 112, 140, 155, 148, 121, 96, 73, 52]) {
        await api('/ingest/heartbeat', {
            method: 'POST', headers: aut(chave.key), body: { playersOnline: quantos },
        });
    }

    /* Mais crews, para o diretório e o quadro de recrutamento terem
     * mais do que uma linha. */
    for (const [dono, nome, tag, procura] of [
        ['marlowe', 'Ocean View Syndicate', 'OVS', '21+ only. We move slow and we do not get caught.'],
        ['delacroix', 'Little Haiti Riders', 'LHR', 'Bikes. Bring your own, or earn one.'],
        ['vance', 'Port Authority', 'PRT', 'Looking for two drivers and someone who can talk.'],
    ]) {
        const crewDele = await api('/crews', {
            method: 'POST', headers: aut(contas.get(dono).accessToken),
            body: { name: nome, tag, requirements: procura },
        });

        await api(`/crews/${crewDele.id}`, {
            method: 'PATCH', headers: aut(contas.get(dono).accessToken),
            body: { isRecruiting: true },
        });
    }

    /*
     * A crew passa a jogar no servidor.
     *
     * Não é enfeite: só quem joga num servidor pode anunciar no mercado
     * dele, e sem isto metade dos ecrãs do mercado ficava fechada. Pede
     * a crew, aceita quem manda no servidor — as duas pontas, mesmo
     * sendo a mesma pessoa dos dois lados.
     */
    await api(`/crews/${crew.id}/affiliation`, {
        method: 'POST', headers: token,
        body: { serverId: servidor.id },
    });

    await api(`/servers/${servidor.id}/affiliations/${crew.id}/accept`, {
        method: 'POST', headers: token,
    }).catch(() => undefined);

    /*
     * O evento, do princípio ao fim: marcado, com gente inscrita,
     * presenças confirmadas e terminado. É o que dá XP à crew e o que
     * dá pesos à divisão por participação — sem ele, metade dos números
     * dos ecrãs seria zero.
     */
    const evento = await api(`/events/crews/${crew.id}`, {
        method: 'POST', headers: token,
        body: {
            name: 'Bank job on Ocean Drive',
            description: 'Two cars, one lookout. We leave from the east docks at nine.',
            startsAt: new Date(Date.now() - 3 * 86_400_000).toISOString(),
            isPublic: true,
        },
    });

    for (const nome of ['marlowe', 'delacroix', 'okonkwo']) {
        /* Pede-se e o líder aceita: é assim que se entra numa crew, e
         * não há atalho — o que também deixa rasto no histórico. */
        await api(`/crews/${crew.id}/join`, {
            method: 'POST', headers: aut(contas.get(nome).accessToken),
            body: { message: 'Two nights a week, and I can drive.' },
        });

        await api(`/crews/${crew.id}/requests/${contas.get(nome).user.id}/accept`, {
            method: 'POST', headers: token,
        });

        await api(`/events/${evento.id}/signup`, {
            method: 'POST', headers: aut(contas.get(nome).accessToken),
        }).catch(() => undefined);
    }

    await api(`/events/${evento.id}/signup`, { method: 'POST', headers: token })
        .catch(() => undefined);

    await api(`/events/${evento.id}/status`, {
        method: 'PATCH', headers: token, body: { status: 'ongoing' },
    }).catch(() => undefined);

    for (const nome of ['kestrel', 'marlowe', 'delacroix']) {
        await api(
            `/events/${evento.id}/participants/${contas.get(nome).user.id}/confirm`,
            { method: 'POST', headers: token },
        ).catch(() => undefined);
    }

    await api(
        `/events/${evento.id}/participants/${contas.get('okonkwo').user.id}/no-show`,
        { method: 'POST', headers: token },
    ).catch(() => undefined);

    await api(`/events/${evento.id}/status`, {
        method: 'PATCH', headers: token, body: { status: 'completed' },
    }).catch(() => undefined);

    /* E um que ainda está para vir, para a agenda não ser só história. */
    await api(`/events/crews/${crew.id}`, {
        method: 'POST', headers: token,
        body: {
            name: 'Cargo run, east docks',
            description: 'Three trucks. Bring someone who can drive slowly.',
            startsAt: new Date(Date.now() + 2 * 86_400_000).toISOString(),
            isPublic: true,
        },
    });

    /*
     * O dinheiro. Cada movimento nasce pendente e é aprovado a seguir:
     * é assim que a tesouraria funciona, e é por isso que o saldo
     * disponível é diferente do liquidado.
     */
    const movimentos = [
        ['credit', 'contribution', 'Monthly dues, eleven members', '180000'],
        ['credit', 'event', 'Ocean Drive job, crew share', '420000'],
        ['debit', 'server_costs', 'Server slot rental, September', '95000'],
        ['debit', 'marketing', 'Recruitment post, two weeks', '30000'],
    ];

    for (const [direction, category, description, amount] of movimentos) {
        const movimento = await api(`/treasury/crews/${crew.id}/movements`, {
            method: 'POST', headers: token,
            body: { direction, category, description, amount },
        });

        await api(`/treasury/crews/${crew.id}/movements/${movimento.id}/approve`, {
            method: 'POST', headers: token,
        }).catch(() => undefined);
    }

    /* Um por decidir, que é o que faz o disponível valer a pena. */
    await api(`/treasury/crews/${crew.id}/movements`, {
        method: 'POST', headers: token,
        body: {
            direction: 'debit', category: 'prize',
            description: 'Prize for the race on Friday', amount: '75000',
        },
    }).catch(() => undefined);

    await api(`/treasury/crews/${crew.id}/distributions`, {
        method: 'POST', headers: token,
        body: {
            basis: 'participation',
            eventId: evento.id,
            note: 'Ocean Drive job, split by who actually turned up.',
        },
    }).catch(() => undefined);

    /*
     * O mercado. Quatro anúncios em categorias diferentes, um vendido
     * com avaliação: a nota de um vendedor só aparece quando houve
     * mesmo uma venda.
     */
    const anuncios = [];

    for (const [dono, category, title, body, price] of [
        ['kestrel', 'vehicle', 'Banshee 900R, custom paint', 'Hand-over at the docks after eight. Open to a trade.', '250000'],
        ['kestrel', 'property', 'Garage, six slots, west side', 'Quiet street, no neighbours who ask questions.', '1400000'],
        ['marlowe', 'service', 'Driver for hire, nights', 'I take a flat fee, not a cut. Two jobs a week.', '45000'],
        ['delacroix', 'item', 'Armoured plates, set of four', 'Pulled from a truck that no longer needs them.', '80000'],
    ]) {
        anuncios.push(await api(`/market/servers/${servidor.id}/listings`, {
            method: 'POST', headers: aut(contas.get(dono).accessToken),
            body: { category, title, body, price },
        }));
    }

    const [banshee] = anuncios;

    const conversa = await api(`/market/listings/${banshee.id}/conversations`, {
        method: 'POST', headers: aut(contas.get('vance').accessToken),
    });

    for (const [quem, texto] of [
        ['vance', 'Is it still up? I can be at the docks tonight.'],
        ['kestrel', 'Still up. Half past eight, by the blue warehouse.'],
        ['vance', 'See you there. I am bringing cash, not a trade.'],
    ]) {
        await api(`/market/conversations/${conversa.id}/messages`, {
            method: 'POST', headers: aut(contas.get(quem).accessToken),
            body: { body: texto },
        });
    }

    await api(`/market/listings/${banshee.id}/close`, {
        method: 'POST', headers: token, body: { outcome: 'sold' },
    }).catch(() => undefined);

    const avaliacao = await api(`/market/listings/${banshee.id}/reviews`, {
        method: 'POST', headers: aut(contas.get('vance').accessToken),
        body: { rating: 5, body: 'Turned up when he said he would. Car was as described.' },
    }).catch(() => null);

    if (avaliacao) {
        await api(`/market/reviews/${avaliacao.id}/reply`, {
            method: 'POST', headers: token,
            body: { body: 'Good buyer. Cash counted, no haggling at the door.' },
        }).catch(() => undefined);
    }

    /*
     * O fórum, com perguntas que alguém faria mesmo — e em partes
     * diferentes, para as capturas mostrarem as abas a servir para
     * alguma coisa. Um fórum inteiro na conversa geral fotografava-se
     * como um fórum sem categorias.
     */
    const topicos = [
        ['kestrel', 'crews', 'How do you split the money from a heist?',
            'There are five of us and the leader wants half. What do your crews do?'],
        ['marlowe', 'crews', 'Does anyone charge dues, or is that asking for trouble?',
            'We keep losing money on server costs and nobody wants to be the one to bring it up.'],
        ['okonkwo', 'servers', 'Best hours to find a full server in Europe?',
            'Nine to midnight is packed. Anything before that and I am talking to myself.'],
    ];

    let primeiro = null;

    for (const [quem, category, title, body] of topicos) {
        const topico = await api('/forum/topics', {
            method: 'POST', headers: aut(contas.get(quem).accessToken),
            body: { title, body, category },
        });

        primeiro ??= topico;

        let primeiraResposta = null;

        for (const [respondeu, texto] of [
            ['marlowe', 'Confirm who turned up and split by participation. It settles every argument we used to have.'],
            ['delacroix', 'Half for the leader only works until the leader needs four people who will say yes.'],
        ]) {
            const resposta = await api(`/forum/topics/${topico.id}/replies`, {
                method: 'POST', headers: aut(contas.get(respondeu).accessToken),
                body: { body: texto },
            });

            primeiraResposta ??= resposta;
        }

        /*
         * O primeiro tópico fica resolvido e os outros não.
         *
         * Um fórum onde está tudo resolvido mostra tanto como um onde
         * não está nada: o que se quer ver nas capturas é a diferença
         * entre as perguntas que alguém respondeu e as que estão à
         * espera de quem saiba.
         */
        if (topico.id === primeiro.id && primeiraResposta !== null) {
            await api(`/forum/replies/${primeiraResposta.id}/accept`, {
                method: 'POST', headers: aut(contas.get(quem).accessToken),
            });
        }
    }

    /* Uma denúncia por decidir, para a fila de quem modera não estar vazia. */
    const spam = await api('/forum/topics', {
        method: 'POST', headers: aut(contas.get('vance').accessToken),
        body: {
            title: 'JOIN MY SERVER 500 SLOTS FREE MONEY',
            body: 'IP in my profile, infinite cash and everything unlocked.',
        },
    });

    await api(`/forum/topics/${spam.id}/reports`, {
        method: 'POST', headers: token,
        body: { reason: 'spam', note: 'Advertising. Third time this week.' },
    });

    /* Amizades, para o perfil não dizer que ninguém conhece ninguém. */
    for (const nome of ['marlowe', 'delacroix']) {
        await api(`/friends/${contas.get(nome).user.id}`, {
            method: 'POST', headers: token,
        }).catch(() => undefined);

        await api(`/friends/${contas.get('kestrel').user.id}/accept`, {
            method: 'POST', headers: aut(contas.get(nome).accessToken),
        }).catch(() => undefined);
    }

    return {
        email: 'kestrel@vicehub.test',
        username: 'kestrel',
        password: PASSWORD,
        crewId: crew.id,
        serverId: servidor.id,
        eventoId: evento.id,
        anuncioId: anuncios[1].id,
        conversaId: conversa.id,
        topicoId: primeiro.id,
    };
};

const abrirPlaywright = async () => {
    const caminho = process.env.PLAYWRIGHT_MODULE ?? 'playwright';
    const modulo = await import(caminho);

    return modulo.chromium ?? modulo.default?.chromium;
};

const retratar = async () => {
    const jaLaEsta = await fetch(`${BASE}/api/v1/users/kestrel`)
        .then((r) => r.ok)
        .catch(() => false);

    if (jaLaEsta) {
        console.error(
            'A conta "kestrel" já existe nesta base. Os nomes aqui são fixos,'
            + ' e nomes fixos só são únicos uma vez: limpa a base'
            + ' (`npm run db:migrate:reset --workspace @vicehub/database`) antes de retratar.',
        );
        process.exit(2);
    }

    console.log(`a semear em ${BASE}…`);
    const semente = await semear();

    const chromium = await abrirPlaywright();
    const navegador = await chromium.launch({
        ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}),
    });

    fs.mkdirSync(PARA, { recursive: true });

    for (const [largura, sufixo, escala] of [[390, 'telemovel', 2], [1280, 'portatil', 1]]) {
        const contexto = await navegador.newContext({
            viewport: { width: largura, height: 900 },
            deviceScaleFactor: escala,
        });

        const pagina = await contexto.newPage();
        const erros = [];
        pagina.on('pageerror', (erro) => erros.push(String(erro).slice(0, 140)));

        const tirar = async (ecra) => {
            await pagina.goto(`${BASE}${ecra.rota(semente)}`, { waitUntil: 'networkidle' });
            await pagina.evaluate(() => document.fonts.ready);
            await pagina.waitForTimeout(450);
            await pagina.screenshot({
                path: path.join(PARA, `${ecra.nome}-${sufixo}.png`),
                fullPage: true,
            });
        };

        for (const ecra of ECRAS.filter((e) => e.sessao === false)) await tirar(ecra);

        await pagina.goto(`${BASE}/entrar`, { waitUntil: 'networkidle' });
        await pagina.fill('#email', semente.email);
        await pagina.fill('#password', semente.password);
        await pagina.click('button.primary');
        await pagina.waitForTimeout(1800);

        for (const ecra of ECRAS.filter((e) => e.sessao !== false)) await tirar(ecra);

        console.log(`${largura}px: ${ECRAS.length} ecrãs${erros.length ? ` — ERROS: ${erros.join(' | ')}` : ''}`);
        await contexto.close();
    }

    await navegador.close();
    console.log(`feito: ${ECRAS.length * 2} imagens em ${PARA}`);
};

await retratar();
