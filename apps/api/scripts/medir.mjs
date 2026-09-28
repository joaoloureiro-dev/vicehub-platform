/**
 * Quantas consultas é que cada ecrã custa à base de dados.
 *
 * Não mede tempo, ou mede-o de passagem. O tempo de uma máquina de
 * desenvolvimento com seiscentos utilizadores não diz nada sobre uma
 * base gerida do outro lado do Atlântico; o **número de consultas por
 * pedido**, esse, é o mesmo aqui e lá, e é ele que decide se uma página
 * abre depressa quando cada ida à base custa dez milissegundos em vez
 * de meio.
 *
 * É assim que se apanha o N+1: uma lista de vinte linhas que faz vinte
 * e uma consultas não se distingue de uma que faz duas enquanto a base
 * está ao lado do processo. Com a base em Frankfurt e o processo em
 * Londres, uma abre num piscar e a outra leva um quarto de segundo.
 *
 * Lê os números ao próprio Postgres, pelo `pg_stat_statements`: zera-o,
 * faz o pedido, e pergunta quantas instruções correram. Exige a
 * extensão:
 *
 *     shared_preload_libraries = 'pg_stat_statements'   # postgresql.conf
 *     CREATE EXTENSION pg_stat_statements;
 *
 * Sem ela diz-se o que falta e sai — não inventa um número.
 *
 *     npm run medir --workspace @vicehub/api
 *
 * Opções: `--base=http://127.0.0.1:4011`, `--db=postgresql://…`,
 * `--repeticoes=5`, `--tecto=15`.
 *
 * **Compara com o que já custava.** Um tecto fixo não serve aqui: um
 * pedido que junta seis coisas custa mais do que um que lê uma lista, e
 * pô-los debaixo do mesmo número dá um aviso permanente — que é a
 * maneira mais certa de ninguém voltar a olhar para ele. O que
 * interessa é o que **cresce**, e por isso os números de hoje estão
 * gravados ao lado, em `medir-base.json`, e a queixa é sobre a
 * diferença.
 *
 * Sai com código 1 se algum ecrã passar o que custava, mais a folga.
 * `--gravar` reescreve a referência, para depois de uma mudança que a
 * justifique.
 */
import { readFileSync, writeFileSync } from 'node:fs';

import pg from 'pg';

const argumento = (nome, omissao) => {
    const encontrado = process.argv.find((a) => a.startsWith(`--${nome}=`));

    return encontrado === undefined ? omissao : encontrado.split('=')[1];
};

const BASE = `${argumento('base', 'http://127.0.0.1:4011')}/api/v1`;
const REPETICOES = Number(argumento('repeticoes', '5'));

/**
 * Quanto é que um ecrã pode crescer antes de valer a pena ir ver.
 *
 * Duas consultas: menos do que isso é o ruído de uma sessão a ser
 * revalidada ou de uma contagem que passou a caber noutra, e mais do
 * que isso é alguém a ter acrescentado uma ida à base sem reparar.
 */
const FOLGA = Number(argumento('folga', '2'));

const REFERENCIA = new URL('./medir-base.json', import.meta.url);

const base = (() => {
    try {
        return JSON.parse(readFileSync(REFERENCIA, 'utf8'));
    } catch {
        return {};
    }
})();

const sql = new pg.Client({
    connectionString:
        argumento('db', process.env['DATABASE_URL'] ?? ''),
});

await sql.connect();

try {
    await sql.query('SELECT pg_stat_statements_reset()');
} catch {
    console.error(
        'Falta o pg_stat_statements. Põe'
        + " `shared_preload_libraries = 'pg_stat_statements'` no"
        + ' postgresql.conf, reinicia, e corre `CREATE EXTENSION'
        + ' pg_stat_statements;` na base que a API usa.',
    );

    process.exit(2);
}

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

const marca = `m${Date.now().toString().slice(-7)}`;
const aut = (t) => ({ authorization: `Bearer ${t}` });
const etiqueta = () =>
    Array.from({ length: 6 }, () =>
        'ABCDEFGHJKLMNPQRSTUVWXYZ'[Math.floor(Math.random() * 24)]).join('');

const conta = await api('/auth/register', {
    method: 'POST',
    body: {
        email: `${marca}@vicehub.test`,
        username: marca,
        password: 'Sup3rS3cret!Pass',
    },
});

const token = conta.accessToken;

/**
 * Quatro crews e quatro servidores próprios.
 *
 * Não uma de cada, e é uma diferença que já custou: com uma comunidade
 * só, um pedido que faz duas consultas **por comunidade** custa quase o
 * mesmo que um que faz duas ao todo, e a medição não distingue os dois.
 * Foi assim que um N+1 na caixa do que espera resposta — lida em todos
 * os ecrãs, porque a casca mostra o número — passou despercebido até
 * alguém somar oito comunidades.
 *
 * Quatro de cada chegam para a diferença sair do ruído e são baratas de
 * montar. Quem quiser ver a inclinação a sério muda aqui.
 */
const COMUNIDADES = 4;

const minhasCrews = [];
const meusServidores = [];

for (let i = 0; i < COMUNIDADES; i += 1) {
    minhasCrews.push(await api('/crews', {
        method: 'POST', headers: aut(token),
        body: { name: `Crew ${marca} ${i}`, tag: etiqueta() },
    }));

    meusServidores.push(await api('/servers', {
        method: 'POST', headers: aut(token),
        body: { name: `Server ${marca} ${i}`, region: 'EU' },
    }));
}

const crew = minhasCrews[0];
const servidor = meusServidores[0];

/*
 * E uns quantos do que já lá está, que é onde as listas têm linhas a
 * sério. Uma medição sobre uma crew acabada de criar mede uma lista
 * vazia, que é o erro que a varredura já pagou caro.
 */
const diretorio = await api('/crews?page=1');
const crewCheia = diretorio.items?.[0]?.id ?? diretorio.crews?.[0]?.id ?? crew.id;

const servidores = await api('/servers?page=1');
const servidorCheio =
    servidores.items?.[0]?.id ?? servidores.servers?.[0]?.id ?? servidor.id;

const topicos = await api('/forum/topics?page=1');
const topico = topicos.topics?.[0]?.id;

const ECRAS = [
    ['o diretório de crews', '/crews?page=1', false],
    ['o diretório de servidores', '/servers?page=1', false],
    ['quem está a recrutar', '/crews?page=1&recruiting=true', false],
    ['a lista do fórum', '/forum/topics?page=1', false],
    ['uma pergunta com respostas', `/forum/topics/${topico}`, false],
    ['o perfil de uma crew', `/crews/${crewCheia}`, false],
    ['o perfil de um servidor', `/servers/${servidorCheio}`, false],
    ['o quadro de um servidor', `/servers/${servidorCheio}/leaderboard`, false],
    ['as crews de um servidor', `/servers/${servidorCheio}/affiliations`, false],
    ['o mercado de um servidor', `/market/servers/${servidorCheio}/listings`, false],
    ['a escada de preços', '/billing/plans', false],
    ['os meus avisos', '/notifications', true],
    ['as minhas crews', '/crews/me/memberships', true],
    ['os meus servidores', '/servers/me/memberships', true],
    ['o que espera resposta', '/users/me/pending', true],
    ['a minha carteira', '/treasury/me', true],
    /* Os movimentos vêm dentro deste: é o ecrã da tesouraria inteiro. */
    ['a tesouraria de uma crew', `/treasury/crews/${crew.id}`, true],
    ['o calendário de uma crew', `/events/crews/${crew.id}`, true],
];

const medidas = [];

for (const [nome, caminho, comSessao] of ECRAS) {
    const opcoes = comSessao ? { headers: aut(token) } : {};

    /* Uma vez a frio, fora da conta: a primeira paga o que as outras não. */
    const aquecer = await pedir(caminho, opcoes);

    if (aquecer.status >= 400) {
        console.log(
            `  —    ${String(aquecer.status).padEnd(3)} ${nome} (não respondeu)`,
        );

        continue;
    }

    await sql.query('SELECT pg_stat_statements_reset()');

    const inicio = performance.now();

    for (let i = 0; i < REPETICOES; i += 1) {
        await pedir(caminho, opcoes);
    }

    const tempo = (performance.now() - inicio) / REPETICOES;

    const { rows } = await sql.query(
        'SELECT coalesce(sum(calls), 0)::int AS total FROM pg_stat_statements',
    );

    /*
     * O `pg_stat_statements_reset()` conta-se a si próprio: uma chamada
     * dividida pelas repetições. Tira-se, ou cada medida vinha com uma
     * décima a mais que não é do ecrã.
     */
    const consultas = Math.max(0, rows[0].total - 1) / REPETICOES;

    const antes = base[nome];
    const passa = antes === undefined || consultas <= antes + FOLGA;

    medidas.push({ nome, consultas, tempo, passa, antes });

    console.log(
        `${passa ? '  ok  ' : 'CRESCEU'}`
        + ` ${consultas.toFixed(1).padStart(5)} consultas`
        + ` ${tempo.toFixed(0).padStart(4)} ms`
        + `   ${nome}`
        + (antes === undefined
            ? '  (novo)'
            : consultas === antes
                ? ''
                : `  (era ${antes})`),
    );
}

await sql.end();

if (process.argv.includes('--gravar')) {
    const gravado = Object.fromEntries(
        medidas.map((m) => [m.nome, Number(m.consultas.toFixed(1))]),
    );

    writeFileSync(REFERENCIA, `${JSON.stringify(gravado, null, 4)}\n`);

    console.log(`\nreferência gravada: ${medidas.length} ecrãs`);

    process.exit(0);
}

const cresceram = medidas.filter((m) => !m.passa);
const novos = medidas.filter((m) => m.antes === undefined);

console.log(
    `\n${medidas.length} ecrãs medidos · folga de ${FOLGA} consultas`
    + ` · ${cresceram.length} a crescer`
    + (novos.length === 0 ? '' : ` · ${novos.length} sem referência`),
);

for (const m of cresceram) {
    console.log(
        `  ✗ ${m.nome}: ${m.consultas.toFixed(1)} consultas, eram ${m.antes}`,
    );
}

if (cresceram.length > 0) {
    process.exitCode = 1;
}
