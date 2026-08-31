import {
    ENTITLING_SUBSCRIPTION_STATUSES,
    PLANS,
    PLAN_KEYS,
    addPlanInterval,
} from '@vicehub/database';
import { describe, expect, it } from 'vitest';

/**
 * Testes ao catálogo de planos.
 *
 * O preço e a duração de um período decidem quanto se cobra e até quando
 * vale o acesso. Um engano aqui não dá erro nenhum: dá dinheiro a mais ou
 * a menos, sem ninguém dar por isso.
 */
describe('catálogo de planos', () => {
    it('o preço está em cêntimos e é positivo', () => {
        for (const key of PLAN_KEYS) {
            expect(Number.isInteger(PLANS[key].priceCents)).toBe(true);
            expect(PLANS[key].priceCents).toBeGreaterThan(0);
        }
    });

    it('o premium custa 10 USD por mês', () => {
        expect(PLANS.premium.priceCents).toBe(1_000);
        expect(PLANS.premium.currency).toBe('USD');
        expect(PLANS.premium.intervalMonths).toBe(1);
    });

    /**
     * Enquanto o pagamento estiver em falta o acesso não é concedido.
     * Incluir past_due daria plano de graça a quem não pagou.
     */
    it('um pagamento em falta não dá direito ao plano', () => {
        expect(ENTITLING_SUBSCRIPTION_STATUSES).not.toContain('past_due');
        expect(ENTITLING_SUBSCRIPTION_STATUSES).toContain('active');
    });
});

describe('cálculo do fim de um período', () => {
    const um = PLANS.premium;

    it('soma o intervalo do plano', () => {
        expect(addPlanInterval(new Date('2026-03-10T12:00:00.000Z'), um)).toEqual(
            new Date('2026-04-10T12:00:00.000Z'),
        );
    });

    /**
     * setMonth sozinho pediria "31 de fevereiro" e o JavaScript
     * transbordaria para março, dando dias a mais a quem subscreve ao fim
     * do mês.
     */
    it.each([
        ['2026-01-31', '2026-02-28'],
        ['2026-03-31', '2026-04-30'],
        ['2026-05-31', '2026-06-30'],
        ['2026-08-31', '2026-09-30'],
    ])('%s + 1 mês fica em %s, sem transbordar', (inicio, esperado) => {
        const fim = addPlanInterval(new Date(`${inicio}T00:00:00.000Z`), um);

        expect(fim.toISOString().slice(0, 10)).toBe(esperado);
    });

    it('respeita o ano bissexto', () => {
        const fim = addPlanInterval(new Date('2028-01-31T00:00:00.000Z'), um);

        expect(fim.toISOString().slice(0, 10)).toBe('2028-02-29');
    });

    /**
     * O caso que dá dinheiro: períodos encadeados a partir de um fim de
     * mês. Com o transbordo, cada renovação acrescentava dias, e ao fim
     * de um ano o assinante tinha semanas que não pagou.
     *
     * O recorte tira-lhe esse ganho, mas não devolve o dia ao valor
     * original: uma vez recortado para 28, os meses seguintes partem de
     * 28. A deriva passa a ser de três dias por ano e a favor da
     * plataforma, em vez de indefinida e a favor de quem subscreve.
     *
     * É um compromisso deliberado. Preservar a âncora de faturação é o
     * que o Stripe faz, e é ele que passará a calcular os períodos quando
     * o pagamento a sério entrar — construí-lo agora seria substituído.
     */
    it('doze renovações a partir de 31 de janeiro não ganham dias', () => {
        let momento = new Date('2026-01-31T00:00:00.000Z');

        for (let mes = 0; mes < 12; mes += 1) {
            momento = addPlanInterval(momento, um);
        }

        /**
         * Com o transbordo isto dava 2027-03-03: mais de dois meses de
         * acesso não pago ao fim de um ano.
         */
        expect(momento.toISOString().slice(0, 10)).toBe('2027-01-28');
    });

    it('a deriva restante é sempre a favor da plataforma, nunca contra', () => {
        let comRecorte = new Date('2026-01-31T00:00:00.000Z');

        for (let mes = 0; mes < 12; mes += 1) {
            comRecorte = addPlanInterval(comRecorte, um);
        }

        const umAnoCertoDepois = new Date('2027-01-31T00:00:00.000Z');

        expect(comRecorte.getTime()).toBeLessThanOrEqual(umAnoCertoDepois.getTime());
    });

    it('não altera a data que recebe', () => {
        const inicio = new Date('2026-01-31T00:00:00.000Z');

        addPlanInterval(inicio, um);

        expect(inicio.toISOString()).toBe('2026-01-31T00:00:00.000Z');
    });

    it('um intervalo de vários meses cai no dia equivalente', () => {
        const fim = addPlanInterval(new Date('2026-01-15T00:00:00.000Z'), {
            ...um,
            intervalMonths: 6,
        });

        expect(fim.toISOString().slice(0, 10)).toBe('2026-07-15');
    });
});
