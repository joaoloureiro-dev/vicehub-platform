import { Component, type ErrorInfo, type ReactNode } from 'react';

import { useT } from '../i18n/i18n.js';

/**
 * As quatro frases entram uma a uma, e não como um objeto.
 *
 * Parece mais verboso, e é de propósito: há um teste que percorre o
 * código à procura de quem lê cada chave do dicionário, e uma chave que
 * ninguém lê é apagada por estar a mais. Passar `t.avaria` inteiro
 * escondia as quatro atrás de uma só, e as quatro apareciam como órfãs.
 */
interface Props {
    titulo: string;
    explicacao: string;
    recarregar: string;
    inicio: string;
    children: ReactNode;
}

interface Estado {
    avariou: boolean;
}

/**
 * O que fica no ecrã quando um componente rebenta a desenhar.
 *
 * Sem isto, o React desmonta a árvore inteira e o que resta é uma
 * **página branca**: sem mensagem, sem botão, sem nada que diga à
 * pessoa que aconteceu alguma coisa ou o que fazer a seguir. É a pior
 * avaria que uma aplicação pode ter, porque é indistinguível de a rede
 * ter caído, do telemóvel estar lento, ou de o produto simplesmente não
 * existir.
 *
 * Tem de ser uma classe: `componentDidCatch` e
 * `getDerivedStateFromError` não têm equivalente em hooks, e é a única
 * coisa neste código que ainda é uma. Por isso as mensagens entram por
 * propriedade em vez de virem de `useT` — uma classe não pode chamar um
 * hook — e quem as vai buscar é o invólucro lá em baixo.
 *
 * **Não apanha tudo.** Um erro dentro de um `onClick`, num `setTimeout`
 * ou numa promessa não passa por aqui: o React só entrega à fronteira o
 * que rebenta a desenhar, e o resto continua a ser tratado onde
 * acontece. O que isto tapa é o caso em que não havia ninguém a tratar.
 */
class Fronteira extends Component<Props, Estado> {
    override state: Estado = { avariou: false };

    static getDerivedStateFromError(): Estado {
        return { avariou: true };
    }

    /**
     * E fica no log, com o sítio onde foi.
     *
     * Uma fronteira que engole o erro é pior do que nenhuma: o ecrã
     * deixa de estar branco, e em troca ninguém volta a saber o que
     * aconteceu. O `componentStack` diz que componente é, que é a única
     * coisa que o `Error` sozinho não traz.
     */
    override componentDidCatch(erro: Error, info: ErrorInfo): void {
        console.error('[ViceHub] Um ecrã rebentou a desenhar.', erro, info.componentStack);
    }

    override render(): ReactNode {
        if (!this.state.avariou) {
            return this.props.children;
        }

        const { titulo, explicacao, recarregar, inicio } = this.props;

        return (
            <main className="panel avaria" role="alert">
                <h1>{titulo}</h1>
                <p>{explicacao}</p>

                {/*
                  Recarregar, e não «tentar outra vez».
                  
                  Depois de a árvore rebentar a meio, o que está em
                  memória deixou de ser de confiança: metade dos estados
                  ficou onde estava e a outra metade não chegou a
                  atualizar-se. Voltar a montar por cima disso esconde a
                  avaria em vez de a resolver, e a segunda falha aparece
                  noutro sítio qualquer.
                */}
                <button
                    className="primary"
                    type="button"
                    onClick={() => {
                        window.location.reload();
                    }}
                >
                    {recarregar}
                </button>

                {/*
                  Uma saída que não depende de o ecrã atual voltar a
                  funcionar: se for esta página que está partida,
                  recarregá-la parte-a outra vez.
                */}
                <p className="hint">
                    <a href="/">{inicio}</a>
                </p>
            </main>
        );
    }
}

/**
 * A mesma fronteira, já a falar o idioma escolhido.
 *
 * Fica **dentro** do `I18nProvider` de propósito. Um ecrã de avaria em
 * português a quem está a usar a plataforma em francês seria a mesma
 * falta de educação que os emails tinham — e aqui ainda pior, porque é
 * o único texto que essa pessoa tem para perceber o que se passou.
 */
export const LimiteDeErro = ({ children }: { children: ReactNode }) => {
    const t = useT();

    return (
        <Fronteira
            titulo={t.avaria.titulo}
            explicacao={t.avaria.explicacao}
            recarregar={t.avaria.recarregar}
            inicio={t.avaria.inicio}
        >
            {children}
        </Fronteira>
    );
};
