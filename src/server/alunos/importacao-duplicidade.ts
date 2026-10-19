import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { nomeCompleto } from "@/lib/nome";

// Deduplicação da importação de alunos por planilha (docs/42 L224; docs/43 §6 item 9): a rota criava cada linha
// com `tx.aluno.create`, sem checagem — reenviar a mesma planilha recadastrava todos. Agora cada linha é comparada
// com os alunos já cadastrados E com as linhas anteriores da mesma planilha, e a repetida é IGNORADA (não criada),
// com o motivo devolvido ao operador.
//
// Chaves de identidade (qualquer uma que coincida basta), todas dentro do mesmo país (#180 C2):
//   1. documento: o mesmo número (comparado sem pontuação, espaço e caixa: "1-2345-6789" = "123456789");
//   2. nome completo + e-mail;
//   3. nome completo + telefone (E.164);
//   4. nome completo + data de nascimento.
// E-mail, telefone ou nascimento SOZINHOS não identificam: irmãos dividem o e-mail e o telefone do responsável.
// O nome é comparado sem acento, sem caixa e com os espaços normalizados.
//
// Sem migração: não há índice único no banco, então duas importações simultâneas ainda podem duplicar
// (pendência na PR: índice único sobre o documento normalizado). As chaves e o índice são puros, testáveis sem
// banco; só `carregarCadastradosParaDuplicidade` consulta.

export type CriterioDuplicidade = "documento" | "email" | "telefone" | "nascimento";

/** O que identifica a pessoa numa linha da planilha ou num aluno já cadastrado. */
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

/** Onde a identidade já apareceu: um aluno cadastrado ou uma linha anterior da mesma planilha. */
export type OrigemIdentidade = { tipo: "cadastro"; nome: string; codigo: string | null } | { tipo: "planilha"; linha: number };

/** Tamanho de cada lote da leitura dos candidatos no banco. Não é teto: os lotes seguem pelo id até acabar. */
export const LOTE_CANDIDATOS_DUPLICIDADE = 2000;

const RAZAO: Record<CriterioDuplicidade, string> = {
  documento: "mesmo documento no mesmo país",
  email: "mesmo nome e e-mail",
  telefone: "mesmo nome e telefone",
  nascimento: "mesmo nome e data de nascimento",
};

const semAcento = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "");

/** Nome completo comparável: sem acento, minúsculo, espaços normalizados. */
export const nomeComparavel = (primeiroNome: string, sobrenome: string | null) =>
  semAcento(`${primeiroNome} ${sobrenome ?? ""}`).toLowerCase().replace(/\s+/g, " ").trim();

/** Documento comparável: só letras e dígitos, em maiúsculas ("1-2345-6789" → "123456789"). */
export const documentoComparavel = (documento: string) => semAcento(documento).toUpperCase().replace(/[^A-Z0-9]/g, "");

/** Data civil da nascença (AAAA-MM-DD, em UTC: a planilha grava ao meio-dia local, a carga Q10 à meia-noite UTC). */
const dataCivil = (d: Date) => d.toISOString().slice(0, 10);

/** O dia civil da nascença como intervalo UTC [00:00, 00:00 do dia seguinte): o mesmo recorte de `dataCivil`. */
function diaUtc(civil: string): { gte: Date; lt: Date } {
  const inicio = new Date(`${civil}T00:00:00.000Z`);
  return { gte: inicio, lt: new Date(inicio.getTime() + 24 * 60 * 60 * 1000) };
}

/** As chaves de identidade de uma pessoa (vazias quando os campos faltam; documento curto demais não identifica). */
export function chavesDeIdentidade(p: IdentidadeAluno): ChaveIdentidade[] {
  const chaves: ChaveIdentidade[] = [];
  const doc = p.documento ? documentoComparavel(p.documento) : "";
  if (doc.length >= 4) chaves.push({ chave: `documento:${p.paisId}:${doc}`, criterio: "documento" });
  const nome = nomeComparavel(p.primeiroNome, p.sobrenome);
  if (!nome) return chaves;
  // O país entra em todas as chaves, como no documento: um homônimo com o mesmo e-mail em outro país não é a
  // mesma matrícula (#180 C2).
  const pessoa = `${p.paisId}:${nome}`;
  const email = p.email?.trim().toLowerCase();
  if (email) chaves.push({ chave: `email:${pessoa}:${email}`, criterio: "email" });
  if (p.telefoneE164) chaves.push({ chave: `telefone:${pessoa}:${p.telefoneE164}`, criterio: "telefone" });
  if (p.nascimento && !isNaN(p.nascimento.getTime())) chaves.push({ chave: `nascimento:${pessoa}:${dataCivil(p.nascimento)}`, criterio: "nascimento" });
  return chaves;
}

/** O motivo mostrado ao operador para a linha ignorada. */
export function motivoDuplicidade(origem: OrigemIdentidade, criterio: CriterioDuplicidade): string {
  return origem.tipo === "cadastro"
    ? `Já cadastrado como ${origem.nome}${origem.codigo ? ` (${origem.codigo})` : ""}: ${RAZAO[criterio]}. A linha não foi importada.`
    : `Repete a linha ${origem.linha} desta planilha: ${RAZAO[criterio]}. A linha não foi importada.`;
}

/** Índice das identidades já vistas: os alunos cadastrados e as linhas criadas nesta importação. */
export class IndiceDuplicidade {
  private readonly vistas = new Map<string, OrigemIdentidade>();

  /** Registra as chaves de uma origem; a primeira origem de cada chave vale. */
  registrar(chaves: readonly ChaveIdentidade[], origem: OrigemIdentidade): void {
    for (const { chave } of chaves) if (!this.vistas.has(chave)) this.vistas.set(chave, origem);
  }

  /** A primeira chave já vista (na ordem: documento, e-mail, telefone, nascimento), ou null. */
  procurar(chaves: readonly ChaveIdentidade[]): { origem: OrigemIdentidade; criterio: CriterioDuplicidade } | null {
    for (const { chave, criterio } of chaves) {
      const origem = this.vistas.get(chave);
      if (origem) return { origem, criterio };
    }
    return null;
  }
}

/**
 * Os alunos já cadastrados que podem repetir alguma linha, nos países da planilha: mesmo documento (como veio e sem
 * pontuação), mesmo e-mail (sem caixa), mesmo telefone ou nascidos no mesmo dia. A comparação fina (nome + campo) é
 * feita em memória pelas chaves. Sem candidato possível, não consulta.
 *
 * #180 C2: o candidato por nascimento vem pelo DIA, não pelo primeiro nome — o `mode: "insensitive"` do Postgres
 * diferencia acento, e "Jose" na planilha não achava "José" no cadastro. E a leitura não tem teto: segue em lotes
 * pelo id até o fim, porque um teto com `orderBy id` cortava justamente os cadastros mais novos.
 */
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
