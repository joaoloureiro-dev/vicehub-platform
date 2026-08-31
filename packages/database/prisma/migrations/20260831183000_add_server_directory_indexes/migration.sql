-- O nome do servidor passa a ser único: é por ele que um servidor é
-- encontrado no diretório público, e dois homónimos seriam
-- indistinguíveis para quem procura onde jogar.
CREATE UNIQUE INDEX "Server_name_key" ON "Server"("name");

-- Espelha o índice que já existe para crews. As listagens de membros e de
-- pedidos filtram sempre por servidor e estado em conjunto.
CREATE INDEX "Membership_serverId_status_idx" ON "Membership"("serverId", "status");
