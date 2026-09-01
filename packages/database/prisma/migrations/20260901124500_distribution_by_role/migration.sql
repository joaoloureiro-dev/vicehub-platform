-- Divisão ponderada por cargo.
--
-- Segue o padrão das comunidades: no paycheck do QBCore o salário vem do
-- grau, e nos assaltos quem lidera leva uma fatia maior.
ALTER TYPE "DistributionBasis" ADD VALUE 'by_role' AFTER 'equal';
