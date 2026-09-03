import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

import { sessionStore } from '../src/lib/session.js';
import { resetApiState } from '../src/lib/api.js';

/**
 * O estado da sessão vive num módulo, não num componente.
 *
 * Sem isto, uma sessão aberta num teste seguiria para o próximo e
 * mascararia falhas — o pior tipo de teste verde.
 */
afterEach(() => {
    cleanup();
    sessionStore.clear();
    resetApiState();
});
