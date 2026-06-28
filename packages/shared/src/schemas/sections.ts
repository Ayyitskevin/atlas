import { z } from "zod";

export const createSectionRequestSchema = z.object({
  name: z.string().min(1).max(160),
  position: z.number().finite().optional(),
});

export const updateSectionRequestSchema = createSectionRequestSchema.partial();

export const reorderSectionsRequestSchema = z.object({
  sections: z.array(
    z.object({
      id: z.string().uuid(),
      position: z.number().finite(),
    }),
  ),
});

export type CreateSectionRequest = z.infer<typeof createSectionRequestSchema>;
export type UpdateSectionRequest = z.infer<typeof updateSectionRequestSchema>;
export type ReorderSectionsRequest = z.infer<typeof reorderSectionsRequestSchema>;
