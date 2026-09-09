import { spawn } from 'node:child_process';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Arranca a API e o frontend ao mesmo tempo.
 *
 * Existe porque `npm run dev --workspaces` corre os workspaces **em
 * sequência**: a API arranca, fica a correr, e o frontend nunca chega a
 * começar. Quem seguisse o comando óbvio ficava a olhar para um servidor
 * só, sem nada no ecrã que explicasse porquê.
 *
 * Sem dependências novas de propósito. São umas dezenas de linhas de
 * `child_process`, e trazer um executor de tarefas para isto seria
 * arrastar uma árvore inteira para resolver um problema desta dimensão.
 */

const raiz = dirname(dirname(fileURLToPath(import.meta.url)));

const COR = {
    setup: '\u001b[33m',
    api: '\u001b[35m',
    web: '\u001b[36m',
    erro: '\u001b[31m',
    fim: '\u001b[0m',
};

const processos = [];

/** Ctrl+C tem de levar os dois, e não deixar um servidor órfão na porta. */
const desligar = () => {
    for (const filho of processos) {
        filho.kill();
    }
};

process.on('SIGINT', desligar);
process.on('SIGTERM', desligar);
process.on('exit', desligar);

/**
 * Corre um comando, prefixando cada linha com a sua origem.
 *
 * Sem o prefixo, dois servidores a escrever para o mesmo terminal dão um
 * registo onde não se percebe quem disse o quê.
 */
const correr = (comando, etiqueta, cor) =>
    new Promise((resolve, reject) => {
        /**
         * `shell: true` porque o comando é `npm`, e em Windows isso é um
         * `.cmd` que o spawn direto não encontra.
         */
        const filho = spawn(comando, {
            cwd: raiz,
            shell: true,
            stdio: ['inherit', 'pipe', 'pipe'],
        });

        const prefixar = (fluxo, destino) => {
            fluxo.setEncoding('utf8');

            fluxo.on('data', (pedaco) => {
                for (const linha of pedaco.split('\n')) {
                    if (linha.trim()) {
                        destino.write(`${cor}${etiqueta}${COR.fim} ${linha}\n`);
                    }
                }
            });
        };

        prefixar(filho.stdout, process.stdout);
        prefixar(filho.stderr, process.stderr);

        processos.push(filho);

        filho.on('error', reject);
        filho.on('exit', (codigo) => {
            resolve(codigo ?? 0);
        });
    });

/**
 * A data do ficheiro mais recente de uma pasta, ou 0 se não existir.
 *
 * Percorre subpastas porque o `src` do pacote tem-nas, e o que interessa
 * é o mais recente de todos — um ficheiro mexido três pastas abaixo
 * torna o `dist` tão velho como um mexido à porta.
 */
const maisRecente = (caminho) => {
    if (!existsSync(caminho)) {
        return 0;
    }

    const info = statSync(caminho);

    if (!info.isDirectory()) {
        return info.mtimeMs;
    }

    return readdirSync(caminho).reduce(
        (maior, entrada) => Math.max(maior, maisRecente(join(caminho, entrada))),
        0,
    );
};

/**
 * O pacote `database` tem de estar construído **e atualizado** antes de
 * tudo o resto.
 *
 * Em execução, `@vicehub/database` resolve para `dist/`, e o `dist/` não
 * é versionado — num clone acabado de fazer não existe. O `tsx` compila
 * o código da API ao vivo e por isso engana: o erro que aparece é um
 * export em falta num ficheiro que ninguém tocou, e não "falta
 * construir".
 *
 * A verificação já foi só "existe?", e isso deixava passar o caso mais
 * frequente de todos: quem faz `git pull` fica com código novo e um
 * `dist` velho, que existe e por isso não era reconstruído. O erro é
 * exatamente o mesmo — `does not provide an export named X` — mas agora
 * a apontar para um export que o código novo trouxe e o `dist` antigo
 * não conhece. Ninguém liga uma coisa à outra.
 *
 * Por isso a pergunta passou a ser "está atualizado?", comparando datas
 * com o `src` e com o schema do Prisma. O schema conta porque o cliente
 * gerado sai dele: mudar uma coluna sem voltar a gerar dá um erro de
 * tipos num ficheiro que ninguém tocou.
 */
const construido = maisRecente(join(raiz, 'packages/database/dist/index.js'));

const fonte = Math.max(
    maisRecente(join(raiz, 'packages/database/src')),
    maisRecente(join(raiz, 'packages/database/prisma/schema.prisma')),
);

if (construido === 0 || fonte > construido) {
    console.log(
        construido === 0
            ? `${COR.setup}[vicehub]${COR.fim} O pacote database ainda não está construído. A construir, uma vez só…`
            : `${COR.setup}[vicehub]${COR.fim} O pacote database está desatualizado em relação ao código. A reconstruir…`,
    );

    const preparacao = await correr(
        'npm run db:generate && npm run build --workspace=@vicehub/database',
        '[setup]',
        COR.setup,
    );

    if (preparacao !== 0) {
        console.error(
            `${COR.erro}[vicehub]${COR.fim} Não foi possível preparar o pacote database. Confirma o DATABASE_URL no .env.`,
        );

        process.exit(preparacao);
    }
}

console.log(
    `${COR.web}[vicehub]${COR.fim} API em http://localhost:3000 · aplicação em http://localhost:5173`,
);

/**
 * Se um deles cair, o outro não fica sozinho a fingir que está tudo bem.
 */
await Promise.race([
    correr('npm run dev --workspace=@vicehub/api', '[api]', COR.api),
    correr('npm run dev --workspace=@vicehub/web', '[web]', COR.web),
]);

desligar();
