export class UserError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 403 | 404 | 409 = 400,
  ) {
    super(message);
  }
}

export const notFound = (what = "Not found") => new UserError(what, 404);
export const forbidden = (what = "Not allowed") => new UserError(what, 403);
