// Volta à página pedida depois do login (docs/42-auditoria-frontend-ux.md, /login #2; docs/43 §6 item 8).
// O guard da página manda para `/login?callbackUrl=<caminho>` e o login devolve a pessoa a esse caminho.
// O valor vem da URL, então pode ter sido montado por qualquer um: só vale um CAMINHO INTERNO, para o
// login nunca virar um redirecionador aberto (`?callbackUrl=https://golpe.example`, `//golpe.example`,
// `/\golpe.example`, ou um caractere de controle que o navegador apaga ao ler a URL, como em `/\t/golpe`).

/** Para onde o login leva quando não há destino pedido (ou o pedido é recusado). */
export const DESTINO_PADRAO_APOS_LOGIN = "/home";

/** Cabeçalho em que o proxy (src/proxy.ts) informa ao guard o caminho pedido (pathname + query). */
export const CABECALHO_CAMINHO = "x-erp-caminho";

/** Origem fictícia: só serve para o `URL` resolver o caminho e provar que ele não troca de origem. */
const ORIGEM_INTERNA = "http://destino.interno";
const TAMANHO_MAXIMO = 2048;

/** Barra invertida e caracteres de controle (o navegador os trata como `/` ou os remove da URL). */
function temCaractereProibido(valor: string): boolean {
  for (const c of valor) {
    const codigo = c.charCodeAt(0);
    if (codigo < 0x20 || codigo === 0x7f || c === "\\") return true;
  }
  return false;
}

/**
 * O caminho interno (pathname + query + fragmento) quando `valor` é seguro para navegar sem sair do
 * sistema; senão null. Recusa: o que não começa com uma barra só, URL absoluta, protocolo relativo
 * (`//`, também depois de resolver `.` e `..`), barra invertida, caractere de controle, texto longo
 * demais, o próprio login (laço) e a API.
 */
export function destinoInterno(valor: unknown): string | null {
  if (typeof valor !== "string" || valor.length === 0 || valor.length > TAMANHO_MAXIMO) return null;
  if (!valor.startsWith("/") || valor.startsWith("//") || temCaractereProibido(valor)) return null;
  let url: URL;
  try {
    url = new URL(valor, ORIGEM_INTERNA);
  } catch {
    return null;
  }
  if (url.origin !== ORIGEM_INTERNA) return null;
  const caminho = url.pathname;
  // `/.//golpe.example` e `/a/..//golpe.example` viram `//golpe.example` depois da normalização: o caminho
  // resolvido também não pode começar com duas barras (seria protocolo relativo no router.push).
  if (caminho.startsWith("//")) return null;
  if (caminho === "/login" || caminho.startsWith("/login/") || caminho === "/api" || caminho.startsWith("/api/")) return null;
  return `${caminho}${url.search}${url.hash}`;
}

/** Destino depois do login: o `callbackUrl` quando é um caminho interno; senão a página inicial. */
export function destinoAposLogin(callbackUrl: unknown): string {
  return destinoInterno(callbackUrl) ?? DESTINO_PADRAO_APOS_LOGIN;
}

/**
 * Endereço do login que o guard usa: com `callbackUrl` quando o caminho pedido é interno e não é a própria
 * página inicial (que já é o destino padrão); senão `/login` puro.
 */
export function enderecoDoLogin(caminhoPedido: unknown): string {
  const destino = destinoInterno(caminhoPedido);
  if (!destino || destino === DESTINO_PADRAO_APOS_LOGIN) return "/login";
  return `/login?callbackUrl=${encodeURIComponent(destino)}`;
}
