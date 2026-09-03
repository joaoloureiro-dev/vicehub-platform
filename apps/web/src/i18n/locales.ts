export const IDIOMAS = [
    { codigo: 'en', nome: 'English' },
    { codigo: 'pt', nome: 'Português' },
    { codigo: 'es', nome: 'Español' },
    { codigo: 'fr', nome: 'Français' },
] as const;

export type Idioma = (typeof IDIOMAS)[number]['codigo'];

export const IDIOMA_POR_OMISSAO: Idioma = 'en';

const CODIGOS = new Set<string>(IDIOMAS.map((idioma) => idioma.codigo));

/**
 * Que idioma mostrar a quem chega pela primeira vez.
 *
 * A preferência do browser é a melhor pista que existe antes de a
 * pessoa dizer alguma coisa — e `pt-BR` ou `fr-CA` valem tanto como
 * `pt` ou `fr`, por isso só a primeira parte conta. Sem correspondência,
 * inglês.
 */
export const idiomaDoBrowser = (linguas: readonly string[]): Idioma => {
    for (const lingua of linguas) {
        const base = lingua.toLowerCase().split('-')[0];

        if (base && CODIGOS.has(base)) {
            return base as Idioma;
        }
    }

    return IDIOMA_POR_OMISSAO;
};
