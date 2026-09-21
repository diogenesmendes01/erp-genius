import type { Prisma } from "@prisma/client";
import { nomeCompleto } from "@/lib/nome";

export type OrigemDestinoFinanceiro = "PAGADOR_PREPARACAO" | "LEGADO";
export type TipoPagadorDestino = "ALUNO" | "RESPONSAVEL" | "EMPRESA" | null;

/** Identidade financeira efetiva de uma matrícula, inclusive a versão que a fundamenta. */
export interface DestinoFinanceiro {
  telefoneE164: string;
  nome: string;
  responsavelId: string | null;
  /** Só ALUNO pode vincular o contato ao cadastro global do aluno. */
  contatoAlunoId: string | null;
  alunoId: string;
  matriculaId: string;
  fuso: string;
  origem: OrigemDestinoFinanceiro;
  tipoPagador: TipoPagadorDestino;
  referenciaFonte: string;
}

export const INCLUDE_MATRICULA_DESTINO = {
  pais: true,
  aluno: {
    include: {
      pais: true,
      responsaveis: { include: { responsavel: true } },
      _count: { select: { matriculas: true } },
    },
  },
  pagadoresPreparacao: { orderBy: { versao: "desc" }, take: 1 },
  preparacaoComercial: { select: { id: true } },
} as const satisfies Prisma.MatriculaInclude;

export const INCLUDE_DESTINO = {
  matricula: { include: INCLUDE_MATRICULA_DESTINO },
} as const satisfies Prisma.CobrancaInclude;

export type MatriculaComDestino = Prisma.MatriculaGetPayload<{ include: typeof INCLUDE_MATRICULA_DESTINO }>;
export type CobrancaComDestino = Prisma.CobrancaGetPayload<{ include: typeof INCLUDE_DESTINO }>;

const telefoneValido = (v: unknown): v is string => typeof v === "string" && /^\+[1-9]\d{7,14}$/.test(v);
const textoValido = (v: unknown): v is string => typeof v === "string" && v.trim().length > 0;
const objeto = (v: unknown): Record<string, unknown> | null => typeof v === "object" && v !== null && !Array.isArray(v) ? v as Record<string, unknown> : null;

function base(matricula: MatriculaComDestino) {
  const aluno = matricula.aluno;
  return { aluno, fuso: aluno.fuso ?? aluno.pais?.fuso ?? matricula.pais?.fuso ?? "America/Sao_Paulo" };
}

function destinoAluno(matricula: MatriculaComDestino, referenciaFonte: string, origem: OrigemDestinoFinanceiro, tipoPagador: TipoPagadorDestino): DestinoFinanceiro | null {
  const { aluno, fuso } = base(matricula);
  if (!telefoneValido(aluno.telefoneE164)) return null;
  return { telefoneE164: aluno.telefoneE164, nome: nomeCompleto(aluno), responsavelId: null, contatoAlunoId: aluno.id,
    alunoId: aluno.id, matriculaId: matricula.id, fuso, origem, tipoPagador, referenciaFonte };
}

function destinoLegado(matricula: MatriculaComDestino): DestinoFinanceiro | null {
  const { aluno, fuso } = base(matricula);
  if (aluno._count.matriculas !== 1) return null;
  const financeiros = aluno.responsaveis.filter((v) => v.papel === "FINANCEIRO").sort((a, b) => a.id.localeCompare(b.id));
  if (financeiros.length) {
    const responsavel = financeiros.find((v) => telefoneValido(v.responsavel.telefoneE164));
    const telefoneE164 = responsavel?.responsavel.telefoneE164;
    if (!responsavel || !telefoneValido(telefoneE164)) return null;
    return { telefoneE164, nome: responsavel.responsavel.nome, responsavelId: responsavel.responsavelId,
      contatoAlunoId: null, alunoId: aluno.id, matriculaId: matricula.id, fuso, origem: "LEGADO", tipoPagador: null,
      referenciaFonte: `legado:${matricula.id}` };
  }
  return destinoAluno(matricula, `legado:${matricula.id}`, "LEGADO", null);
}

/**
 * Resolve o único destinatário de cobrança a partir da matrícula. Uma fonte de
 * pagador explícita sempre vence; dados incompletos nunca recaem no cadastro global.
 */
export function resolverDestinoFinanceiroDaMatricula(matricula: MatriculaComDestino): DestinoFinanceiro | null {
  const pagador = matricula.pagadoresPreparacao[0];
  if (pagador) {
    const dados = objeto(pagador.dados);
    const referenciaFonte = `pagador:${pagador.id}:${pagador.versao}`;
    if (!dados) return null;
    if (pagador.tipo === "ALUNO") {
      if (dados.alunoId !== matricula.aluno.id) return null;
      return destinoAluno(matricula, referenciaFonte, "PAGADOR_PREPARACAO", "ALUNO");
    }
    if ((pagador.tipo === "RESPONSAVEL" || pagador.tipo === "EMPRESA") && textoValido(dados.nome) && telefoneValido(dados.telefoneE164)) {
      const { aluno, fuso } = base(matricula);
      return { telefoneE164: dados.telefoneE164, nome: dados.nome.trim(), responsavelId: null, contatoAlunoId: null,
        alunoId: aluno.id, matriculaId: matricula.id, fuso, origem: "PAGADOR_PREPARACAO", tipoPagador: pagador.tipo,
        referenciaFonte };
    }
    return null;
  }
  // Preparação já existe: sem fotografia de pagador é pendência, não legado.
  if (matricula.preparacaoComercial) return null;
  return destinoLegado(matricula);
}

export function resolverDestinoCobranca(cobranca: CobrancaComDestino): DestinoFinanceiro | null {
  return resolverDestinoFinanceiroDaMatricula(cobranca.matricula);
}
