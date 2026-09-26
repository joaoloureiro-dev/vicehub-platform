/**
 * A varredura: o produto inteiro, ecrã a ecrã, medido num browser.
 *
 * Existe porque quatro defeitos seguidos passaram por mil e novecentos
 * testes sem uma queixa e apareceram no primeiro quarto de hora a olhar
 * para o ecrã: a barra de cima a transbordar num telemóvel, linhas de
 * texto com 137 caracteres, duas listas iguais com larguras diferentes,
 * e um número ao lado de um item de menu que um leitor de ecrã lia como
 * "Notifications3". Nenhum deles é um ecrã partido — são regras escritas
 * mais do que uma vez —, e o jsdom, onde correm os testes, não tem
 * layout nenhum: não há ali largura, nem linha, nem polegar.
 *
 * Isto não corre no CI. Precisa de um browser e de uma base de dados
 * com coisas lá dentro, e é para se correr à mão antes de uma entrega,
 * ou depois de mexer no desenho.
 *
 *   1. `npm run dev` na API, com a base de desenvolvimento
 *   2. `npm run build` na web (a API serve o `dist`)
 *   3. `npm run varrer --workspace @vicehub/web`
 *
 * Opções: `--largura=390` (ou 1280, ou as duas separadas por vírgula),
 * `--idiomas=en,pt,es,fr`, `--base=http://127.0.0.1:4011`, `--controlo`.
 *
 * **O controlo.** Uma varredura que não encontra nada e uma varredura
 * avariada dizem exactamente a mesma coisa. Com `--controlo`, o
 * programa começa por esticar um rótulo no próprio ecrã e exige que a
 * medição dê por ele; se não der, pára e diz que não se pode confiar
 * nela. É o mesmo que um mutante de controlo faz por uma suite de
 * testes.
 */

import { pathToFileURL } from 'node:url';

/**
 * Onde está o Playwright.
 *
 * Não é dependência deste pacote de propósito: são cento e tal
 * megabytes que o CI teria de instalar em todas as corridas para uma
 * ferramenta que o CI não corre. Quem a usa já o tem, ou diz onde está.
 */
const abrirPlaywright = async () => {
    const caminho = process.env.PLAYWRIGHT_MODULE ?? 'playwright';

    try {
        const modulo = await import(caminho);

        return modulo.chromium ?? modulo.default?.chromium;
    } catch {
        throw new Error(
            'Falta o Playwright. Instala-o (`npm i -D playwright`) ou aponta'
            + ' PLAYWRIGHT_MODULE para uma instalação que já exista.',
        );
    }
};

/**
 * Os ecrãs, e o que é preciso ter na base de dados para cada um.
 *
 * Escritos à mão, como os endereços dos alvos de denúncia: um ecrã novo
 * sem entrada aqui é um ecrã que ninguém volta a olhar, e há um teste
 * que falha quando as rotas da aplicação e esta lista deixam de bater
 * certo.
 *
 * `sessao: false` são os que só se veem sem conta: com uma, o produto
 * leva a pessoa para dentro e o que se mediria era outra página.
 */
export const ECRAS = [
    { nome: 'entrada', rota: () => '/', sessao: false },
    { nome: 'entrar', rota: () => '/entrar', sessao: false },
    { nome: 'registo', rota: () => '/registo', sessao: false },

    { nome: 'crews', rota: () => '/crews' },
    { nome: 'servidores', rota: () => '/servidores' },
    { nome: 'recrutamento', rota: () => '/recrutamento' },
    { nome: 'forum', rota: () => '/forum' },
    { nome: 'premium', rota: () => '/premium' },
    { nome: 'termos', rota: () => '/termos' },
    { nome: 'privacidade', rota: () => '/privacidade' },
    { nome: 'crew', rota: (s) => `/crews/${s.crewId}` },
    { nome: 'crew-nova', rota: () => '/crews/nova' },
    { nome: 'servidor', rota: (s) => `/servidores/${s.serverId}` },
    { nome: 'servidor-novo', rota: () => '/servidores/novo' },
    { nome: 'mercado', rota: (s) => `/servidores/${s.serverId}/mercado` },
    { nome: 'anuncio', rota: (s) => `/mercado/${s.anuncioId}` },
    { nome: 'conversas', rota: () => '/mercado/conversas' },
    { nome: 'conversa', rota: (s) => `/mercado/conversas/${s.conversaId}` },
    { nome: 'topico', rota: (s) => `/forum/${s.topicoId}` },
    { nome: 'moderacao', rota: () => '/moderacao' },
    { nome: 'perfil-publico', rota: (s) => `/u/${s.username}` },
    { nome: 'eu', rota: () => '/eu' },
    { nome: 'comunidades', rota: () => '/eu/comunidades' },
    { nome: 'carteira', rota: () => '/eu/carteira' },
    { nome: 'avisos', rota: () => '/avisos' },
    { nome: 'tesouraria-crew', rota: (s) => `/crews/${s.crewId}/tesouraria` },
    { nome: 'tesouraria-servidor', rota: (s) => `/servidores/${s.serverId}/tesouraria` },
    { nome: 'eventos', rota: (s) => `/crews/${s.crewId}/eventos` },
    { nome: 'evento', rota: (s) => `/crews/${s.crewId}/eventos/${s.eventoId}` },
    { nome: 'eventos-do-servidor', rota: (s) => `/servidores/${s.serverId}/eventos` },
];

/**
 * As rotas que esta varredura não abre, e porquê.
 *
 * Cada uma precisa de um segredo que só existe dentro de um email, ou
 * não é um ecrã. O teste que compara esta lista com as rotas da
 * aplicação lê daqui.
 */
export const DE_FORA = {
    '/recuperar-password': 'precisa do código que vai no email',
    '/confirmar-email': 'precisa do token que vai no email',
    '*': 'não é um ecrã: manda para a entrada',
    '/servidores/:serverId/eventos/:eventId': 'o mesmo ecrã do evento de uma crew',
};

const PASSWORD = 'Sup3rS3cret!Pass';

const semear = async (base) => {
    const marca = Date.now().toString().slice(-7);

    const api = async (caminho, opcoes = {}) => {
        const resposta = await fetch(`${base}/api/v1${caminho}`, {
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

    const registar = (nome) =>
        api('/auth/register', {
            method: 'POST',
            body: { email: `${nome}@vicehub.test`, username: nome, password: PASSWORD },
        });

    const aut = (token) => ({ authorization: `Bearer ${token}` });

    const eu = await registar(`vr${marca}`);
    const outra = await registar(`vo${marca}`);

    /* Um perfil vazio mede outra coisa: metade dos ecrãs ficava sem nada. */
    await api('/users/me', {
        method: 'PATCH', headers: aut(eu.accessToken),
        body: { bio: 'Jogo à noite, quase sempre no porto. Condutor de fuga.' },
    });

    const crew = await api('/crews', {
        method: 'POST', headers: aut(eu.accessToken),
        body: { name: `Os Corredores ${marca}`, tag: `V${marca.slice(-3)}` },
    });

    const servidor = await api('/servers', {
        method: 'POST', headers: aut(eu.accessToken),
        body: { name: `Vice City Roleplay ${marca}`, region: 'EU' },
    });

    const evento = await api(`/events/crews/${crew.id}`, {
        method: 'POST', headers: aut(eu.accessToken),
        body: {
            name: `Assalto ao banco central ${marca}`,
            startsAt: new Date(Date.now() + 86_400_000).toISOString(),
        },
    });

    const anuncio = await api(`/market/servers/${servidor.id}/listings`, {
        method: 'POST', headers: aut(eu.accessToken),
        body: {
            category: 'vehicle',
            title: `Banshee 900R, pintura personalizada ${marca}`,
            body: 'Entrego no parque do porto depois das oito. Aceito troca.',
            price: '250000',
        },
    });

    const conversa = await api(`/market/listings/${anuncio.id}/conversations`, {
        method: 'POST', headers: aut(outra.accessToken),
    });

    await api(`/market/conversations/${conversa.id}/messages`, {
        method: 'POST', headers: aut(outra.accessToken),
        body: { body: 'A que horas entregas? Estou no porto até às dez.' },
    });

    await api(`/market/conversations/${conversa.id}/messages`, {
        method: 'POST', headers: aut(eu.accessToken),
        body: { body: 'Às oito e meia, junto ao armazém azul.' },
    });

    const topico = await api('/forum/topics', {
        method: 'POST', headers: aut(eu.accessToken),
        body: {
            title: `Como se divide o dinheiro de um assalto? ${marca}`,
            body: 'Somos cinco e o líder quer levar metade. Como fazem as vossas crews?',
        },
    });

    await api(`/forum/topics/${topico.id}/replies`, {
        method: 'POST', headers: aut(outra.accessToken),
        body: { body: 'Confirmas as presenças e divides por participação.' },
    });

    /* Uma denúncia por decidir, para a fila de quem modera não estar vazia. */
    const doOutro = await api('/forum/topics', {
        method: 'POST', headers: aut(outra.accessToken),
        body: {
            title: `Entra no meu servidor, 500 slots ${marca}`,
            body: 'IP no perfil, dinheiro infinito e carros desbloqueados.',
        },
    });

    await api(`/forum/topics/${doOutro.id}/reports`, {
        method: 'POST', headers: aut(eu.accessToken),
        body: { reason: 'spam', note: 'Publicidade. Já postou isto três vezes.' },
    });

    return {
        marca,
        email: `vr${marca}@vicehub.test`,
        username: `vr${marca}`,
        crewId: crew.id,
        serverId: servidor.id,
        eventoId: evento.id,
        anuncioId: anuncio.id,
        conversaId: conversa.id,
        topicoId: topico.id,
    };
};

/**
 * O que se mede em cada ecrã.
 *
 * Corre dentro da página, e por isso está escrito como uma função que
 * se serializa: nada aqui pode fechar sobre variáveis de fora.
 */
const MEDICAO = () => {
    const janela = document.documentElement.clientWidth;

    const dentroDeUmScroller = (elemento) => {
        for (let pai = elemento.parentElement; pai; pai = pai.parentElement) {
            const transbordo = getComputedStyle(pai).overflowX;

            if (transbordo === 'auto' || transbordo === 'scroll') {
                return true;
            }
        }

        return false;
    };

    const nome = (elemento) =>
        `${elemento.tagName}.${String(elemento.className).slice(0, 24)}`
        + ` "${(elemento.textContent ?? '').trim().slice(0, 24)}"`;

    /*
     * Quantas linhas é que o texto de um elemento ocupa.
     *
     * Os retângulos de uma selecção são um por pedaço desenhado, e
     * pedaços da mesma linha partilham o topo — contam-se topos e não
     * retângulos. O que está fora do fluxo não conta: o texto que só se
     * ouve está posicionado em absoluto, noutro sítio do ecrã, e fazia
     * todos os botões parecerem ter duas linhas.
     */
    const quantasLinhas = (elemento) => {
        const topos = new Set();

        for (const no of elemento.childNodes) {
            if (no.nodeType === Node.ELEMENT_NODE) {
                const posicao = getComputedStyle(no).position;

                if (posicao === 'absolute' || posicao === 'fixed') {
                    continue;
                }
            }

            const intervalo = document.createRange();
            intervalo.selectNodeContents(no);

            for (const caixa of intervalo.getClientRects()) {
                if (caixa.width > 0) {
                    topos.add(Math.round(caixa.top / 4));
                }
            }
        }

        return topos.size;
    };

    const medidor = document.createElement('canvas').getContext('2d');

    const porLinha = (elemento) => {
        const estilo = getComputedStyle(elemento);
        medidor.font = `${estilo.fontSize} ${estilo.fontFamily}`;

        const largura =
            medidor.measureText('abcdefghijklmnopqrstuvwxyz').width / 26;

        return Math.round(elemento.getBoundingClientRect().width / largura);
    };

    return {
        /* A página inteira a arrastar-se de lado. */
        arrasta: document.documentElement.scrollWidth > janela + 1,

        foraDoEcra: [...document.querySelectorAll('body *')]
            .filter((elemento) => {
                const caixa = elemento.getBoundingClientRect();

                if (caixa.width === 0 || caixa.height === 0) return false;
                if (getComputedStyle(elemento).position === 'fixed') return false;

                return (caixa.right > janela + 1 || caixa.left < -1)
                    && !dentroDeUmScroller(elemento);
            })
            .slice(0, 4)
            .map(nome),

        /* Texto que não cabe na caixa onde está. */
        cortado: [...document.querySelectorAll('body *')]
            .filter((elemento) => {
                if (elemento.children.length > 0) return false;

                const estilo = getComputedStyle(elemento);

                if (estilo.display === 'none') return false;
                if (String(elemento.className).includes('sr-only')) return false;

                /*
                 * Cortado de propósito não é cortado: um excerto de
                 * aviso, a última mensagem de uma conversa na caixa de
                 * entrada. As reticências são a própria declaração de
                 * que ali cabe uma linha — e é essa declaração que se
                 * lê aqui, em vez de uma lista de nomes de classes que
                 * envelhece à terceira.
                 */
                if (estilo.textOverflow === 'ellipsis') return false;
                if (estilo.webkitLineClamp !== 'none') return false;

                if (dentroDeUmScroller(elemento)) return false;

                return elemento.scrollWidth > elemento.clientWidth + 2
                    && elemento.clientWidth > 0;
            })
            .slice(0, 5)
            .map(nome),

        /*
         * Um rótulo de controlo que passou a duas linhas **por estar
         * apertado**.
         *
         * Um botão que ocupa a largura toda do que o rodeia e ainda
         * assim quebra é uma frase comprida, não um aperto: em francês,
         * "Enregistrer la personnalisation" leva duas linhas num botão
         * de 293 pixéis e está bem assim. O que interessa é o botão que
         * quebra por ter outro ao lado a disputar-lhe a largura.
         */
        aDuasLinhas: [...document.querySelectorAll('button, .aba, .pill, nav a')]
            .filter((elemento) => {
                if (elemento.clientHeight === 0) return false;
                if ((elemento.textContent ?? '').trim().length === 0) return false;
                if (quantasLinhas(elemento) <= 1) return false;

                const pai = elemento.parentElement;

                if (pai === null) return true;

                const largura = elemento.getBoundingClientRect().width;
                const doPai = pai.getBoundingClientRect().width
                    - parseFloat(getComputedStyle(pai).paddingLeft)
                    - parseFloat(getComputedStyle(pai).paddingRight);

                return largura < doPai * 0.95;
            })
            .slice(0, 5)
            .map(nome),

        /* Linhas de texto compridas de mais para se lerem sem esforço. */
        linhasCompridas: [...document.querySelectorAll('p, li, dd')]
            .filter((elemento) =>
                (elemento.textContent ?? '').trim().length > 150
                && elemento.children.length === 0
                && porLinha(elemento) > 95)
            .slice(0, 3)
            .map((elemento) => `${porLinha(elemento)} caracteres: ${nome(elemento)}`),

        /* Alvos de toque pequenos de mais, e sozinhos no seu bloco. */
        alvosPequenos: [...document.querySelectorAll('a, button, select')]
            .filter((elemento) => {
                const caixa = elemento.getBoundingClientRect();

                if (caixa.height === 0 || caixa.height >= 24) return false;

                const pai = elemento.parentElement;

                return pai !== null && [...pai.childNodes].every(
                    (no) => no === elemento || (no.textContent ?? '').trim() === '',
                );
            })
            .slice(0, 4)
            .map((elemento) =>
                `${Math.round(elemento.getBoundingClientRect().height)}px: ${nome(elemento)}`),
    };
};

const queixasDe = (medido) => {
    const queixas = [];

    if (medido.arrasta) queixas.push('arrasta de lado');
    if (medido.foraDoEcra.length) queixas.push(`fora do ecrã: ${medido.foraDoEcra.join(' | ')}`);
    if (medido.cortado.length) queixas.push(`cortado: ${medido.cortado.join(' | ')}`);
    if (medido.aDuasLinhas.length) queixas.push(`a duas linhas: ${medido.aDuasLinhas.join(' | ')}`);
    if (medido.linhasCompridas.length) queixas.push(`linhas compridas: ${medido.linhasCompridas.join(' | ')}`);
    if (medido.alvosPequenos.length) queixas.push(`alvos pequenos: ${medido.alvosPequenos.join(' | ')}`);

    return queixas;
};

const varrer = async () => {
    const argumento = (nome, omissao) => {
        const encontrado = process.argv.find((a) => a.startsWith(`--${nome}=`));

        return encontrado === undefined ? omissao : encontrado.split('=')[1];
    };

    const base = argumento('base', 'http://127.0.0.1:4011');
    const larguras = argumento('largura', '390,1280').split(',').map(Number);
    const idiomas = argumento('idiomas', 'en,pt,es,fr').split(',');
    const comControlo = process.argv.includes('--controlo');

    const chromium = await abrirPlaywright();

    console.log(`a semear em ${base}…`);
    const semente = await semear(base);

    const navegador = await chromium.launch({
        ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}),
    });

    /*
     * O controlo, antes de tudo o resto.
     *
     * Estica-se um rótulo no próprio ecrã e exige-se que a medição dê
     * por ele. Uma varredura avariada e uma varredura limpa dizem
     * exactamente a mesma coisa, e esta é a única maneira de as
     * distinguir — é o que um mutante de controlo faz por uma suite de
     * testes.
     */
    if (comControlo) {
        const contexto = await navegador.newContext({
            viewport: { width: 390, height: 900 },
        });

        const pagina = await contexto.newPage();

        await pagina.goto(`${base}/crews`, { waitUntil: 'networkidle' });
        await pagina.waitForTimeout(600);

        const esticou = await pagina.evaluate(() => {
            /*
             * Um alvo que não viva dentro de um rolo horizontal: a
             * barra dos destinos rola de propósito, e um rótulo
             * esticado lá dentro não transborda nada — a primeira
             * versão deste controlo escolheu-a, e falhou por isso.
             */
            const alvo = document.querySelector('.topbar nav a, .topbar nav button');

            if (!alvo) return false;

            /*
             * Uma palavra só, sem espaços por onde quebrar: um rótulo
             * comprido mas com espaços apenas passa a duas linhas, e há
             * sítios onde isso é aceitável. Isto não cabe de maneira
             * nenhuma, e é isso que a medição tem de notar.
             */
            alvo.textContent =
                'Rótuloabsurdamentecompridosemespaçosnenhunspornãocaberdemaneiranenhuma';

            return true;
        });

        const medido = esticou ? await pagina.evaluate(MEDICAO) : null;

        /*
         * Qualquer uma das medições serve: o que se pergunta é se ela
         * dá por um rótulo que não cabe, e não de que maneira. Consoante
         * o sítio, isso aparece como a página a arrastar-se, como um
         * elemento fora do ecrã, como texto cortado ou como um rótulo a
         * duas linhas.
         */
        const deuPorEle = medido !== null
            && (medido.arrasta
                || medido.foraDoEcra.length > 0
                || medido.cortado.length > 0
                || medido.aDuasLinhas.length > 0);

        await contexto.close();

        if (!deuPorEle) {
            console.error(
                'O controlo falhou: a medição não deu por um rótulo esticado.'
                + ' Não se pode confiar no resto desta corrida.',
            );

            await navegador.close();
            process.exit(2);
        }

        console.log('controlo: a medição dá por um rótulo esticado ✓');
    }

    let queixasTotais = 0;

    for (const largura of larguras) {
        for (const idioma of idiomas) {
            const contexto = await navegador.newContext({
                viewport: { width: largura, height: 900 },
            });

            const pagina = await contexto.newPage();
            const erros = [];
            pagina.on('pageerror', (erro) => erros.push(`ERRO: ${String(erro).slice(0, 110)}`));

            await pagina.goto(`${base}/`, { waitUntil: 'domcontentloaded' });
            await pagina.evaluate(
                (valor) => window.localStorage.setItem('vicehub.idioma', valor),
                idioma,
            );

            const abrir = async (rota) => {
                await pagina.goto(`${base}${rota}`, { waitUntil: 'networkidle' });
                await pagina.evaluate(() => document.fonts.ready);
                await pagina.waitForTimeout(600);
            };

            const olhar = async (ecra) => {
                const antes = erros.length;

                await abrir(ecra.rota(semente));

                const queixas = [
                    ...queixasDe(await pagina.evaluate(MEDICAO)),
                    ...erros.slice(antes),
                ];

                if (queixas.length > 0) {
                    console.log(`✗ [${idioma} ${largura}px] ${ecra.nome}`);

                    for (const queixa of queixas) {
                        console.log(`      ${queixa}`);
                    }
                }

                return queixas.length;
            };


            for (const ecra of ECRAS.filter((e) => e.sessao === false)) {
                queixasTotais += await olhar(ecra);
            }

            await pagina.goto(`${base}/entrar`, { waitUntil: 'networkidle' });
            await pagina.fill('#email', semente.email);
            await pagina.fill('#password', PASSWORD);
            await pagina.click('button.primary');
            await pagina.waitForTimeout(1500);

            for (const ecra of ECRAS.filter((e) => e.sessao !== false)) {
                queixasTotais += await olhar(ecra);
            }

            await contexto.close();
        }
    }

    await navegador.close();

    console.log(
        queixasTotais === 0
            ? `nada a apontar em ${ECRAS.length} ecrãs, ${idiomas.length} idiomas e ${larguras.length} larguras`
            : `${queixasTotais} coisas a apontar`,
    );

    process.exit(queixasTotais === 0 ? 0 : 1);
};

/* Só corre quando é chamado; o teste que lê a lista de ecrãs importa-o. */
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    await varrer();
}
