-- Personalização do perfil, reservada a quem tem plano ativo.
--
-- Os campos ficam gravados mesmo depois de o plano terminar: quem voltar
-- a subscrever reencontra o que tinha. Apagá-los ao fim da subscrição
-- seria um castigo, e o que se compra é o direito de *definir*, não o de
-- não perder o que já se definiu.
ALTER TABLE "User"   ADD COLUMN "banner_url" TEXT, ADD COLUMN "accent_color" TEXT;
ALTER TABLE "Crew"   ADD COLUMN "banner_url" TEXT, ADD COLUMN "accent_color" TEXT;
ALTER TABLE "Server" ADD COLUMN "banner_url" TEXT, ADD COLUMN "accent_color" TEXT;

-- A cor é um hexadecimal de seis dígitos. Validá-la aqui também impede
-- que um valor mal formado entre por uma via que não a API.
ALTER TABLE "User" ADD CONSTRAINT "User_accent_color_format_check"
    CHECK ("accent_color" IS NULL OR "accent_color" ~ '^#[0-9A-Fa-f]{6}$');
ALTER TABLE "Crew" ADD CONSTRAINT "Crew_accent_color_format_check"
    CHECK ("accent_color" IS NULL OR "accent_color" ~ '^#[0-9A-Fa-f]{6}$');
ALTER TABLE "Server" ADD CONSTRAINT "Server_accent_color_format_check"
    CHECK ("accent_color" IS NULL OR "accent_color" ~ '^#[0-9A-Fa-f]{6}$');
