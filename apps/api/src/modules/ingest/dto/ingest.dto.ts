import type { z } from 'zod';

import type {
    apiKeyParamSchema,
    createApiKeySchema,
    heartbeatSchema,
    serverIdParamSchema,
} from '../schemas/ingest.schemas.js';

export type ServerIdParamDto = z.infer<typeof serverIdParamSchema>;
export type ApiKeyParamDto = z.infer<typeof apiKeyParamSchema>;
export type CreateApiKeyDto = z.infer<typeof createApiKeySchema>;
export type HeartbeatDto = z.infer<typeof heartbeatSchema>;
