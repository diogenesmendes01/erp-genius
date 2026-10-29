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

type AmbienteApp = {
  NODE_ENV?: string;
  APP_BASE_URL?: string;
};

function urlHttpsPublica(valor: string): URL | null {
  const bruto = valor.trim();
  if (!bruto || bruto.endsWith("/")) return null;
  try {
    const url = new URL(bruto);
    if (url.protocol !== "https:" || url.hostname.length === 0 || url.username !== "" || url.password !== "") return null;
    if (url.pathname !== "/" || url.search !== "" || url.hash !== "") return null;
    return url;
  } catch {
    return null;
  }
}

export function lerAppBaseUrl(env: AmbienteApp = process.env): URL | null {
  return urlHttpsPublica(env.APP_BASE_URL ?? "");
}

export function validarAppBaseUrlNoBoot(env: AmbienteApp = process.env): void {
  if (env.NODE_ENV !== "production") return;
  if (!lerAppBaseUrl(env)) throw new Error("APP_BASE_URL precisa ser uma URL https em produção.");
}

/** Origin tem de coincidir com APP_BASE_URL. Host, X-Forwarded-* e request.url não participam. */
export function origemPortalAlunoPermitida(request: Request, env: AmbienteApp = process.env): boolean {
  const bruto = request.headers.get("origin");
  if (!bruto) return false;
  let origem: URL;
  try {
    origem = new URL(bruto);
  } catch {
    return false;
  }
  const base = lerAppBaseUrl(env);
  if (base && origem.origin === base.origin) return true;
  if (env.NODE_ENV === "production") return false;
  return origem.protocol === "http:" && origem.hostname === "localhost";
}
