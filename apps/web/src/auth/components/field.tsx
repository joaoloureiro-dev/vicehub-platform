import type { ReactNode } from 'react';

interface FieldProps {
    id: string;
    label: string;
    type: 'text' | 'email' | 'password';
    value: string;
    onChange: (value: string) => void;
    autoComplete?: string;
    required?: boolean;
    invalid?: boolean;
    hint?: ReactNode;
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
