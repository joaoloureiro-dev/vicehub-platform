/**
 * Uma caixa de correio que não entrega nada: mostra.
 *
 * A plataforma manda dois emails, e os dois são a única maneira de
 * voltar a entrar numa conta: o de confirmar o email e o de recuperar a
 * palavra-passe. Se o SMTP estiver mal configurado, nada disto dá erro
 * à frente de ninguém — o registo continua a funcionar, o pedido
 * responde 202, e só se descobre quando alguém perde a palavra-passe e
 * não a consegue recuperar.
 *
 * Isto é um servidor SMTP de mentira. Fala o que é preciso falar para o
 * nodemailer lhe entregar a mensagem, e em vez de a enviar escreve-a no
 * ecrã: quem a manda, para quem, o assunto, e — o que mais interessa —
 * **o endereço dos links**.
 *
 *     node scripts/caixa-de-correio.mjs
 *
 * E noutra janela, a API apontada a ele:
 *
 *     SMTP_URL=smtp://utilizador:senha@127.0.0.1:1025 \
 *     MAIL_FROM='ViceHub <no-reply@vicehub.com>' \
 *     APP_PUBLIC_URL=https://vicehub.com \
 *     npm start
 *
 * Depois é pedir uma recuperação de palavra-passe e olhar para o que
 * aparece aqui. **O link tem de começar pelo `APP_PUBLIC_URL`.** Se
 * apontar para `localhost`, quem receber o email não vai a lado nenhum
 * — e é por isso que a API se recusa a arrancar em produção com esse
 * valor por omissão.
 *
 * Opções: `--porta=1025`, `--tudo` (escreve a mensagem inteira, e não
 * só o resumo).
 *
 * Não é um servidor de correio: não guarda, não reencaminha, não
 * verifica nada. Serve para ver, uma vez, antes de apontar a API a um
 * fornecedor a sério.
 */
import { createServer } from 'node:net';
import { pathToFileURL } from 'node:url';

const argumento = (nome, omissao) => {
    const encontrado = process.argv.find((a) => a.startsWith(`--${nome}=`));

    return encontrado === undefined ? omissao : encontrado.split('=')[1];
};

const PORTA = Number(argumento('porta', '1025'));
const TUDO = process.argv.includes('--tudo');

/**
 * O corpo vem em quoted-printable, que é ilegível a olho: os acentos
 * saem como `=C3=A9` e as linhas partidas acabam em `=`. Isto desfaz
 * as duas coisas, o suficiente para ler um email e ver um link.
 */
export const legivel = (texto) => {
    /* Primeiro as linhas partidas: um `=` no fim de linha é uma emenda. */
    const inteiro = texto.replace(/=\r?\n/gu, '');

    /*
     * E depois os bytes. Cada `=XX` é **um byte**, não um carácter: um
     * "á" viaja como `=C3=A1`, que são os dois bytes dele em utf-8.
     * Traduzidos um a um davam "Ã¡" — que é como um acento se estraga
     * em todo o lado, e como se estragava aqui até este teste existir.
     */
    const bytes = [];

    for (let i = 0; i < inteiro.length; i += 1) {
        const hex = inteiro.slice(i + 1, i + 3);

        if (inteiro[i] === '=' && /^[0-9A-Fa-f]{2}$/u.test(hex)) {
            bytes.push(Number.parseInt(hex, 16));
            i += 2;
        } else {
            bytes.push(...Buffer.from(inteiro[i] ?? '', 'utf8'));
        }
    }

    return Buffer.from(bytes).toString('utf8');
};

/**
 * O que interessa de uma mensagem: quem, para quem, o assunto, e os
 * links — com os que apontam para a máquina de quem fez o deploy
 * marcados, porque são os que não levam ninguém a lado nenhum.
 */
export const resumir = (bruto) => {
    const texto = legivel(bruto);
    const cabecalho = (nome) =>
        new RegExp(`^${nome}:\\s*(.+)$`, 'imu').exec(texto)?.[1]?.trim();

    const links = [
        ...new Set([...texto.matchAll(/https?:\/\/[^\s"<>]+/gu)].map((m) => m[0])),
    ];

    return {
        de: cabecalho('From'),
        para: cabecalho('To'),
        assunto: cabecalho('Subject'),
        links,
        /** Os que ficaram a apontar para dentro da máquina. */
        parados: links.filter((link) =>
            /^https?:\/\/(localhost|127\.0\.0\.1)/u.test(link)),
        texto,
    };
};

const mostrar = (bruto) => {
    const { de, para, assunto, links, parados, texto } = resumir(bruto);

    console.log('\n─── mensagem ───────────────────────────────');
    console.log(`  de       ${de ?? '(sem remetente)'}`);
    console.log(`  para     ${para ?? '(sem destinatário)'}`);
    console.log(`  assunto  ${assunto ?? '(sem assunto)'}`);

    if (links.length === 0) {
        console.log('  links    nenhum');
    }

    for (const link of links) {
        console.log(
            `  link     ${link}`
            + (parados.includes(link)
                ? '   ← aponta para a máquina de quem fez o deploy'
                : ''),
        );
    }

    if (TUDO) {
        console.log('\n' + texto.trimEnd());
    }
};

let quantas = 0;

const servidor = createServer((ligacao) => {
    let emDados = false;
    let mensagem = '';
    let sobra = '';

    const diz = (linha) => ligacao.write(`${linha}\r\n`);

    diz('220 caixa-de-correio.vicehub.test ESMTP (não entrega nada)');

    ligacao.on('data', (pedaco) => {
        sobra += pedaco.toString('utf8');

        let corte = sobra.indexOf('\r\n');

        while (corte !== -1) {
            const linha = sobra.slice(0, corte);

            sobra = sobra.slice(corte + 2);

            if (emDados) {
                if (linha === '.') {
                    emDados = false;
                    quantas += 1;
                    mostrar(mensagem);
                    mensagem = '';
                    diz('250 2.0.0 vista');
                } else {
                    /* Um ponto no início de linha vem duplicado pelo SMTP. */
                    mensagem += `${linha.startsWith('..') ? linha.slice(1) : linha}\n`;
                }
            } else {
                const comando = linha.split(' ')[0]?.toUpperCase() ?? '';

                if (comando === 'EHLO' || comando === 'HELO') {
                    diz('250-caixa-de-correio.vicehub.test');
                    diz('250 AUTH PLAIN LOGIN');
                } else if (comando === 'AUTH') {
                    /* Aceita qualquer credencial: aqui não há nada a proteger. */
                    diz('235 2.7.0 entra');
                } else if (comando === 'DATA') {
                    emDados = true;
                    diz('354 manda, e acaba com um ponto sozinho');
                } else if (comando === 'QUIT') {
                    diz('221 2.0.0 adeus');
                    ligacao.end();
                } else {
                    diz('250 2.0.0 ok');
                }
            }

            corte = sobra.indexOf('\r\n');
        }
    });

    ligacao.on('error', () => {
        /* Quem desliga a meio não é um problema desta caixa. */
    });
});

/**
 * Só escuta quando é ela a ser corrida.
 *
 * Importada — por um teste, por exemplo — não abre porta nenhuma: um
 * teste que abrisse um servidor SMTP ao ser importado era um teste que
 * falhava no dia em que dois corressem ao mesmo tempo.
 */
const corridaDirectamente =
    process.argv[1] !== undefined
    && import.meta.url === pathToFileURL(process.argv[1]).href;

if (!corridaDirectamente) {
    servidor.close();
} else {
servidor.listen(PORTA, '127.0.0.1', () => {
    console.log(
        `caixa de correio à escuta em smtp://127.0.0.1:${PORTA}`
        + '\naponta a API a ela com:'
        + `\n  SMTP_URL=smtp://utilizador:senha@127.0.0.1:${PORTA}`
        + '\n\nCtrl+C para sair.',
    );
});

process.on('SIGINT', () => {
    console.log(`\n${quantas} mensagem(ns) vista(s).`);
    servidor.close(() => process.exit(0));
});
}
