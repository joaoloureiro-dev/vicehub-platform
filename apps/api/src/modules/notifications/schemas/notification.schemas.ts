import { z } from 'zod';

export const listNotificationsQuerySchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
});

export const notificationIdParamSchema = z.object({
    notificationId: z.string().uuid(),
});

export type ListNotificationsQueryDto = z.infer<
    typeof listNotificationsQuerySchema
>;
export type NotificationIdParamDto = z.infer<typeof notificationIdParamSchema>;
