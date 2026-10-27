export const DESTINO_PADRAO_APOS_LOGIN = "/home";

export const CABECALHO_CAMINHO = "x-erp-caminho";

const ORIGEM_INTERNA = "http://destino.interno";
const TAMANHO_MAXIMO = 2048;

function temCaractereProibido(valor: string): boolean {
  for (const c of valor) {
    const codigo = c.charCodeAt(0);
    if (codigo < 0x20 || codigo === 0x7f || c === "\\") return true;
  }
  return false;
}

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
  if (caminho.startsWith("//")) return null;
  if (caminho === "/login" || caminho.startsWith("/login/") || caminho === "/api" || caminho.startsWith("/api/")) return null;
  return `${caminho}${url.search}${url.hash}`;
}

export function destinoAposLogin(callbackUrl: unknown): string {
  return destinoInterno(callbackUrl) ?? DESTINO_PADRAO_APOS_LOGIN;
}

export function enderecoDoLogin(caminhoPedido: unknown): string {
  const destino = destinoInterno(caminhoPedido);
  if (!destino || destino === DESTINO_PADRAO_APOS_LOGIN) return "/login";
  return `/login?callbackUrl=${encodeURIComponent(destino)}`;
}
