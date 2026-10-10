import { Papel, type StatusMatricula } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { nomeCompleto } from "@/lib/nome";
import { executarAcao, exigirSessaoComPapel } from "@/server/_shared";
import { whereBuscaMatriculas } from "@/server/secretaria/busca-matriculas";

// /academico/reposicoes sem `?matriculaId=` era um beco (docs/42 L1244; docs/43 §6 item 7): só a frase "abra pelo
// contexto da matrícula". Esta busca dá a lista para escolher a matrícula — mesmos papéis da página, mesma regra
// de busca da Secretaria (código da matrícula ou nome do aluno), só leitura e com limite.

export const LIMITE_BUSCA_REPOSICAO = 20;
const Entrada = z.object({ busca: z.string().trim().min(2).max(100) }).strict();

export type MatriculaParaReposicao = { id: string; codigo: string | null; status: StatusMatricula; aluno: string; produto: string };

export async function buscarMatriculasParaReposicao(input: { busca: string }) {
  return executarAcao(async () => {
    await exigirSessaoComPapel(Papel.SECRETARIA_ACADEMICA, Papel.GERENTE_PEDAGOGICO, Papel.ADMINISTRADOR);
    const { busca } = Entrada.parse(input);
    const encontradas = await prisma.matricula.findMany({
      where: whereBuscaMatriculas(busca), orderBy: [{ criadoEm: "desc" }, { id: "desc" }], take: LIMITE_BUSCA_REPOSICAO + 1,
      select: { id: true, codigo: true, status: true, aluno: { select: { primeiroNome: true, sobrenome: true } }, produto: { select: { idioma: { select: { nome: true } }, modalidade: { select: { nome: true } } } } },
    });
    const itens: MatriculaParaReposicao[] = encontradas.slice(0, LIMITE_BUSCA_REPOSICAO).map((m) => ({
      id: m.id, codigo: m.codigo, status: m.status, aluno: nomeCompleto(m.aluno), produto: `${m.produto.idioma.nome} · ${m.produto.modalidade.nome}`,
    }));
    return { itens, maisResultados: encontradas.length > LIMITE_BUSCA_REPOSICAO };
  });
}
