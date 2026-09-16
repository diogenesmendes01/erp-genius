"use server";

import { createHash, randomUUID } from "node:crypto";
import { Papel, Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { conferirAutorCorrecaoReposicaoTx, conferirFonteCorrecaoReposicaoTx } from "./correcao-reposicao-tx";
import { revisarImpactosCorrecaoReposicaoTx } from "./revisao-correcao-reposicao-tx";
import { registrarCasosRevisaoProgressaoTx } from "@/server/avaliacoes/casos-revisao-progressao-tx";
import { ErroPermissao, ErroRegra, executarAcao, exigirSessaoComPapel, registrarEvento } from "@/server/_shared";

const texto = z.string().trim().min(5).max(4000);
const base = z.object({
  aulaOriginalId: z.string().min(1), matriculaId: z.string().min(1),
  modalidade: z.enum(["PARTICULAR", "GRAVACAO"]), motivo: texto, evidencia: texto,
  chaveIdempotencia: z.string().min(8).max(100),
}).strict();

const conclusao = z.object({
  reposicaoId: z.string().min(1), versaoAnterior: z.number().int().min(0),
  encontroReposicaoId: z.string().min(1).optional(), realizadaEm: z.string().datetime().optional(),
  entregaId: z.string().min(1).optional(), validadaEm: z.string().datetime().optional(), evidencia: texto,
}).strict();

type Reposicao = { id: string; aulaOriginalId: string; matriculaId: string; modalidade: "PARTICULAR" | "GRAVACAO"; solicitanteId: string };

const hash = (valor: unknown) => createHash("sha256").update(JSON.stringify(valor)).digest("hex");
const instanteUtc = (valor: Date) => Prisma.sql`${valor}::timestamptz AT TIME ZONE 'UTC'`;

async function reposicaoTx(tx: Prisma.TransactionClient, id: string) {
  const [r] = await tx.$queryRaw<Reposicao[]>(Prisma.sql`
    SELECT id, "aulaOriginalId", "matriculaId", modalidade::text AS modalidade, "solicitanteId"
    FROM "ReposicaoIndividual" WHERE id = ${id} FOR UPDATE
  `);
  if (!r) throw new ErroRegra("Reposição não encontrada.");
  return r;
}

/** A fonte da reposição é sempre a chamada original. A função do banco aplica
 * somente a última correção de AULA publicada e devolve a chamada bruta para
 * qualquer outro tipo de encontro. */
async function participacaoAulaOriginalEfetivaTx(tx: Prisma.TransactionClient, registroId: string) {
  const [registro] = await tx.$queryRaw<{ participacao: string | null }[]>(Prisma.sql`
    SELECT participacao_aula_efetiva(${registroId})::text AS participacao
  `);
  return registro?.participacao ?? null;
}

/** Q10/Q11: cria pedido ligado à ausência já classificada; não regulariza frequência. */
export async function solicitarReposicaoIndividual(input: z.input<typeof base>) {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(Papel.SECRETARIA_ACADEMICA, Papel.GERENTE_PEDAGOGICO);
    const d = base.parse(input), entradaHash = hash(d), id = randomUUID();
    return prisma.$transaction(async tx => {
      // Correções Q23 publicadas tomam este mesmo lock antes da matrícula.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended('calendario-escola', 0))`;
      await tx.$queryRaw`SELECT id FROM "Matricula" WHERE id = ${d.matriculaId} FOR UPDATE`;
      await tx.$queryRaw`SELECT id FROM "Usuario" WHERE id = ${autor.id} FOR SHARE`;
      const fresco = await tx.usuario.findUnique({ where: { id: autor.id }, select: { ativo: true, papeis: true } });
      if (!fresco?.ativo || !fresco.papeis.some(p => p === "SECRETARIA_ACADEMICA" || p === "GERENTE_PEDAGOGICO" || p === "ADMINISTRADOR")) throw new ErroPermissao();
      const existente = await tx.$queryRaw<{ id: string; entradaHash: string }[]>(Prisma.sql`
        SELECT id, "entradaHash" AS "entradaHash" FROM "ReposicaoIndividual"
        WHERE "solicitanteId" = ${autor.id} AND "chaveIdempotencia" = ${d.chaveIdempotencia}
      `);
      if (existente[0]) {
        if (existente[0].entradaHash !== entradaHash) throw new ErroRegra("Chave utilizada para outra solicitação.");
        return { id: existente[0].id };
      }
      // Q51 só abre nova tentativa depois de uma decisão rejeitada ou de uma
      // particular efetivamente consumida por falta. Pedido pendente,
      // autorizado, agendado ou concluído conserva a mesma origem/M.
      const [emAberto] = await tx.$queryRaw<{ id: string }[]>(Prisma.sql`
        SELECT anterior.id FROM "ReposicaoIndividual" anterior
        LEFT JOIN "DecisaoReposicaoIndividual" decisao ON decisao."reposicaoId"=anterior.id
        LEFT JOIN "AgendaReposicaoIndividual" agenda ON agenda."reposicaoId"=anterior.id
        LEFT JOIN "EncontroAgenda" encontro ON encontro.id=agenda."encontroId"
        LEFT JOIN "AulaDiario" diario ON diario."encontroId"=encontro.id
        LEFT JOIN "RegistroAulaAluno" tentativa ON tentativa."aulaId"=diario.id AND tentativa."matriculaId"=anterior."matriculaId"
        LEFT JOIN "ConclusaoReposicaoIndividual" conclusao ON conclusao."reposicaoId"=anterior.id
        WHERE anterior."matriculaId"=${d.matriculaId} AND anterior."aulaOriginalId"=${d.aulaOriginalId}
          AND (decisao.aprovada IS FALSE OR (agenda."statusBeneficio"='CONSUMIDA'::"StatusReservaBeneficioReposicao" AND tentativa.participacao='FALTA'::"ParticipacaoAula" AND conclusao.id IS NULL)) IS NOT TRUE
        LIMIT 1 FOR SHARE OF anterior
      `);
      if (emAberto) throw new ErroRegra("Esta falta já possui reposição pendente, autorizada, agendada ou concluída.");
      const original = await tx.encontroAgenda.findUnique({ where: { id: d.aulaOriginalId }, select: {
        id: true, finalidade: true, turmaId: true, fim: true, status: true,
        diario: { select: { registros: { where: { matriculaId: d.matriculaId }, select: { id: true, alunoId: true } } } },
      } });
      const matricula = await tx.matricula.findUnique({ where: { id: d.matriculaId }, select: { alunoId: true, status: true } });
      const registro = original?.diario?.registros.find(r => r.alunoId === matricula?.alunoId);
      if (!matricula || matricula.status !== "ATIVA") throw new ErroRegra("Novas reposições exigem matrícula ativa.");
      if (!original || original.finalidade !== "AULA" || !original.turmaId || original.status !== "MINISTRADO" || original.fim > new Date())
        throw new ErroRegra("A reposição exige aula original coletiva, ministrada e já encerrada.");
      const participacao = registro && await participacaoAulaOriginalEfetivaTx(tx, registro.id);
      if (!registro || !["FALTA", "IMPEDIDO_POR_RESTRICAO"].includes(participacao ?? ""))
        throw new ErroRegra("A reposição exige falta ou impedimento original já conferido na mesma matrícula.");
      await tx.$executeRaw(Prisma.sql`
        INSERT INTO "ReposicaoIndividual" (id, "aulaOriginalId", "matriculaId", modalidade, "solicitanteId", motivo, evidencia, "chaveIdempotencia", "entradaHash")
        VALUES (${id}, ${d.aulaOriginalId}, ${d.matriculaId}, ${d.modalidade}::"ModalidadeReposicaoIndividual", ${autor.id}, ${d.motivo}, ${d.evidencia}, ${d.chaveIdempotencia}, ${entradaHash})
      `);
      await registrarEvento(tx, { tipo: "ReposicaoIndividualSolicitada", agregadoTipo: "Matricula", agregadoId: d.matriculaId, autorId: autor.id,
        payload: { reposicaoId: id, aulaOriginalId: d.aulaOriginalId, modalidade: d.modalidade } });
      return { id };
    });
  });
}

/** Q11: só gestão decide e quem solicitou não aprova o próprio pedido. */
export async function decidirReposicaoIndividual(input: { reposicaoId: string; aprovar: boolean; motivo: string }) {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(Papel.GERENTE_PEDAGOGICO);
    const d = z.object({ reposicaoId: z.string().min(1), aprovar: z.boolean(), motivo: texto }).strict().parse(input);
    return prisma.$transaction(async tx => {
      // Mantém a ordem calendário -> reposição -> matrícula usada pelos guards.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended('calendario-escola', 0))`;
      const r = await reposicaoTx(tx, d.reposicaoId);
      await tx.$queryRaw`SELECT id FROM "Matricula" WHERE id = ${r.matriculaId} FOR UPDATE`;
      await tx.$queryRaw`SELECT id FROM "Usuario" WHERE id = ${autor.id} FOR SHARE`;
      const fresco = await tx.usuario.findUnique({ where: { id: autor.id }, select: { ativo: true, papeis: true } });
      const matricula = await tx.matricula.findUnique({ where: { id: r.matriculaId }, select: { alunoId: true, status: true } });
      const original = await tx.encontroAgenda.findUnique({ where: { id: r.aulaOriginalId }, select: { finalidade: true, turmaId: true, status: true,
        diario: { select: { registros: { where: { matriculaId: r.matriculaId }, select: { id: true, alunoId: true } } } } } });
      if (!fresco?.ativo || !fresco.papeis.some(p => p === "GERENTE_PEDAGOGICO" || p === "ADMINISTRADOR")) throw new ErroPermissao();
      if (!matricula || (d.aprovar && matricula.status !== "ATIVA") || !original || original.finalidade !== "AULA" || !original.turmaId
        || original.status !== "MINISTRADO")
        throw new ErroRegra("A aula original ou a matrícula mudou; confira a reposição antes de decidir.");
      const registro = original.diario?.registros.find(x => x.alunoId === matricula.alunoId);
      const participacao = registro && await participacaoAulaOriginalEfetivaTx(tx, registro.id);
      // A rejeição continua disponível para encerrar um pedido que se tornou
      // indevido depois de uma correção da chamada original.
      if (d.aprovar && !["FALTA", "IMPEDIDO_POR_RESTRICAO"].includes(participacao ?? ""))
        throw new ErroRegra("A falta original foi corrigida; a reposição não pode ser aprovada.");
      if (r.solicitanteId === autor.id) throw new ErroRegra("Outra pessoa deve decidir a reposição.");
      const atual = await tx.$queryRaw<{ id: string; decisorId: string; aprovada: boolean; motivo: string }[]>(Prisma.sql`
        SELECT id, "decisorId", aprovada, motivo FROM "DecisaoReposicaoIndividual" WHERE "reposicaoId" = ${r.id}
      `);
      if (atual[0]) {
        if (atual[0].decisorId === autor.id && atual[0].aprovada === d.aprovar && atual[0].motivo === d.motivo) return { id: atual[0].id, aprovada: atual[0].aprovada };
        throw new ErroRegra("A reposição já possui decisão.");
      }
      const id = randomUUID();
      await tx.$executeRaw(Prisma.sql`
        INSERT INTO "DecisaoReposicaoIndividual" (id, "reposicaoId", "decisorId", aprovada, motivo)
        VALUES (${id}, ${r.id}, ${autor.id}, ${d.aprovar}, ${d.motivo})
      `);
      await registrarEvento(tx, { tipo: "ReposicaoIndividualDecidida", agregadoTipo: "Matricula", agregadoId: r.matriculaId, autorId: autor.id,
        payload: { reposicaoId: r.id, decisaoId: id, aprovada: d.aprovar } });
      return { id, aprovada: d.aprovar };
    });
  });
}

/** Registra a única chamada permitida para o encontro acadêmico REPOSICAO. */
export async function registrarDiarioReposicaoIndividual(input: { reposicaoId: string; encontroReposicaoId: string; conteudo: string; participacao?: "PRESENTE" | "FALTA" }) {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(Papel.PROFESSOR);
    const d = z.object({ reposicaoId: z.string().min(1), encontroReposicaoId: z.string().min(1), conteudo: texto, participacao: z.enum(["PRESENTE", "FALTA"]).default("PRESENTE") }).strict().parse(input);
    return prisma.$transaction(async tx => {
      const r = await reposicaoTx(tx, d.reposicaoId);
      await tx.$queryRaw`SELECT id FROM "Matricula" WHERE id = ${r.matriculaId} FOR UPDATE`;
      const m = await tx.matricula.findUnique({ where: { id: r.matriculaId }, select: { alunoId: true, status: true } });
      const [decisao] = await tx.$queryRaw<{ aprovada: boolean }[]>(Prisma.sql`SELECT aprovada FROM "DecisaoReposicaoIndividual" WHERE "reposicaoId" = ${r.id}`);
      const [agenda] = await tx.$queryRaw<{ id: string }[]>(Prisma.sql`SELECT id FROM "AgendaReposicaoIndividual" WHERE "reposicaoId"=${r.id} AND "encontroId"=${d.encontroReposicaoId} FOR UPDATE`);
      const e = await tx.encontroAgenda.findUnique({ where: { id: d.encontroReposicaoId }, include: { diario: true } });
      if (!m || m.status !== "ATIVA" || !decisao?.aprovada) throw new ErroRegra("A reposição exige matrícula ativa e autorização aprovada.");
      if (!agenda || !e || String(e.finalidade) !== "REPOSICAO" || e.turmaId || e.matriculaId !== r.matriculaId || e.professorId !== autor.id || e.status !== "PREVISTO" || e.fim > new Date() || e.diario)
        throw new ErroRegra("O encontro não está disponível para registrar esta reposição.");
      const diario = await tx.aulaDiario.create({ data: { encontroId: e.id, professorId: autor.id, ocorridaEm: e.inicio, conteudo: d.conteudo,
        registros: { create: { alunoId: m.alunoId, matriculaId: r.matriculaId, nomeAluno: "Aluno", presente: d.participacao === "PRESENTE", participacao: d.participacao } } } });
      await tx.encontroAgenda.update({ where: { id: e.id }, data: { status: "MINISTRADO" } });
      await registrarEvento(tx, { tipo: "DiarioReposicaoIndividualRegistrado", agregadoTipo: "Matricula", agregadoId: r.matriculaId, autorId: autor.id,
        payload: { reposicaoId: r.id, encontroReposicaoId: e.id, diarioId: diario.id, participacao: d.participacao } });
      return { id: diario.id };
    });
  });
}

/** Q13: gravação só é confirmada pelo professor designado; particular exige seu encontro REPOSICAO. */
export async function concluirReposicaoIndividual(input: z.input<typeof conclusao>) {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(Papel.PROFESSOR);
    const d = conclusao.parse(input), agora = new Date();
    return prisma.$transaction(async tx => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended('calendario-escola', 0))`;
      const r = await reposicaoTx(tx, d.reposicaoId);
      await tx.$queryRaw`SELECT id FROM "Matricula" WHERE id = ${r.matriculaId} FOR UPDATE`;
      const matricula = await tx.matricula.findUnique({ where: { id: r.matriculaId }, select: { status: true } });
      if (!matricula) throw new ErroRegra("A matrícula da reposição não existe.");
      // Q36/Q52: pausa ou encerramento bloqueiam novas entregas, não a
      // avaliação docente de uma gravação que já foi registrada pelo aluno.
      // A particular continua exigindo matrícula ativa porque cria/usa um
      // encontro acadêmico individual, não uma fonte já entregue.
      if (r.modalidade === "PARTICULAR" && matricula.status !== "ATIVA") throw new ErroRegra("A conclusão particular exige matrícula ativa.");
      const [decisao] = await tx.$queryRaw<{ aprovada: boolean }[]>(Prisma.sql`SELECT aprovada FROM "DecisaoReposicaoIndividual" WHERE "reposicaoId" = ${r.id}`);
      if (!decisao?.aprovada) throw new ErroRegra("A reposição precisa de autorização aprovada antes da conclusão.");
      const [ultima] = await tx.$queryRaw<{ versao: number }[]>(Prisma.sql`SELECT versao FROM "ConclusaoReposicaoIndividual" WHERE "reposicaoId" = ${r.id} ORDER BY versao DESC LIMIT 1 FOR UPDATE`);
      if ((ultima?.versao ?? 0) !== d.versaoAnterior) throw new ErroRegra("A conclusão mudou. Confira a versão mais recente.");
      const vigente = await tx.conclusaoReposicaoIndividual.findFirst({ where: { reposicaoId: r.id }, orderBy: { versao: "desc" },
        select: { concluida: true, correcoes: { where: { decisao: { aprovada: true } }, orderBy: { versao: "desc" }, take: 1, select: { concluida: true } } },
      });
      if (vigente && (vigente.correcoes[0]?.concluida ?? vigente.concluida)) throw new ErroRegra("A reposição já está concluída. Alterações exigem proposta de correção e aprovação independente.");
      const id = randomUUID();
      if (r.modalidade === "PARTICULAR") {
        if (!d.encontroReposicaoId || d.entregaId || d.validadaEm) throw new ErroRegra("Particular concluída exige somente encontro próprio de reposição.");
        const encontro = await tx.encontroAgenda.findUnique({ where: { id: d.encontroReposicaoId }, select: { id: true, finalidade: true, matriculaId: true, status: true, fim: true, professorId: true,
          diario: { select: { registros: { where: { matriculaId: r.matriculaId }, select: { participacao: true } } } } } });
        const [agenda] = await tx.$queryRaw<{ id: string }[]>(Prisma.sql`SELECT id FROM "AgendaReposicaoIndividual" WHERE "reposicaoId"=${r.id} AND "encontroId"=${d.encontroReposicaoId} FOR SHARE`);
        if (!agenda || !encontro || String(encontro.finalidade) !== "REPOSICAO" || encontro.matriculaId !== r.matriculaId || encontro.status !== "MINISTRADO" || encontro.fim > agora || encontro.professorId !== autor.id || !encontro.diario?.registros.some(x => x.participacao === "PRESENTE"))
          throw new ErroRegra("A particular exige encontro de reposição ministrado, diário presente e autoria docente.");
        await tx.$executeRaw(Prisma.sql`
          INSERT INTO "ConclusaoReposicaoIndividual" (id, "reposicaoId", versao, concluida, "encontroReposicaoId", "realizadaEm", "concluidaPorId", evidencia)
          VALUES (${id}, ${r.id}, ${d.versaoAnterior + 1}, true, ${encontro.id}, ${instanteUtc(encontro.fim)}, ${autor.id}, ${d.evidencia})
        `);
      } else {
        if (d.encontroReposicaoId || !d.entregaId || !d.validadaEm) throw new ErroRegra("Gravação exige entrega do aluno e validação.");
        const validadaEm = new Date(d.validadaEm);
        if (validadaEm > agora) throw new ErroRegra("Data da validação é incompatível.");
        const [entrega] = await tx.$queryRaw<{ entregueEm: Date }[]>(Prisma.sql`
          SELECT "entregueEm" AS "entregueEm" FROM "EntregaReposicaoGravacao" e JOIN "Matricula" m ON m."alunoId" = e."alunoId"
          WHERE e.id = ${d.entregaId} AND e."reposicaoId" = ${r.id} AND m.id = ${r.matriculaId}
        `);
        if (!entrega || entrega.entregueEm > validadaEm) throw new ErroRegra("Entrega gravada não corresponde à matrícula ou é posterior à validação.");
        const designado = await tx.$queryRaw<{ id: string }[]>(Prisma.sql`
          SELECT d.id FROM "DesignacaoAvaliadorReposicaoIndividual" d JOIN "Usuario" u ON u.id = d."professorId"
          WHERE d."reposicaoId" = ${r.id} AND d."professorId" = ${autor.id} AND u.ativo = true
            AND d.inicio <= ${instanteUtc(validadaEm)} AND (d.fim IS NULL OR d.fim > ${instanteUtc(validadaEm)}) LIMIT 1
        `);
        if (!designado[0]) throw new ErroPermissao("Sem designação vigente para validar esta gravação.");
        await tx.$executeRaw(Prisma.sql`
          INSERT INTO "ConclusaoReposicaoIndividual" (id, "reposicaoId", versao, concluida, "entregaId", "validadaEm", "validadaPorId", "concluidaPorId", evidencia)
          VALUES (${id}, ${r.id}, ${d.versaoAnterior + 1}, true, ${d.entregaId}, ${instanteUtc(validadaEm)}, ${autor.id}, ${autor.id}, ${d.evidencia})
        `);
      }
      await registrarEvento(tx, { tipo: "ReposicaoIndividualConcluida", agregadoTipo: "Matricula", agregadoId: r.matriculaId, autorId: autor.id,
        payload: { reposicaoId: r.id, conclusaoId: id, modalidade: r.modalidade } });
      return { id, versao: d.versaoAnterior + 1 };
    });
  });
}

const correcao = conclusao.extend({ conclusaoId: z.string().min(1), concluida: z.boolean(), motivo: texto }).strict();

export async function proporCorrecaoConclusaoReposicao(input: z.input<typeof correcao>) {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(Papel.PROFESSOR, Papel.GERENTE_PEDAGOGICO);
    const d = correcao.parse(input), entradaHash = hash(d);
    return prisma.$transaction(async tx => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended('calendario-escola', 0))`;
      const anterior = await tx.conclusaoReposicaoIndividual.findUnique({ where: { id: d.conclusaoId } });
      if (!anterior || anterior.reposicaoId !== d.reposicaoId) throw new ErroRegra("A conclusão não pertence à reposição informada.");
      const r = await reposicaoTx(tx, anterior.reposicaoId);
      await conferirAutorCorrecaoReposicaoTx(tx, r.id, autor.id);
      const ultimaConclusao = await tx.conclusaoReposicaoIndividual.findFirst({ where: { reposicaoId: r.id }, orderBy: { versao: "desc" }, select: { id: true } });
      if (ultimaConclusao?.id !== anterior.id) throw new ErroRegra("Confira a conclusão mais recente da reposição.");
      const ultima = await tx.correcaoConclusaoReposicaoIndividual.findFirst({ where: { conclusaoId: anterior.id }, orderBy: { versao: "desc" } });
      if (ultima?.autorId === autor.id && ultima.entradaHash === entradaHash) return { id: ultima.id, versao: ultima.versao, propostaHash: ultima.entradaHash };
      if ((ultima?.versao ?? 0) !== d.versaoAnterior) throw new ErroRegra("A correção mudou. Confira a versão mais recente.");
      const fonte = { concluida: d.concluida, encontroReposicaoId: d.encontroReposicaoId,
        realizadaEm: d.realizadaEm ? new Date(d.realizadaEm) : null, entregaId: d.entregaId,
        validadaEm: d.validadaEm ? new Date(d.validadaEm) : null };
      const validada = await conferirFonteCorrecaoReposicaoTx(tx, r.id, fonte);
      const criada = await tx.correcaoConclusaoReposicaoIndividual.create({ data: {
        conclusaoId: anterior.id, autorId: autor.id, versao: d.versaoAnterior + 1, ...fonte, ...validada,
        evidencia: d.evidencia, motivo: d.motivo, entradaHash,
      } });
      await registrarEvento(tx, { tipo: "CorrecaoConclusaoReposicaoProposta", agregadoTipo: "Matricula", agregadoId: r.matriculaId, autorId: autor.id,
        payload: { reposicaoId: r.id, conclusaoId: anterior.id, correcaoId: criada.id, propostaHash: entradaHash } });
      return { id: criada.id, versao: criada.versao, propostaHash: entradaHash };
    });
  });
}

export async function decidirCorrecaoConclusaoReposicao(input: { correcaoId: string; propostaHash: string; impactosHash?: string; aprovar: boolean; motivo: string }) {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(Papel.GERENTE_PEDAGOGICO);
    const d = z.object({ correcaoId: z.string().min(1), propostaHash: z.string().regex(/^[a-f0-9]{64}$/), impactosHash: z.string().regex(/^[a-f0-9]{64}$/).optional(), aprovar: z.boolean(), motivo: texto }).strict().parse(input);
    return prisma.$transaction(async tx => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended('calendario-escola', 0))`;
      const c = await tx.correcaoConclusaoReposicaoIndividual.findUnique({ where: { id: d.correcaoId }, include: { conclusao: true, decisao: true } });
      if (!c) throw new ErroRegra("Correção de reposição não encontrada.");
      const r = await reposicaoTx(tx, c.conclusao.reposicaoId);
      await conferirAutorCorrecaoReposicaoTx(tx, r.id, autor.id, true);
      if (c.autorId === autor.id) throw new ErroRegra("Outra pessoa deve decidir a correção.");
      if (c.entradaHash !== d.propostaHash) throw new ErroRegra("Confira a versão exata da proposta antes de decidir.");
      if (c.decisao) {
        if (c.decisao.decisorId === autor.id && c.decisao.aprovada === d.aprovar && c.decisao.motivo === d.motivo) return { id: c.decisao.id, aprovada: c.decisao.aprovada };
        throw new ErroRegra("A correção já possui decisão.");
      }
      let revisao: Awaited<ReturnType<typeof revisarImpactosCorrecaoReposicaoTx>> | null = null;
      if (d.aprovar) {
        await conferirAutorCorrecaoReposicaoTx(tx, r.id, c.autorId);
        const ultima = await tx.correcaoConclusaoReposicaoIndividual.findFirst({ where: { conclusaoId: c.conclusaoId }, orderBy: { versao: "desc" }, select: { id: true } });
        const ultimaConclusao = await tx.conclusaoReposicaoIndividual.findFirst({ where: { reposicaoId: r.id }, orderBy: { versao: "desc" }, select: { id: true } });
        if (ultima?.id !== c.id || ultimaConclusao?.id !== c.conclusaoId) throw new ErroRegra("Há uma correção ou conclusão mais recente. Confira a versão atual.");
        await conferirFonteCorrecaoReposicaoTx(tx, r.id, c, c.validadaPorId);
        revisao = await revisarImpactosCorrecaoReposicaoTx(tx, c);
        if (!d.impactosHash || d.impactosHash !== revisao.impactosHash) throw new ErroRegra("As dependências acadêmicas precisam de nova conferência antes da aprovação.");
      }
      const decisao = await tx.decisaoCorrecaoConclusaoReposicao.create({ data: { correcaoId: c.id, decisorId: autor.id, aprovada: d.aprovar, motivo: d.motivo,
        ...(revisao ? { contextoAcademico: revisao.contexto } : {}),
      } });
      if (revisao) await registrarCasosRevisaoProgressaoTx(tx, {
        matriculaId: revisao.contexto.matriculaId, alocacaoFonteId: revisao.contexto.alocacaoFonteId,
        origem: { tipo: "REPOSICAO", decisaoId: decisao.id }, impactos: revisao.contexto.impactos,
      });
      await registrarEvento(tx, { tipo: "CorrecaoConclusaoReposicaoDecidida", agregadoTipo: "Matricula", agregadoId: r.matriculaId, autorId: autor.id,
        payload: { reposicaoId: r.id, correcaoId: c.id, decisaoId: decisao.id, aprovada: d.aprovar, propostaHash: c.entradaHash,
          ...(revisao ? { impactosHash: revisao.impactosHash, contextoAcademico: revisao.contexto } : {}) } });
      return { id: decisao.id, aprovada: d.aprovar };
    });
  });
}
