import { createHash, randomBytes, timingSafeEqual } from "crypto";

export const COOKIE_SESSAO_PORTAL_ALUNO = "portal_aluno_session";

export type PrazosPortalAluno = {
  sessaoMinutos: number;
  conviteMinutos: number;
  recuperacaoMinutos: number;
  validacaoEmailMinutos: number;
};

// Limite explícito para impedir Date/cookie inválido mesmo com configuração
// administrativa corrompida. Não é prazo padrão: a escola continua escolhendo
// cada valor e o serviço recusa campos ausentes.
const PRAZO_MAXIMO_MINUTOS = 365 * 24 * 60;

type PrazosBrutos = {
  prazoSessaoPortalAlunoMinutos: number | null;
  prazoConvitePortalAlunoMinutos: number | null;
  prazoRecuperacaoPortalAlunoMinutos: number | null;
  prazoValidacaoEmailPortalAlunoMinutos: number | null;
};

/** Não completa configuração ausente com número implícito. */
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

/** Token opaco; o digest é a única forma que vai para o banco. */
export function gerarSegredoPortalAluno(): string {
  return randomBytes(32).toString("base64url");
}

export function digestSegredoPortalAluno(segredo: string): string {
  return createHash("sha256").update(segredo, "utf8").digest("hex");
}

/** Caminho relativo para o adaptador institucional; o segredo fica no fragmento. */
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

/** Rotas mutáveis aceitam somente a origem do host atual (proteção CSRF). */
export function origemPortalAlunoPermitida(request: Request): boolean {
  const origem = request.headers.get("origin");
  if (!origem) return false;
  try {
    const urlOrigem = new URL(origem);
    const urlCanonica = new URL(request.url);
    if (!['http:', 'https:'].includes(urlOrigem.protocol) || !['http:', 'https:'].includes(urlCanonica.protocol)) return false;
    return urlOrigem.origin === urlCanonica.origin;
  } catch {
    return false;
  }
}
