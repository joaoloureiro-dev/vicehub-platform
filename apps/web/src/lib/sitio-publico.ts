/**
 * O que a plataforma mostra a quem ainda não entrou — e a quem nem
 * sequer é uma pessoa.
 *
 * Três coisas saem daqui, e saem do mesmo sítio de propósito: o cartão
 * que aparece quando alguém partilha um link, o mapa do sítio para os
 * motores de busca, e o `robots.txt` que lhes diz onde não vale a pena
 * entrar. Escritas em três ficheiros à mão, divergiam à terceira página
 * nova — e a divergência nota-se meses depois, num resultado de
 * pesquisa que leva a uma página de conta alheia ou num mapa que
 * promete uma página que já não existe.
 *
 * O `vite.config.ts` escreve os dois ficheiros a partir daqui, e o
 * `index.html` recebe o endereço pelo mesmo caminho.
 */

/**
 * Onde vive a plataforma, quando ninguém diz o contrário.
 *
 * As etiquetas de partilha exigem endereços absolutos: um `og:image`
 * relativo é ignorado por parte de quem lê cartões, e o resultado é um
 * link partilhado sem imagem nenhuma — que é exactamente a primeira
 * impressão que isto existe para não dar.
 *
 * `VITE_PUBLIC_URL` no serviço que compila manda nisto. É o mesmo
 * domínio do `APP_PUBLIC_URL` da API e do `connect-src` do
 * `vercel.json`: três sítios a nomear o mesmo sítio, e nenhum deles
 * adivinha os outros.
 */
export const ENDERECO_PUBLICO = 'https://vicehub.com';

/**
 * As páginas públicas que vivem num endereço fixo.
 *
 * Só estas entram no mapa. As que dependem de um identificador — o
 * perfil de uma crew, um tópico, um anúncio — são milhares e mudam
 * todos os dias: um mapa com elas teria de ser gerado pela API contra a
 * base de dados, e não pela compilação da interface.
 */
export const ROTAS_PUBLICAS = [
    '/',
    '/crews',
    '/recrutamento',
    '/servidores',
    '/forum',
    '/premium',
    '/termos',
    '/privacidade',
] as const;

/**
 * As públicas que ficam de fora do mapa, e porquê.
 *
 * Uma lista de exclusões sem razões é uma lista que ninguém consegue
 * rever: daqui a seis meses não se sabe se uma página está de fora por
 * decisão ou por esquecimento.
 */
export const FORA_DO_MAPA: Record<string, string> = {
    '/entrar':
        'é um formulário, não é conteúdo: quem chega de uma pesquisa a'
        + ' um ecrã de entrada não encontrou o que procurava.',
    '/registo':
        'o mesmo — e quem quer criar conta chega lá pela página de'
        + ' entrada, que está no mapa.',
    '/recuperar-password':
        'só quer dizer alguma coisa com o segredo que vem no endereço.',
    '/confirmar-email':
        'o mesmo: sem o código no endereço é uma página que não faz nada.',
    '/moderacao':
        'a rota é pública mas o que lá está dentro é de quem modera.',
};

/**
 * Os endereços fixos onde um motor de busca não tem nada que andar.
 *
 * Contas, caixas de correio e filas de moderação — e as duas páginas
 * dos links do email, que trazem um segredo na query. São prefixos: o
 * que estiver por baixo de cada um fica de fora com ele.
 *
 * Não é segurança. Quem guarda essas páginas é a API, que não devolve
 * os dados de ninguém sem sessão; isto é só não gastar o rastreio de
 * quem indexa em páginas que lhe respondem sempre o mesmo.
 */
export const FORA_DO_RASTREIO = [
    '/eu',
    '/avisos',
    '/mercado/conversas',
    '/crews/nova',
    '/servidores/novo',
    '/moderacao',
    '/recuperar-password',
    '/confirmar-email',
] as const;

/** O endereço de uma rota, absoluto, sem barra a dobrar. */
const absoluto = (endereco: string, rota: string): string =>
    `${endereco.replace(/\/+$/u, '')}${rota === '/' ? '/' : rota}`;

export const mapaDoSitio = (endereco: string = ENDERECO_PUBLICO): string =>
    [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
        ...ROTAS_PUBLICAS.map(
            (rota) => `    <url><loc>${absoluto(endereco, rota)}</loc></url>`,
        ),
        '</urlset>',
        '',
    ].join('\n');

export const robots = (endereco: string = ENDERECO_PUBLICO): string =>
    [
        'User-agent: *',
        'Allow: /',
        ...FORA_DO_RASTREIO.map((rota) => `Disallow: ${rota}`),
        '',
        `Sitemap: ${absoluto(endereco, '/sitemap.xml')}`,
        '',
    ].join('\n');
