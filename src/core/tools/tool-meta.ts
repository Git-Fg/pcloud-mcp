import { z } from 'zod';

export type ToolAnnotations = {
  readOnlyHint?: boolean;
  destructiveHint?: boolean;
  idempotentHint?: boolean;
  openWorldHint?: boolean;
};

export interface ToolMeta<TSchema extends z.ZodTypeAny = z.ZodTypeAny> {
  title: string;
  description: string;
  annotations: ToolAnnotations;
  inputSchema: TSchema;
}
