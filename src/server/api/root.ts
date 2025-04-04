import { exampleRouter } from "~/server/api/routers/example";
import { createTRPCRouter } from "~/server/api/trpc";
import { postsRouter } from "./routers/posts";
import { journalsRouter } from "./routers/journals";

/**
 * This is the primary router for your server.
 *
 * All routers added in /api/routers should be manually added here.
 */
export const appRouter = createTRPCRouter({
  posts: postsRouter,
  journals: journalsRouter,
  example: exampleRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;
