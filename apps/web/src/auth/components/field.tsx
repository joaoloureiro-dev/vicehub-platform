import type { ReactNode } from 'react';

interface FieldProps {
    id: string;
    label: string;
    /**
     * `url` entrou com o mercado: o endereço de uma imagem é um campo
     * de endereço, e o browser sabe validá-lo e mostrar o teclado
     * certo num telemóvel.
     */
    type: 'text' | 'email' | 'password' | 'url';
    value: string;
    onChange: (value: string) => void;
    autoComplete?: string;
    required?: boolean;
    invalid?: boolean;
    hint?: ReactNode;
    /** Para pedir o teclado numérico sem deixar de aceitar texto. */
    inputMode?: 'numeric';
    /**
     * Onde o campo pára.
     *
     * A regra a sério é a do servidor. Esta existe para o campo parar
     * onde ele pára, em vez de deixar escrever duzentos caracteres para
     * depois lhos recusarem.
     */
    maxLength?: number;
}

export const Field = ({
    id,
    label,
    type,
    value,
    onChange,
    autoComplete,
    required = true,
    invalid = false,
    hint,
    inputMode,
    maxLength,
}: FieldProps) => (
    <div className="field">
        <label htmlFor={id}>{label}</label>
        <input
            id={id}
            name={id}
            type={type}
            value={value}
            required={required}
            aria-invalid={invalid}
            {...(hint ? { 'aria-describedby': `${id}-hint` } : {})}
            {...(inputMode ? { inputMode } : {})}
            {...(maxLength === undefined ? {} : { maxLength })}
            {...(autoComplete ? { autoComplete } : {})}
            onChange={(event) => {
                onChange(event.target.value);
            }}
        />
        {hint ? (
            <p className="hint" id={`${id}-hint`}>
                {hint}
            </p>
        ) : null}
    </div>
);
