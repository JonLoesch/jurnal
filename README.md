# Jurnal

This is a prototype(ish) app for blogging.  But blogging with specifically measurable metrics tied to each day (or each post) that in theory you can track and measure over time.

Because it's a prototype and unfinished, documentation will be sparse and incomplete.  But here's a few things to start.

- I have hosted my own blog, describing the process of creating and coding the blog here: https://jurnal-jonloesch.vercel.app/journal/1  (so meta!)
  - This is hosted by Vercel and there's a CICD setup for it.  Pushing to the main branch of this repo will deploy to that server.
- It's a T3 scaffolded app.  So that means the base technology stack is:
  - [Next.js](https://nextjs.org)
  - [NextAuth.js](https://next-auth.js.org)
  - [Prisma](https://prisma.io)
  - [Tailwind CSS](https://tailwindcss.com)
  - [tRPC](https://trpc.io)
  - PostgreSQL

TODO: I need to put in more explanations here of the architecture I've done surrounding metrics, and schemas, and such.
TODO: same as above, but also for the access scopes and read/write permission checking

As an aside, I will admit this application is overarchitected.  It was partly intended to be a useful application, but also partly intended to be a coding excersize for myself and a dive into some new-to-me technology.  It shows.  And I have a habit of overengineering things, which I did nothing to mitigate when writing this (which also shows).


## Learn More (T3)

To learn more about the [T3 Stack](https://create.t3.gg/), take a look at the following resources:

- [Documentation](https://create.t3.gg/)
- [Learn the T3 Stack](https://create.t3.gg/en/faq#what-learning-resources-are-currently-available) — Check out these awesome tutorials

You can check out the [create-t3-app GitHub repository](https://github.com/t3-oss/create-t3-app) — your feedback and contributions are welcome!
