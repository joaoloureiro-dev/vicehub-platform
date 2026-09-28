/**
 * Faz a fotografia do cartão de link.
 *
 * `og-card.html` é o original; `apps/web/public/og-vicehub.png` é a
 * saída. Para mudar o cartão muda-se o HTML e corre-se isto outra vez —
 * nunca se editam pixéis.
 *
 *   node docs/press/render-og.mjs
 *
 * **As fontes vêm embebidas, e não por link.** O browser que tira a
 * fotografia corre numa caixa sem acesso ao Google Fonts, e uma página
 * que não recebe as fontes desenha-se com outras sem se queixar — o
 * cartão saía com a letra errada e ninguém dava por isso até estar
 * publicado. Por isso o CSS das fontes é trazido por `curl` (com um
 * agente moderno, para vir woff2), os ficheiros são postos em base64, e
 * o link é substituído antes de renderizar. O logótipo segue o mesmo
 * caminho, por causa do `file://`.
 *
 * Precisa do Playwright, que não é dependência do repositório pela
 * mesma razão que a varredura: são cento e tal megabytes para uma
 * ferramenta que o CI não corre. `PLAYWRIGHT_MODULE` diz onde está.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = join(AQUI, '../..');

const ORIGEM = join(AQUI, 'og-card.html');
const DESTINO = join(RAIZ, 'apps/web/public/og-vicehub.png');
const LOGOTIPO = join(RAIZ, 'apps/web/public/vicehub-logo.png');

const LARGURA = 1200;
const ALTURA = 630;

/* Um agente moderno, ou o Google Fonts serve TTF em vez de woff2. */
const AGENTE =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    + ' (KHTML, like Gecko) Chrome/120.0 Safari/537.36';

const abrirPlaywright = async () => {
    const caminho = process.env['PLAYWRIGHT_MODULE'] ?? 'playwright';

    try {
        const modulo = await import(caminho);

        /* Conforme a instalação, o `chromium` vem na raiz ou no default. */
        return modulo.chromium ?? modulo.default?.chromium;
    } catch {
        console.error(
            'Não encontrei o Playwright. Instala-o, ou aponta'
            + ' PLAYWRIGHT_MODULE ao index.js de uma instalação que exista.',
        );

        process.exit(2);
    }
};

const html = readFileSync(ORIGEM, 'utf8');

const linkDasFontes = /<link rel="stylesheet" href="(https:\/\/fonts\.googleapis[^"]+)">/u;

const endereco = linkDasFontes.exec(html)?.[1];

if (endereco === undefined) {
    console.error('não encontrei o link das fontes no og-card.html.');
    process.exit(2);
}

const css = await (
    await fetch(endereco.replaceAll('&amp;', '&'), {
        headers: { 'user-agent': AGENTE },
    })
).text();

/*
 * Cada `url(...)` do CSS trocada pelo ficheiro em base64. É o que faz o
 * cartão sair igual numa máquina sem rede — e o que torna visível, em
 * vez de silencioso, o dia em que o Google Fonts mudar de endereço.
 */
const enderecos = [...css.matchAll(/url\((https:\/\/[^)]+)\)/gu)].map((m) => m[1]);

if (enderecos.length === 0) {
    console.error('o CSS das fontes não trouxe nenhum ficheiro.');
    process.exit(2);
}

let embebido = css;

for (const url of enderecos) {
    const resposta = await fetch(url, { headers: { 'user-agent': AGENTE } });

    if (!resposta.ok) {
        console.error(`não consegui trazer ${url}: ${resposta.status}`);
        process.exit(2);
    }

    const bytes = Buffer.from(await resposta.arrayBuffer());
    const tipo = url.endsWith('.woff2') ? 'font/woff2' : 'font/ttf';

    embebido = embebido.replaceAll(
        `url(${url})`,
        `url(data:${tipo};base64,${bytes.toString('base64')})`,
    );
}

const logotipo = readFileSync(LOGOTIPO).toString('base64');

const paginaSemRede = html
    .replace(linkDasFontes, '')
    .replace('<!-- FONTES -->', `<style>${embebido}</style>`)
    .replace(
        'src="../../apps/web/public/vicehub-logo.png"',
        `src="data:image/png;base64,${logotipo}"`,
    );

const chromium = await abrirPlaywright();

const browser = await chromium.launch({
    executablePath: process.env['CHROMIUM'] ?? '/opt/pw-browsers/chromium',
});

try {
    const pagina = await browser.newPage({
        viewport: { width: LARGURA, height: ALTURA },
        deviceScaleFactor: 2,
    });

    await pagina.setContent(paginaSemRede, {
        baseURL: pathToFileURL(`${AQUI}/`).href,
        waitUntil: 'load',
    });

    await pagina.evaluate(() => document.fonts.ready);

    /*
     * E confirma-se que a letra é mesmo a do produto. Um cartão
     * desenhado com a fonte de omissão é o erro que esta página existe
     * para não ter, e sai igual a um cartão certo aos olhos de quem só
     * vê o ficheiro.
     */
    const desenhouComArchivo = await pagina.evaluate(() =>
        document.fonts.check('800 82px Archivo'));

    if (!desenhouComArchivo) {
        console.error(
            'o browser não tem o Archivo carregado: o cartão sairia com'
            + ' outra letra. Não gravei nada.',
        );

        process.exit(1);
    }

    await pagina.screenshot({ path: DESTINO, type: 'png' });

    const tamanho = readFileSync(DESTINO).length;

    console.log(
        `${DESTINO.replace(`${RAIZ}/`, '')}`
        + ` · ${LARGURA}×${ALTURA} em dobro · ${Math.round(tamanho / 1024)} kB`,
    );

    /*
     * O limite do X são cinco megabytes, e um cartão que os passe
     * simplesmente não aparece — sem aviso nenhum a quem publicou.
     */
    if (tamanho > 4_000_000) {
        console.error('o cartão está demasiado pesado para o X (5 MB).');
        process.exitCode = 1;
    }
} finally {
    await browser.close();
}
