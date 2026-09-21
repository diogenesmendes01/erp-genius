"use server";
import { Papel } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { executarAcao, exigirSessaoComPapel, ErroRegra } from "@/server/_shared";
import { conferirAutor } from "./modelos-tx";
import { prepararSubstituicaoContratualTx, decidirSubstituicaoContratualTx } from "./substituicao-tx";
import { PrepararSubstituicaoContratualSchema, DecidirSubstituicaoContratualSchema } from "./substituicao-schema";
import { TextoPreviaSchema } from "./previa-projecao";
import { carregarAndamentoSubstituicao } from "./substituicao-andamento";

const alvo = z.object({ matriculaId: z.string().trim().min(1).max(100) }).strict();
const resumoAssinatura = z.object({
  participantes: z.array(z.object({ papel: z.string(), etapa: z.string(), nome: z.string(), email: z.string() })),
  regraTaxa: z.string(), taxa: z.object({ valor: z.string(), moeda: z.string(), status: z.string(), confirmada: z.boolean() }),
  reserva: z.object({ status: z.string(), expiraEm: z.string() }),
}).strip();
export async function prepararSubstituicaoContratual(input: z.input<typeof PrepararSubstituicaoContratualSchema>) {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(Papel.SECRETARIA_ACADEMICA);
    return prisma.$transaction(tx => prepararSubstituicaoContratualTx(tx, autor.id, input), { timeout: 20000 });
  });
}
export async function decidirSubstituicaoContratual(input: z.input<typeof DecidirSubstituicaoContratualSchema>) {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(Papel.ADMINISTRADOR);
    return prisma.$transaction(tx => decidirSubstituicaoContratualTx(tx, autor.id, input), { timeout: 20000 });
  });
}

export async function consultarSubstituicoesContratuais(input: { matriculaId: string; pagina?: number; paginaConferencias?: number }) {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(Papel.SECRETARIA_ACADEMICA);
    const d = alvo.extend({ pagina: z.number().int().min(1).max(100000).default(1), paginaConferencias: z.number().int().min(1).max(100000).default(1) }).strict().parse(input);
    return prisma.$transaction(async tx => {
      await conferirAutor(tx, autor.id);
      const matricula = await tx.matricula.findUnique({ where: { id: d.matriculaId }, select: { id: true, codigo: true, aluno: { select: { primeiroNome: true, sobrenome: true } } } });
      if (!matricula) throw new ErroRegra("Matrícula não encontrada.");
      const fonte = await tx.processoAssinaturaContratual.findFirst({ where: { matriculaId: d.matriculaId, estado: { not: "CANCELADO" } }, orderBy: [{ criadoEm: "desc" }, { id: "desc" }],
        select: { id: true, artefatoId: true, estado: true, conferencia: { select: { revisaoHash: true } }, conclusao: { select: { id: true } } } });
      const podePreparar = fonte?.estado === "ENVIADO" && !fonte.conclusao;
      const conferencias = fonte && podePreparar ? await tx.conferenciaAssinaturaContratual.findMany({ where: { artefato: { previa: { matriculaId: d.matriculaId } }, artefatoId: { not: fonte.artefatoId } },
        orderBy: [{ criadaEm: "desc" }, { id: "desc" }], skip: (d.paginaConferencias - 1) * 20, take: 21,
        select: { id: true, artefatoId: true, revisaoHash: true, motivo: true, criadaEm: true } }) : [];
      const propostas = await tx.propostaSubstituicaoContratual.findMany({ where: { matriculaId: d.matriculaId }, orderBy: [{ criadaEm: "desc" }, { id: "desc" }], skip: (d.pagina - 1) * 20, take: 21,
        select: { id: true, versao: true, motivo: true, criadaEm: true, preparadaPor: { select: { nome: true } }, decisao: { select: { aprovada: true, motivo: true, decididaEm: true, decisor: { select: { nome: true } } } } } });
      return { matricula: { id: matricula.id, codigo: matricula.codigo, aluno: [matricula.aluno.primeiroNome, matricula.aluno.sobrenome].filter(Boolean).join(" ") },
        fonte: fonte ? { id: fonte.id, artefatoId: fonte.artefatoId, revisaoHash: fonte.conferencia.revisaoHash, estado: fonte.estado, assinaturaConcluida: !!fonte.conclusao } : null,
        podePreparar, conferencias: conferencias.slice(0, 20), maisConferencias: conferencias.length > 20, paginaConferencias: d.paginaConferencias,
        propostas: propostas.slice(0, 20), maisPropostas: propostas.length > 20, pagina: d.pagina };
    });
  });
}

export async function consultarPropostaSubstituicao(input: { matriculaId: string; propostaId: string; paginaObservacoes?: number }) {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(Papel.SECRETARIA_ACADEMICA);
    const d = alvo.extend({ propostaId: z.string().trim().min(1).max(100), paginaObservacoes: z.number().int().min(1).max(100000).default(1) }).strict().parse(input);
    return prisma.$transaction(async tx => {
      await conferirAutor(tx, autor.id);
      const p = await tx.propostaSubstituicaoContratual.findFirst({ where: { id: d.propostaId, matriculaId: d.matriculaId }, select: {
        id: true, versao: true, processoFonteId: true, preparadaPorId: true, entradaHash: true, motivo: true, criadaEm: true,
        preparadaPor: { select: { nome: true } }, diferencas: true,
        artefatoFonte: { select: { id: true, previa: { select: { snapshot: true } } } },
        artefatoSubstituto: { select: { id: true, previa: { select: { snapshot: true } } } },
        decisao: { select: { aprovada: true, motivo: true, decididaEm: true, decisor: { select: { nome: true } } } },
      } });
      if (!p) throw new ErroRegra("Proposta indisponível nesta matrícula.");
      const maisNova = await tx.propostaSubstituicaoContratual.count({ where: { processoFonteId: p.processoFonteId, versao: { gt: p.versao } } });
      const ativo = await tx.usuario.findUniqueOrThrow({ where: { id: autor.id }, select: { papeis: true, ativo: true } });
      const revisoes = z.object({ fonte: z.object({ revisao: resumoAssinatura }), substituto: z.object({ revisao: resumoAssinatura }) }).parse(p.diferencas);
      const andamento = await carregarAndamentoSubstituicao(tx, { id: p.id, processoFonteId: p.processoFonteId, aprovada: p.decisao?.aprovada ?? null, superada: maisNova > 0 }, d.paginaObservacoes);
      return { id: p.id, versao: p.versao, propostaHash: p.entradaHash, motivo: p.motivo, criadaEm: p.criadaEm, preparadaPor: p.preparadaPor.nome,
        fonte: { artefatoId: p.artefatoFonte.id, texto: TextoPreviaSchema.parse(p.artefatoFonte.previa.snapshot), assinatura: revisoes.fonte.revisao },
        substituto: { artefatoId: p.artefatoSubstituto.id, texto: TextoPreviaSchema.parse(p.artefatoSubstituto.previa.snapshot), assinatura: revisoes.substituto.revisao },
        decisao: p.decisao, superada: maisNova > 0, andamento,
        podeDecidir: ativo.ativo && ativo.papeis.includes(Papel.ADMINISTRADOR) && autor.id !== p.preparadaPorId && !p.decisao };
    }, { isolationLevel: "RepeatableRead" });
  });
}
