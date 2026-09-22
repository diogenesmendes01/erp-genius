"use server";
import { createHash } from "node:crypto";
import { Papel, Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { executarAcao, exigirSessaoComPapel, ErroRegra, registrarEvento } from "@/server/_shared";
import { conferirAutor } from "./modelos-tx";
import { hashSubstituicao } from "./substituicao-estado";

// Origem contratual histórica: contrato legado assinado fora do sistema. Secretaria/Administração transcreve as
// condições do PDF assinado; outro administrador confere o PDF e a transcrição (declarando os hashes que
// conferiu) e decide. Aprovada, é a fonte contratual de aditivos da matrícula — no lugar da conclusão assinada.
const id = z.string().trim().min(1).max(100);
const Decidir = z.object({ propostaId: id, aprovada: z.boolean(), motivo: z.string().trim().min(5).max(2000), pdfHashConferido: z.string().regex(/^[a-f0-9]{64}$/), transcricaoHashConferido: z.string().regex(/^[a-f0-9]{64}$/) }).strict();

export async function decidirOrigemContratualHistorica(input: z.input<typeof Decidir>) {
  return executarAcao(async () => {
    const ator = await exigirSessaoComPapel(Papel.ADMINISTRADOR), d = Decidir.parse(input);
    return prisma.$transaction(async tx => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended('calendario-escola', 0))`;
      const p = await tx.propostaOrigemContratualHistorica.findUnique({ where: { id: d.propostaId }, include: { decisao: true } });
      if (!p) throw new ErroRegra("Origem contratual histórica não encontrada.");
      await tx.$queryRaw`SELECT id FROM "Matricula" WHERE id = ${p.matriculaId} FOR UPDATE`;
      await tx.$queryRaw`SELECT id FROM "PropostaOrigemContratualHistorica" WHERE id = ${p.id} FOR UPDATE`;
      await conferirAutor(tx, ator.id, true);
      if (p.preparadorId === ator.id) throw new ErroRegra("Outra pessoa da Administração deve conferir esta origem.");
      if (p.decisao) {
        if (p.decisao.decisorId !== ator.id || p.decisao.aprovada !== d.aprovada || p.decisao.motivo !== d.motivo) throw new ErroRegra("A origem já recebeu outra decisão.");
        return { id: p.decisao.id, aprovada: p.decisao.aprovada };
      }
      // Conferência dupla: quem decide declara os hashes que conferiu no PDF e na transcrição; qualquer divergência recusa.
      if (d.pdfHashConferido !== p.pdfHash || d.transcricaoHashConferido !== p.transcricaoHash) throw new ErroRegra("Os hashes conferidos divergem da origem preservada. Reabra o PDF e a transcrição antes de decidir.");
      if (createHash("sha256").update(p.pdfAssinado).digest("hex") !== p.pdfHash || hashSubstituicao(p.transcricao as Prisma.JsonObject) !== p.transcricaoHash) throw new ErroRegra("A origem preservada exige conferência de integridade.");
      if (d.aprovada) {
        if (await tx.conclusaoAssinaturaContratual.count({ where: { processo: { matriculaId: p.matriculaId } } })) throw new ErroRegra("A matrícula já possui contrato assinado no sistema.");
        if (await tx.propostaOrigemContratualHistorica.count({ where: { matriculaId: p.matriculaId, decisao: { is: { aprovada: true } } } })) throw new ErroRegra("A matrícula já possui origem contratual histórica aprovada.");
      }
      const decisao = await tx.decisaoOrigemContratualHistorica.create({ data: { propostaId: p.id, decisorId: ator.id, aprovada: d.aprovada, motivo: d.motivo, pdfHashConferido: d.pdfHashConferido, transcricaoHashConferido: d.transcricaoHashConferido } });
      await registrarEvento(tx, { tipo: "OrigemContratualHistoricaDecidida", agregadoTipo: "Matricula", agregadoId: p.matriculaId, autorId: ator.id, payload: { origemId: p.id, decisaoId: decisao.id, aprovada: d.aprovada } });
      return { id: decisao.id, aprovada: decisao.aprovada };
    }, { timeout: 30000 });
  });
}

export async function consultarOrigemContratualHistorica(input: { matriculaId: string }) {
  return executarAcao(async () => {
    const ator = await exigirSessaoComPapel(Papel.SECRETARIA_ACADEMICA), d = z.object({ matriculaId: id }).strict().parse(input);
    return prisma.$transaction(async tx => {
      await conferirAutor(tx, ator.id);
      const usuario = await tx.usuario.findUniqueOrThrow({ where: { id: ator.id }, select: { ativo: true, papeis: true } });
      const [m, contratoAssinado, propostas] = await Promise.all([
        tx.matricula.findUnique({ where: { id: d.matriculaId }, select: { id: true, codigo: true, moeda: true, aluno: { select: { primeiroNome: true, sobrenome: true } }, preparacaoComercial: { select: { regime: true } } } }),
        tx.conclusaoAssinaturaContratual.count({ where: { processo: { matriculaId: d.matriculaId } } }),
        tx.propostaOrigemContratualHistorica.findMany({ where: { matriculaId: d.matriculaId }, orderBy: [{ criadaEm: "desc" }, { id: "desc" }], take: 20,
          select: { id: true, referencia: true, assinadoEm: true, pdfHash: true, transcricao: true, transcricaoHash: true, projecao: true, motivo: true, criadaEm: true, preparadorId: true, preparador: { select: { nome: true } },
            decisao: { select: { aprovada: true, motivo: true, decididaEm: true, decisor: { select: { nome: true } } } } } }),
      ]);
      if (!m) throw new ErroRegra("Matrícula não encontrada.");
      const aprovada = propostas.find(p => p.decisao?.aprovada), pendente = propostas.find(p => !p.decisao);
      return {
        matricula: { id: m.id, codigo: m.codigo, moeda: m.moeda, regime: m.preparacaoComercial?.regime === "MENSALIDADE" || m.preparacaoComercial?.regime === "HORA_PARTICULAR" ? m.preparacaoComercial.regime : null, aluno: [m.aluno.primeiroNome, m.aluno.sobrenome].filter(Boolean).join(" ") },
        podeRegistrar: !contratoAssinado && !aprovada && !pendente,
        impedimento: contratoAssinado ? "A matrícula já possui contrato assinado no sistema; a origem histórica não se aplica." : aprovada ? "Origem histórica aprovada." : pendente ? "Há origem histórica aguardando conferência." : null,
        propostas: propostas.map(p => ({ id: p.id, referencia: p.referencia, assinadoEm: p.assinadoEm.toISOString(), pdfHash: p.pdfHash, transcricaoHash: p.transcricaoHash, transcricao: p.transcricao, motivo: p.motivo, criadaEm: p.criadaEm.toISOString(),
          preparadaPor: p.preparador.nome, campos: z.object({ documento: z.object({ campos: z.array(z.object({ origem: z.string(), valor: z.string() })) }) }).parse(p.projecao).documento.campos,
          estado: p.decisao ? (p.decisao.aprovada ? "APROVADA" : "REJEITADA") : "PENDENTE",
          podeDecidir: !p.decisao && usuario.ativo && usuario.papeis.includes(Papel.ADMINISTRADOR) && p.preparadorId !== ator.id,
          decisao: p.decisao ? { aprovada: p.decisao.aprovada, motivo: p.decisao.motivo, decididaEm: p.decisao.decididaEm.toISOString(), decisor: p.decisao.decisor.nome } : null })),
      };
    }, { isolationLevel: "RepeatableRead" });
  });
}

