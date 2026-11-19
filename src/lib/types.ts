import type { metrics, sections } from "@/db/schema";

export type Metric = typeof metrics.$inferSelect;
export type Section = typeof sections.$inferSelect;
