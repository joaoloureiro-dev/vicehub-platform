import { z } from 'zod';

/**
 * Personalização visual de um perfil.
 *
 * É a mesma coisa para utilizadores, crews e servidores, por isso vive
 * num só sítio: três cópias da validação divergiriam ao primeiro campo
 * novo, e a cor deixaria de significar o mesmo consoante o perfil.
 */
export interface Appearance {
    bannerUrl: string | null;
    accentColor: string | null;
}

/**
 * Cor de destaque em hexadecimal de seis dígitos.
 *
 * A forma curta (#abc) fica de fora de propósito: aceitar as duas
 * obrigaria quem lê a normalizar antes de comparar, e o que se ganha
 * é escrever três caracteres a menos.
 */
const accentColorSchema = z
    .string()
    .trim()
    .regex(
        /^#[0-9A-Fa-f]{6}$/,
        'A cor tem de ser um hexadecimal de seis dígitos, como #1B9AAA.',
    );

/**
 * Alteração da personalização.
 *
 * Todos os campos são opcionais e cada um é anulável: não indicar um
 * campo deixa-o como está, indicá-lo a null limpa-o. Sem essa distinção
 * não haveria forma de remover um banner depois de o ter posto.
 */
export const updateAppearanceSchema = z
    .object({
        bannerUrl: z.string().trim().url().max(2048).nullable(),
        accentColor: accentColorSchema.nullable(),
    })
    .partial()
    .refine((value) => Object.keys(value).length > 0, {
        message: 'Indica pelo menos um campo a alterar.',
    });

export type UpdateAppearanceDto = z.infer<typeof updateAppearanceSchema>;

/**
 * Personalização vazia.
 *
 * É o que qualquer perfil mostra sem plano ativo. Devolver a estrutura
 * com os campos a null, em vez de a omitir, poupa a quem consome ter um
 * caminho diferente para o caso sem plano.
 */
export const NO_APPEARANCE: Appearance = {
    bannerUrl: null,
    accentColor: null,
};

/**
 * A personalização tal como é mostrada.
 *
 * O que está gravado só aparece enquanto o plano estiver ativo. Os
 * valores não são apagados quando o plano termina — quem voltar a
 * subscrever reencontra o que tinha —, mas deixam de ser mostrados: caso
 * contrário bastaria pagar um mês para ficar com a personalização para
 * sempre, e o que se vende é exibi-la, não defini-la uma vez.
 */
export const visibleAppearance = (
    stored: { banner_url: string | null; accent_color: string | null },
    isPremium: boolean,
): Appearance => {
    if (!isPremium) {
        return NO_APPEARANCE;
    }

    return {
        bannerUrl: stored.banner_url,
        accentColor: stored.accent_color,
    };
};

/**
 * Converte o pedido para os nomes das colunas.
 *
 * As chaves ausentes continuam ausentes: com exactOptionalPropertyTypes,
 * pôr `banner_url: undefined` no update do Prisma seria rejeitado pelo
 * compilador, e sem ele apagaria o campo por engano.
 */
export const toAppearanceColumns = (
    input: UpdateAppearanceDto,
): { banner_url?: string | null; accent_color?: string | null } => {
    const columns: { banner_url?: string | null; accent_color?: string | null } =
        {};

    if (input.bannerUrl !== undefined) {
        columns.banner_url = input.bannerUrl;
    }

    if (input.accentColor !== undefined) {
        columns.accent_color = input.accentColor;
    }

    return columns;
};
