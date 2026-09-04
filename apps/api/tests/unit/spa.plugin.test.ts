import Fastify from 'fastify';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

/**
 * Servir a interface a partir da própria API não é arrumação: o refresh
 * token vive num cookie `SameSite=strict`, e um cookie posto por uma
 * origem não segue num pedido feito a partir de outra. Duas origens
 * diferentes e a sessão morre a cada F5, sem nada no ecrã a explicar
 * porquê.
 *
 * O que estes testes fixam é a fronteira: o que é da aplicação recebe a
 * página, o que é da API recebe JSON, e nenhum dos dois recebe o do
 * outro.
 */

const HTML = '<!doctype html><html><body><div id="root"></div></body></html>';
const JAVASCRIPT = 'console.log("olá");';

let dist: string;
let vazia: string;

beforeAll(async () => {
    dist = await mkdtemp(path.join(os.tmpdir(), 'vicehub-dist-'));
    await writeFile(path.join(dist, 'index.html'), HTML, 'utf8');
    await writeFile(path.join(dist, 'favicon.png'), 'png', 'utf8');
    await mkdir(path.join(dist, 'assets'));
    await writeFile(
        path.join(dist, 'assets', 'app-9f3c1a.js'),
        JAVASCRIPT,
        'utf8',
    );

    vazia = await mkdtemp(path.join(os.tmpdir(), 'vicehub-vazia-'));
});

afterEach(() => {
    delete process.env['WEB_DIST_PATH'];
    vi.resetModules();
});

/**
 * O plugin lê a configuração ao ser carregado, por isso cada cenário
 * volta a importar os módulos com o ambiente que quer exercitar.
 */
const app = async (raiz?: string) => {
    vi.resetModules();

    if (raiz === undefined) {
        delete process.env['WEB_DIST_PATH'];
    } else {
        process.env['WEB_DIST_PATH'] = raiz;
    }

    const [{ default: spaPlugin }, { default: securityPlugin }] =
        await Promise.all([
            import('../../src/plugins/http/spa.plugin.js'),
            import('../../src/plugins/http/security.plugin.js'),
        ]);

    const instancia = Fastify({ logger: false });

    await instancia.register(securityPlugin);

    instancia.get('/api/v1/health', async () => ({ status: 'ok' }));

    await instancia.register(spaPlugin);
    await instancia.ready();

    return instancia;
};

describe('a API a servir a interface', () => {
    /**
     * `/crews/abc` só existe dentro do router do browser. Um F5 ali
     * chega ao servidor como um pedido a um ficheiro que não existe, e
     * sem isto o utilizador leva um 404 a meio da aplicação.
     */
    it('responde com a página a um endereço que só o browser conhece', async () => {
        const servidor = await app(dist);

        const resposta = await servidor.inject({
            method: 'GET',
            url: '/crews/uma-crew-qualquer',
        });

        expect(resposta.statusCode).toBe(200);
        expect(resposta.body).toBe(HTML);
        expect(resposta.headers['content-type']).toContain('text/html');

        await servidor.close();
    });

    /**
     * A porta de entrada da plataforma. Um pedido a `/` chega ao plugin
     * estático como um pedido a uma pasta, e uma pasta sem listagem
     * responde 403 — quem chegasse ao site era recebido com "proibido".
     */
    it('responde com a página na raiz', async () => {
        const servidor = await app(dist);

        const resposta = await servidor.inject({ method: 'GET', url: '/' });

        expect(resposta.statusCode).toBe(200);
        expect(resposta.body).toBe(HTML);
        expect(resposta.headers['content-type']).toContain('text/html');

        await servidor.close();
    });

    it('serve os ficheiros que existem mesmo', async () => {
        const servidor = await app(dist);

        const recurso = await servidor.inject({
            method: 'GET',
            url: '/assets/app-9f3c1a.js',
        });

        expect(recurso.statusCode).toBe(200);
        expect(recurso.body).toBe(JAVASCRIPT);

        await servidor.close();
    });

    /**
     * O nome do `index.html` é o mesmo entre deploys. Guardado em cache,
     * continua a pedir os recursos do deploy anterior — que já não
     * existem — e a aplicação deixa de arrancar. Os recursos, esses,
     * trazem o resumo do conteúdo no nome e podem ficar para sempre.
     */
    it('deixa guardar os recursos com resumo no nome, e nunca a página', async () => {
        const servidor = await app(dist);

        const raiz = await servidor.inject({ method: 'GET', url: '/' });
        const pagina = await servidor.inject({ method: 'GET', url: '/perfil' });

        expect(raiz.headers['cache-control']).toBe(
            pagina.headers['cache-control'],
        );
        const recurso = await servidor.inject({
            method: 'GET',
            url: '/assets/app-9f3c1a.js',
        });

        expect(pagina.headers['cache-control']).toBe('no-cache');
        expect(recurso.headers['cache-control']).toContain('immutable');

        await servidor.close();
    });

    it('não deixa guardar um ficheiro de nome fixo', async () => {
        const servidor = await app(dist);

        const resposta = await servidor.inject({
            method: 'GET',
            url: '/favicon.png',
        });

        expect(resposta.statusCode).toBe(200);
        expect(resposta.headers['cache-control']).toBe('no-cache');

        await servidor.close();
    });

    /**
     * Um endereço de API mal escrito tem de falhar como erro. Devolver-lhe
     * a página faria o cliente receber HTML onde espera JSON, e o erro
     * apareceria como uma avaria qualquer a desencadear parse — longe do
     * pedido que o causou.
     */
    it('não responde com a página a um endereço da API', async () => {
        const servidor = await app(dist);

        const resposta = await servidor.inject({
            method: 'GET',
            url: '/api/v1/isto-nao-existe',
        });

        expect(resposta.statusCode).toBe(404);
        expect(resposta.headers['content-type']).toContain('application/json');
        expect(resposta.json()).toMatchObject({ statusCode: 404 });

        await servidor.close();
    });

    /**
     * Um `.js` que o deploy não copiou tem de faltar. Responder-lhe com a
     * página dava 200 e HTML, o browser tentava executá-lo como módulo, e
     * o erro saía a falar de um `<` inesperado — longe do que falta.
     */
    it('não responde com a página a um recurso que falta', async () => {
        const servidor = await app(dist);

        const resposta = await servidor.inject({
            method: 'GET',
            url: '/assets/app-inexistente.js',
        });

        expect(resposta.statusCode).toBe(404);
        expect(resposta.body).not.toContain('<!doctype html>');

        await servidor.close();
    });

    it('não confunde um endereço da aplicação que comece por api', async () => {
        const servidor = await app(dist);

        const resposta = await servidor.inject({
            method: 'GET',
            url: '/apitulo',
        });

        expect(resposta.statusCode).toBe(200);
        expect(resposta.body).toBe(HTML);

        await servidor.close();
    });

    /**
     * Só um GET pede uma página. Um POST a um endereço que não existe é
     * um pedido errado, e responder-lhe com 200 e HTML esconderia isso.
     */
    it('não responde com a página a um método que não pede páginas', async () => {
        const servidor = await app(dist);

        const resposta = await servidor.inject({
            method: 'POST',
            url: '/isto-nao-existe',
        });

        expect(resposta.statusCode).toBe(404);
        expect(resposta.headers['content-type']).toContain('application/json');

        await servidor.close();
    });

    it('continua a servir a API', async () => {
        const servidor = await app(dist);

        const resposta = await servidor.inject({
            method: 'GET',
            url: '/api/v1/health',
        });

        expect(resposta.statusCode).toBe(200);
        expect(resposta.json()).toEqual({ status: 'ok' });

        await servidor.close();
    });
});

describe('quando não é a API a servir a interface', () => {
    /**
     * Quem tem um proxy à frente prefere que seja ele a servir a
     * aplicação. Sem a variável, a API volta a ser só API.
     */
    it('deixa a API a responder só JSON', async () => {
        const servidor = await app();

        const resposta = await servidor.inject({
            method: 'GET',
            url: '/crews/uma-crew-qualquer',
        });

        expect(resposta.statusCode).toBe(404);
        expect(resposta.headers['content-type']).toContain('application/json');

        await servidor.close();
    });
});

/**
 * O pior sítio para descobrir um caminho mal escrito é o browser de
 * quem chega: a API arrancava bem e o site respondia 404 a toda a gente.
 */
describe('um caminho que não serve', () => {
    it('impede a aplicação de arrancar', async () => {
        await expect(app(vazia)).rejects.toThrow(/index\.html/);
    });
});

/**
 * A política de conteúdo da API é a mais restritiva que existe — nada
 * carrega. Aplicada tal e qual à página, a aplicação não abria. O que
 * não pode acontecer é ser desligada para resolver isso.
 */
describe('a política de conteúdo', () => {
    it('não deixa carregar nada enquanto a API for só API', async () => {
        const servidor = await app();

        const resposta = await servidor.inject({
            method: 'GET',
            url: '/api/v1/health',
        });

        expect(resposta.headers['content-security-policy']).toContain(
            "default-src 'none'",
        );

        await servidor.close();
    });

    it('abre o suficiente para a aplicação, e não mais', async () => {
        const servidor = await app(dist);

        const politica = politicaDe(
            await servidor.inject({ method: 'GET', url: '/' }),
        );

        expect(politica).toContain("script-src 'self'");
        expect(politica).toContain('https://fonts.googleapis.com');
        expect(politica).toContain('https://fonts.gstatic.com');

        /**
         * `'unsafe-inline'` nos scripts transforma um XSS numa execução;
         * no `style-src`, devolve o atributo `style` a quem o injetar.
         */
        expect(politica).not.toContain("'unsafe-inline'");
        expect(politica).not.toContain("'unsafe-eval'");

        await servidor.close();
    });
});

const politicaDe = (r: { headers: Record<string, unknown> }): string =>
    String(r.headers['content-security-policy']);
