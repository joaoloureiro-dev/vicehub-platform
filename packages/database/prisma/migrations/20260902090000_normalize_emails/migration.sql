-- O email identifica uma conta, e a caixa das letras não faz parte dessa
-- identidade.
--
-- `Player@vicehub.com` e `player@vicehub.com` são a mesma caixa de correio
-- em qualquer servidor que exista na prática. Guardá-los como identidades
-- distintas deixava criar duas contas para a mesma pessoa e fazia o login
-- falhar a quem escrevesse o próprio email com outra caixa.
--
-- A API passa a normalizar à entrada; isto trata do que já está gravado.
--
-- Se dois registos existentes diferirem apenas na caixa, esta migração
-- falha na restrição de unicidade do email — e é isso que se pretende.
-- Significa que há duas contas para a mesma pessoa, e qual delas fica é
-- uma decisão de quem gere a plataforma, não desta migração.
UPDATE "User"
SET "email" = lower("email")
WHERE "email" <> lower("email");
