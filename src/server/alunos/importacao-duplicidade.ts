import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { nomeCompleto } from "@/lib/nome";

// Deduplicação da importação de alunos por planilha (docs/42 L224; docs/43 §6 item 9): a rota criava cada linha
// com `tx.aluno.create`, sem checagem — reenviar a mesma planilha recadastrava todos. Agora cada linha é comparada
// com os alunos já cadastrados E com as linhas anteriores da mesma planilha, e a repetida é IGNORADA (não criada),
// com o motivo devolvido ao operador.
//
// Chaves de identidade (qualquer uma que coincida basta):
//   1. documento: o mesmo número no mesmo país (comparado sem pontuação, espaço e caixa: "1-2345-6789" = "123456789");
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

/** Teto da leitura dos candidatos no banco (a planilha tem no máximo 1000 linhas). */
export const TETO_CANDIDATOS_DUPLICIDADE = 5000;

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

/** As chaves de identidade de uma pessoa (vazias quando os campos faltam; documento curto demais não identifica). */
export function chavesDeIdentidade(p: IdentidadeAluno): ChaveIdentidade[] {
  const chaves: ChaveIdentidade[] = [];
  const doc = p.documento ? documentoComparavel(p.documento) : "";
  if (doc.length >= 4) chaves.push({ chave: `documento:${p.paisId}:${doc}`, criterio: "documento" });
  const nome = nomeComparavel(p.primeiroNome, p.sobrenome);
  if (!nome) return chaves;
  const email = p.email?.trim().toLowerCase();
  if (email) chaves.push({ chave: `email:${nome}:${email}`, criterio: "email" });
  if (p.telefoneE164) chaves.push({ chave: `telefone:${nome}:${p.telefoneE164}`, criterio: "telefone" });
  if (p.nascimento && !isNaN(p.nascimento.getTime())) chaves.push({ chave: `nascimento:${nome}:${dataCivil(p.nascimento)}`, criterio: "nascimento" });
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
 * Os alunos já cadastrados que podem repetir alguma linha, num só `findMany` com teto: mesmo documento (como veio e
 * sem pontuação), mesmo e-mail (sem caixa), mesmo telefone ou mesmo primeiro nome com nascimento. A comparação fina
 * (nome + campo) é feita em memória pelas chaves. Sem candidato possível, não consulta.
 */
export async function carregarCadastradosParaDuplicidade(linhas: readonly IdentidadeAluno[]): Promise<IndiceDuplicidade> {
  const indice = new IndiceDuplicidade();
  const unicos = (xs: (string | null | undefined)[]) => [...new Set(xs.filter((x): x is string => !!x))];
  const documentos = unicos(linhas.flatMap((l) => (l.documento ? [l.documento.trim(), documentoComparavel(l.documento)] : [])));
  const emails = unicos(linhas.map((l) => l.email?.trim().toLowerCase()));
  const telefones = unicos(linhas.map((l) => l.telefoneE164));
  const primeirosNomes = unicos(linhas.filter((l) => l.nascimento).map((l) => l.primeiroNome.trim()));
  const ou: Prisma.AlunoWhereInput[] = [
    ...(documentos.length ? [{ documento: { in: documentos } }] : []),
    ...(emails.length ? [{ email: { in: emails, mode: "insensitive" as const } }] : []),
    ...(telefones.length ? [{ telefoneE164: { in: telefones } }] : []),
    ...(primeirosNomes.length ? [{ primeiroNome: { in: primeirosNomes, mode: "insensitive" as const }, nascimento: { not: null } }] : []),
  ];
  if (!ou.length) return indice;
  const cadastrados = await prisma.aluno.findMany({
    where: { OR: ou },
    orderBy: { id: "asc" },
    take: TETO_CANDIDATOS_DUPLICIDADE,
    select: { paisId: true, primeiroNome: true, sobrenome: true, codigo: true, documento: true, email: true, telefoneE164: true, nascimento: true },
  });
  for (const a of cadastrados) indice.registrar(chavesDeIdentidade(a), { tipo: "cadastro", nome: nomeCompleto(a), codigo: a.codigo });
  return indice;
}
