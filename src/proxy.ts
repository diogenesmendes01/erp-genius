import { NextResponse, type NextRequest } from "next/server";
import { CABECALHO_CAMINHO } from "@/lib/destino-interno";

export function proxy(request: NextRequest) {
  const cabecalhos = new Headers(request.headers);
  cabecalhos.set(CABECALHO_CAMINHO, `${request.nextUrl.pathname}${request.nextUrl.search}`);
  return NextResponse.next({ request: { headers: cabecalhos } });
}

export const config = {
  matcher: ["/((?!api/|_next/static|_next/image|favicon.ico).*)"],
};
