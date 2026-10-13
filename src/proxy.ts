import { NextResponse, type NextRequest } from "next/server";
import { CABECALHO_CAMINHO } from "@/lib/destino-interno";

// Proxy do Next 16 (o antigo middleware). Só uma coisa: contar ao guard da página qual caminho foi pedido
// (docs/42 /login #2; docs/43 §6 item 8). Um Server Component não conhece a própria URL; sem isso o guard
// manda para `/login` e o login leva sempre ao /home, e quem abriu o link de um registro com a sessão vencida
// refaz a navegação inteira. Não autentica, não bloqueia e não lê cookie: a permissão continua no guard.
//
// O cabeçalho é SEMPRE reescrito aqui (um valor mandado pelo navegador não passa adiante), e o guard ainda
// valida o caminho com destinoInterno antes de usá-lo (src/lib/destino-interno.ts).
export function proxy(request: NextRequest) {
  const cabecalhos = new Headers(request.headers);
  cabecalhos.set(CABECALHO_CAMINHO, `${request.nextUrl.pathname}${request.nextUrl.search}`);
  return NextResponse.next({ request: { headers: cabecalhos } });
}

export const config = {
  // Só páginas: API, arquivos do build e o ícone ficam de fora.
  matcher: ["/((?!api/|_next/static|_next/image|favicon.ico).*)"],
};
