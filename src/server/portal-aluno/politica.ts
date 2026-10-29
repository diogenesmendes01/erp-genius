import { createHash, randomBytes, timingSafeEqual } from "crypto";

export const COOKIE_SESSAO_PORTAL_ALUNO = "portal_aluno_session";

export type PrazosPortalAluno = {
  sessaoMinutos: number;
  conviteMinutos: number;
  recuperacaoMinutos: number;
  validacaoEmailMinutos: number;
};

const PRAZO_MAXIMO_MINUTOS = 365 * 24 * 60;

type PrazosBrutos = {
  prazoSessaoPortalAlunoMinutos: number | null;
  prazoConvitePortalAlunoMinutos: number | null;
  prazoRecuperacaoPortalAlunoMinutos: number | null;
  prazoValidacaoEmailPortalAlunoMinutos: number | null;
};

export function exigirPrazosPortalAluno(configuracao: PrazosBrutos): PrazosPortalAluno {
  const pares = [
    ["sessaoMinutos", configuracao.prazoSessaoPortalAlunoMinutos],
    ["conviteMinutos", configuracao.prazoConvitePortalAlunoMinutos],
    ["recuperacaoMinutos", configuracao.prazoRecuperacaoPortalAlunoMinutos],
    ["validacaoEmailMinutos", configuracao.prazoValidacaoEmailPortalAlunoMinutos],
  ] as const;
  for (const [, valor] of pares) {
    if (!Number.isSafeInteger(valor) || !valor || valor < 1 || valor > PRAZO_MAXIMO_MINUTOS) {
      throw new Error("Os prazos do portal do aluno precisam ser configurados antes do acesso.");
    }
  }
  return Object.fromEntries(pares) as PrazosPortalAluno;
}

export function normalizarEmailPortalAluno(valor: string): string {
  const email = valor.trim().toLowerCase();
  if (!email || email.length > 320 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("E-mail inválido.");
  }
  return email;
}

export function gerarSegredoPortalAluno(): string {
  return randomBytes(32).toString("base64url");
}

export function digestSegredoPortalAluno(segredo: string): string {
  return createHash("sha256").update(segredo, "utf8").digest("hex");
}

export function caminhoAtivacaoPortalAluno(segredo: string): string {
  if (!segredo || segredo.length > 200) throw new Error("Segredo de ativação inválido.");
  return `/portal-aluno/ativar#token=${encodeURIComponent(segredo)}`;
}

export function segredosIguaisPortalAluno(a: string, b: string): boolean {
  const da = Buffer.from(digestSegredoPortalAluno(a), "hex");
  const db = Buffer.from(digestSegredoPortalAluno(b), "hex");
  return timingSafeEqual(da, db);
}

export function cookieSessaoPortalAluno(valor: string, expiraEm: Date) {
  if (!Number.isFinite(expiraEm.getTime()) || expiraEm <= new Date()) {
    throw new Error("Expiração de sessão inválida.");
  }
  return {
    name: COOKIE_SESSAO_PORTAL_ALUNO,
    value: valor,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    expires: expiraEm,
  };
}

const PROTOCOLOS_HTTP = new Set(["http:", "https:"]);

function protocoloHttp(valor: string): "http:" | "https:" | null {
  if (valor === "http" || valor === "http:") return "http:";
  if (valor === "https" || valor === "https:") return "https:";
  return null;
}

function hostDeCabecalho(valor: string, protocolo: "http:" | "https:"): string | null {
  const primeiro = valor.split(",")[0]?.trim();
  if (!primeiro) return null;
  try {
    return new URL(`${protocolo}//${primeiro}`).host.toLowerCase();
  } catch {
    return null;
  }
}

/** `request.url` no `next start` usa o bind do processo (`0.0.0.0:3000`, `app`), não o host público. */
function hostDeBindInterno(hostname: string): boolean {
  const nome = hostname.toLowerCase();
  if (nome === "localhost" || nome === "0.0.0.0" || nome === "127.0.0.1" || nome === "::1" || nome === "[::1]") return true;
  if (!nome.includes(".")) return true;
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(nome);
}

function protocoloEncaminhado(request: Request): "http:" | "https:" | null {
  const partes = request.headers.get("x-forwarded-proto")?.split(",").map((p) => p.trim().toLowerCase()).filter(Boolean) ?? [];
  const ultimo = partes.at(-1);
  return ultimo ? protocoloHttp(ultimo) : null;
}

export function origemPortalAlunoPermitida(request: Request): boolean {
  const bruto = request.headers.get("origin");
  if (!bruto) return false;
  try {
    const origem = new URL(bruto);
    const canonica = new URL(request.url);
    if (!PROTOCOLOS_HTTP.has(origem.protocol) || !PROTOCOLOS_HTTP.has(canonica.protocol)) return false;
    if (origem.origin === canonica.origin) return true;
    if (origem.hostname.toLowerCase() === canonica.hostname.toLowerCase()) {
      return origem.protocol === canonica.protocol || (origem.protocol === "https:" && canonica.protocol === "http:");
    }
    if (!hostDeBindInterno(canonica.hostname)) return false;
    const protocoloPublico = protocoloEncaminhado(request);
    if (protocoloPublico && origem.protocol !== protocoloPublico) return false;
    if (!protocoloPublico && origem.protocol === "http:" && canonica.protocol === "https:") return false;
    const publico = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
    if (!publico) return false;
    return hostDeCabecalho(publico, origem.protocol as "http:" | "https:") === origem.host.toLowerCase();
  } catch {
    return false;
  }
}
