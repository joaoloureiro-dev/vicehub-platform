# Continuidade do que se publica

O que sai para fora — posts, imagens, o mapa do sistema — tem de
continuar o que já saiu, e não recomeçar de cada vez. Quem lê o segundo
post já leu o primeiro; um segundo post que se apresente outra vez é um
projeto que não avançou.

Este ficheiro é o registo do que já foi dito, para o próximo se apoiar
nele.

## A identidade, e é a do produto

Nada disto é escolhido de novo a cada peça: são os valores do
`apps/web/src/styles/theme.css` e as fontes do `apps/web/index.html`.
Uma imagem promocional com outras cores é uma imagem de outra coisa.

| | |
|---|---|
| Fundo | `#08060F` |
| Magenta | `#E93CEF` |
| Ciano | `#22D3EE` |
| Verde (bom) | `#34D399` |
| Títulos | Chakra Petch |
| Texto | Inter |
| Números e código | JetBrains Mono |
| Formato | 16:9, 1600×900 — a medida de imagem única do X |

O selo é sempre o degradê magenta→ciano. O sobrolho diz **GTA VI ·
roleplay**, nunca FiveM: o FiveM é o runtime da implementação de
referência do recurso, não o público.

## O que já foi dito em público

Setembro de 2026, primeiro post. Cada linha é uma coisa que a
plataforma **já faz** — é a regra abaixo.

- ViceHub é uma plataforma para comunidades de roleplay de GTA VI:
  crews, servidores, eventos, e uma tesouraria que paga a quem apareceu.
- O plano de um servidor cobre as crews que lá jogam.
- Uma crew não se pendura num servidor: o servidor tem de aceitar.
- Um direito herdado não é vitalício.
- O dinheiro mexe-se na aprovação, não na proposta.
- Online é uma data, não um interruptor: cinco minutos de silêncio e o
  servidor sai do diretório.
- Os servidores reportam-se sozinhos, e o corpo do pedido é uma
  contagem — sem lista de jogadores, sem identificadores.
- Nada está em produção. O MVP é no fim de setembro.
- Os primeiros testadores recebem acesso vitalício, dado um a um.

Setembro de 2026, segundo post. Continua o primeiro — não se
reapresenta, conta o que mudou desde ele.

- Uma crew escreve o que pede a quem se candidata. Texto livre, e não
  condições verificáveis: a plataforma não confirma nenhuma delas, e
  recusar alguém por uma regra que o servidor julgou cumprida seria pior
  do que não prometer nada.
- Esses requisitos lêem-se sem conta nenhuma. Quem decide se se
  candidata muitas vezes ainda nem conta tem.
- Há um quadro de crews a recrutar, e a crew é que o diz. Não é deduzido
  de ter requisitos escritos nem de ter lugares livres.
- Cada anúncio mostra a idade. Voltar a guardar as definições não o
  rejuvenesce, e desligá-lo apaga a data: voltar a recrutar é um anúncio
  novo.
- Os lugares de destaque obedecem ao mesmo filtro — uma crew paga que
  não recruta nunca é destacada no quadro de recrutamento.
- Em produção a API recusa arrancar sem forma de enviar email. Sem ela,
  os links de confirmação e de recuperação ficavam escritos no log, e um
  link de recuperação no log é uma chave para entrar numa conta.

Setembro de 2026, terceiro post. Continua o segundo.

- Um servidor paga às crews que lá jogam. O dinheiro sai de uma
  tesouraria e entra na outra numa só transação: nunca está nas duas,
  nunca está em nenhuma.
- São duas linhas ligadas por um identificador, e não uma linha-resumo.
  Débito de um lado, crédito do outro.
- Só recebem crews com filiação **ativa**. Qualquer outra leva 404 — quem
  manda num servidor não tem por que saber que aquela crew existe.
- A transferência chega liquidada, não pendente. O que fica por aprovar é
  a divisão.
- Personalizar o próprio perfil passou a ser **grátis**. Era pago, e um
  perfil ficava cinzento quando alguém deixava de pagar. A cara e o
  banner de quem joga não se vendem; o que se vende é gerir uma
  comunidade, e a personalização de crews e servidores continua paga.

**Correção ao segundo post:** eu tinha dito que as aprovações da
tesouraria não ficavam auditadas. Ficam — quem decidiu, quanto, em que
sentido e quem tinha pedido. A conclusão errada veio de uma procura que
só via nomes literais e não via os construídos por template. Não chegou
a sair para fora; fica escrito para não voltar a entrar.

Os números que a imagem do sistema mostra são contados contra o `main`
no dia em que é feita, nunca escritos de memória.

## As regras

1. **Só se anuncia o que já existe.** Um post que promete o que não está
   construído é um post que depois se tem de desdizer, e o público são
   donos de servidores que vão testar exatamente isso.
2. **O que ainda não arrancou diz-se.** "Nothing deployed yet" fica lá.
3. **O post seguinte continua.** Não repete a apresentação: conta o que
   mudou desde o anterior, e assume que o anterior foi lido.
4. **Uma afirmação nova precisa de uma linha nesta lista.** Se não pode
   ser acrescentada aqui, é porque ainda não é verdade.
5. **Os posts são em inglês.** Os commits também. A conversa é em
   português.

## Onde vivem as peças

- Kit de posts (curto, longo, thread, com contagem de caracteres):
  <https://claude.ai/code/artifact/55f5d958-9cdd-4d48-be44-817d86fd37a1>
- Mapa do sistema (o que está construído, com os mecanismos):
  <https://claude.ai/code/artifact/bf5d522f-f790-4482-a493-9c90d9262fb0>
- Imagens, com botão de gravar:
  <https://claude.ai/code/artifact/026c5200-a130-4275-af87-12ebab2cd3f7>
- Os PNG estão nesta pasta, e servem-se por
  `raw.githubusercontent.com` — é a via que funciona no telemóvel.

## As imagens de cada post

| post | imagem |
|---|---|
| 1 | `vicehub-system-1600x900.png`, `vicehub-card-1600x900.png` |
| 3 | `vicehub-dinheiro-1600x900.png` — o caminho do dinheiro |

Cada uma existe em 1600×900 para o X e em 3200×1800 para quando for
preciso ampliar. As fontes são as do produto, embebidas na imagem: o
Google Fonts está bloqueado no browser que as gera, por isso os ficheiros
são trazidos por `curl` e postos em base64 antes de renderizar.
