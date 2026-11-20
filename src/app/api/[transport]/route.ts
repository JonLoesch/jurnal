import { createMcpHandler, withMcpAuth } from "mcp-handler";
import { getDb } from "@/db/client";
import { registerTools } from "@/server/mcp";
import { verifyToken } from "@/server/tokens";

// The MCP endpoint (/api/mcp). A bearer token, made in Settings, says who is asking and what they may do.
const handler = createMcpHandler(
  (server) => registerTools(server),
  { serverInfo: { name: "jurnal", version: "1.0.0" } },
  { basePath: "/api", disableSse: true },
);

const authed = withMcpAuth(
  handler,
  async (_req, bearer) => {
    const t = await verifyToken(getDb(), bearer);
    if (!t) return undefined;
    return { token: bearer ?? "", clientId: t.tokenId, scopes: t.scopes, extra: { accountId: t.accountId } };
  },
  { required: true },
);

export { authed as GET, authed as POST, authed as DELETE };
