import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { nomeCompleto } from "@/lib/nome";

export type CriterioDuplicidade = "documento" | "email" | "telefone" | "nascimento";

export type IdentidadeAluno = {
  paisId: string;
  primeiroNome: string;
  sobrenome: string | null;
  documento: string | null;
  email: string | null;
  telefoneE164: string | null;
  nascimento: Date | null;
};

export type ChaveIdentidade = { chave: string; criterio: CriterioDuplicidade };

export type OrigemIdentidade = { tipo: "cadastro"; nome: string; codigo: string | null } | { tipo: "planilha"; linha: number };

export const LOTE_CANDIDATOS_DUPLICIDADE = 2000;

const RAZAO: Record<CriterioDuplicidade, string> = {
  documento: "mesmo documento no mesmo país",
  email: "mesmo nome e e-mail",
  telefone: "mesmo nome e telefone",
  nascimento: "mesmo nome e data de nascimento",
};

const semAcento = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "");

export const nomeComparavel = (primeiroNome: string, sobrenome: string | null) =>
  semAcento(`${primeiroNome} ${sobrenome ?? ""}`).toLowerCase().replace(/\s+/g, " ").trim();

export const documentoComparavel = (documento: string) => semAcento(documento).toUpperCase().replace(/[^A-Z0-9]/g, "");

const dataCivil = (d: Date) => d.toISOString().slice(0, 10);

function diaUtc(civil: string): { gte: Date; lt: Date } {
  const inicio = new Date(`${civil}T00:00:00.000Z`);
  return { gte: inicio, lt: new Date(inicio.getTime() + 24 * 60 * 60 * 1000) };
}

export function chavesDeIdentidade(p: IdentidadeAluno): ChaveIdentidade[] {
  const chaves: ChaveIdentidade[] = [];
  const doc = p.documento ? documentoComparavel(p.documento) : "";
  if (doc.length >= 4) chaves.push({ chave: `documento:${p.paisId}:${doc}`, criterio: "documento" });
  const nome = nomeComparavel(p.primeiroNome, p.sobrenome);
  if (!nome) return chaves;
  const pessoa = `${p.paisId}:${nome}`;
  const email = p.email?.trim().toLowerCase();
  if (email) chaves.push({ chave: `email:${pessoa}:${email}`, criterio: "email" });
  if (p.telefoneE164) chaves.push({ chave: `telefone:${pessoa}:${p.telefoneE164}`, criterio: "telefone" });
  if (p.nascimento && !isNaN(p.nascimento.getTime())) chaves.push({ chave: `nascimento:${pessoa}:${dataCivil(p.nascimento)}`, criterio: "nascimento" });
  return chaves;
}

export function motivoDuplicidade(origem: OrigemIdentidade, criterio: CriterioDuplicidade): string {
  return origem.tipo === "cadastro"
    ? `Já cadastrado como ${origem.nome}${origem.codigo ? ` (${origem.codigo})` : ""}: ${RAZAO[criterio]}. A linha não foi importada.`
    : `Repete a linha ${origem.linha} desta planilha: ${RAZAO[criterio]}. A linha não foi importada.`;
}

export class IndiceDuplicidade {
  private readonly vistas = new Map<string, OrigemIdentidade>();

  registrar(chaves: readonly ChaveIdentidade[], origem: OrigemIdentidade): void {
    for (const { chave } of chaves) if (!this.vistas.has(chave)) this.vistas.set(chave, origem);
  }

  procurar(chaves: readonly ChaveIdentidade[]): { origem: OrigemIdentidade; criterio: CriterioDuplicidade } | null {
    for (const { chave, criterio } of chaves) {
      const origem = this.vistas.get(chave);
      if (origem) return { origem, criterio };
    }
    return null;
  }
}

export async function carregarCadastradosParaDuplicidade(linhas: readonly IdentidadeAluno[]): Promise<IndiceDuplicidade> {
  const indice = new IndiceDuplicidade();
  const unicos = (xs: (string | null | undefined)[]) => [...new Set(xs.filter((x): x is string => !!x))];
  const documentos = unicos(linhas.flatMap((l) => (l.documento ? [l.documento.trim(), documentoComparavel(l.documento)] : [])));
  const emails = unicos(linhas.map((l) => l.email?.trim().toLowerCase()));
  const telefones = unicos(linhas.map((l) => l.telefoneE164));
  const dias = unicos(linhas.map((l) => (l.nascimento && !isNaN(l.nascimento.getTime()) ? dataCivil(l.nascimento) : null)));
  const ou: Prisma.AlunoWhereInput[] = [
    ...(documentos.length ? [{ documento: { in: documentos } }] : []),
    ...(emails.length ? [{ email: { in: emails, mode: "insensitive" as const } }] : []),
    ...(telefones.length ? [{ telefoneE164: { in: telefones } }] : []),
    ...dias.map((d) => ({ nascimento: diaUtc(d) })),
  ];
  if (!ou.length) return indice;
  const where: Prisma.AlunoWhereInput = { paisId: { in: unicos(linhas.map((l) => l.paisId)) }, OR: ou };
  let depoisDe: string | undefined;
  for (;;) {
    const lote = await prisma.aluno.findMany({
      where,
      orderBy: { id: "asc" },
      take: LOTE_CANDIDATOS_DUPLICIDADE,
      ...(depoisDe ? { cursor: { id: depoisDe }, skip: 1 } : {}),
      select: { id: true, paisId: true, primeiroNome: true, sobrenome: true, codigo: true, documento: true, email: true, telefoneE164: true, nascimento: true },
    });
    for (const a of lote) indice.registrar(chavesDeIdentidade(a), { tipo: "cadastro", nome: nomeCompleto(a), codigo: a.codigo });
    if (lote.length < LOTE_CANDIDATOS_DUPLICIDADE) return indice;
    depoisDe = lote[lote.length - 1].id;
  }
}
