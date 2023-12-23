import { Immutable } from "immer";
import { AuthorizationError } from "./AuthorizationError";
import { AuthorizedContext, AuthorizedContextKey, _perms } from "./AuthorizedContext";

export abstract class Model<Key extends AuthorizedContextKey> {
    constructor(private readonly context: AuthorizedContext<Key>) {
        if (this.authChecks().read) {
            _perms(context, this.authChecks().scopes).forEach(p => {
                if (!p.read) {
                    throw new AuthorizationError();
                }
            })
        }
        if (this.authChecks().write) {
            _perms(context, this.authChecks().scopes).forEach(p => {
                if (!p.write) {
                    throw new AuthorizationError();
                }
            })
        }
    }

    protected abstract authChecks(): {
        scopes: Immutable<Key>,
        read: true,
        write: boolean
    }

    protected get _auth() {
        return this.context._auth;
    }
    protected get prisma() {
        return this.context.prisma;
    }
    protected get session() {
        return this.context.session;
    }
}