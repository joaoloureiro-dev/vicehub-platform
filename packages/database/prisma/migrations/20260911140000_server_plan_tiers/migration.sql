-- Os escalões do plano de um servidor.
--
-- Até aqui havia um plano só, `premium`, e servia para toda a gente:
-- uma pessoa, uma crew e um servidor compravam a mesma coisa. Mas o que
-- um servidor compra não é o mesmo: é o direito a ter crews a jogar lá,
-- e esse direito tem tamanhos.
--
-- Os nomes não dizem o número de propósito. `server_base` continua a
-- ser o escalão de entrada mesmo que o número de crews que ele dá mude
-- amanhã; um `server_10` passaria a mentir na primeira alteração de
-- preços, e o nome fica gravado em cada linha de subscrição para
-- sempre. Quantas crews cada um dá vive no catálogo, em código, onde se
-- muda numa linha.
ALTER TYPE "SubscriptionPlan" ADD VALUE 'server_base';
ALTER TYPE "SubscriptionPlan" ADD VALUE 'server_plus';
ALTER TYPE "SubscriptionPlan" ADD VALUE 'server_unlimited';
