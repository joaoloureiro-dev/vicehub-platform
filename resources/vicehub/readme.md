# ViceHub — recurso de FiveM

Reporta o teu servidor ao ViceHub: se está de pé, e com quantas pessoas
dentro. É o que faz o servidor aparecer como online no diretório sem
que ninguém tenha de ligar um interruptor à mão.

## Instalar

1. Copia a pasta `vicehub` para os recursos do teu servidor
   (`resources/`).

2. Vai ao ecrã do teu servidor no ViceHub, em **Chaves do servidor**, e
   cria uma. **A chave aparece uma vez.** Copia-a nesse momento — do
   nosso lado fica só um resumo dela, e quem a perder gera outra.

3. No `server.cfg`:

   ```cfg
   ensure vicehub
   set vicehub_key "vh_<prefixo>_<segredo>"
   ```

4. Arranca o servidor. Na consola deve aparecer:

   ```
   [ViceHub] Ligado como "O Nome Do Teu Servidor".
   ```

   Se aparecer outro nome, a chave é do servidor errado.

## O que sai daqui

Um pedido por minuto, com uma linha de JSON:

```json
{ "playersOnline": 37 }
```

E mais nada. Não vai lista de jogadores, não vão identificadores, não
vai nada sobre quem está a jogar.

## Onde a chave não deve estar

A chave é um segredo do servidor: quem a tiver pode dizer mentiras
sobre ele — que está online quando não está, ou com gente que não tem.
Não a metas num repositório público nem num script de cliente. Se
achares que se perdeu, revoga-a no mesmo ecrã onde a criaste e cria
outra; a revogação é imediata.

O que a chave **não** consegue fazer: mexer em contas, tesourarias ou
planos. Fala por um servidor e mais nada.

## Se alguma coisa correr mal

O recurso escreve na consola, e só repete um aviso quando ele muda —
um servidor mal configurado não te enche o log com a mesma linha de
minuto a minuto.

| O que lês | O que se passa |
|---|---|
| `Sem vicehub_key no server.cfg` | falta a chave |
| `A chave foi recusada` | a chave está errada ou foi revogada |
| `Não foi possível falar com o ViceHub` | rede ou plataforma em baixo — ele volta a tentar sozinho, cada vez mais espaçado |
| `A reportar outra vez.` | recuperou |

## Endereço

Por omissão aponta para a instalação pública. Para uma instalação tua:

```cfg
set vicehub_url "https://a-tua-instalacao/api/v1"
```

## Testes

O recurso corre dentro do jogo, mas o que decide se ele está certo não
precisa de jogo nenhum — o que vai no corpo, o que faz quando a chave é
recusada, quanto espera antes de tentar outra vez. Isso corre-se com um
FiveM de mentira:

```bash
npm run test:lua
```
