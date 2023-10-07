import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
//   console.log(request.nextUrl.pathname);
  if (request.nextUrl.pathname.startsWith("/journal/[themeid]")) {
    // console.log({ request });
  }
}
