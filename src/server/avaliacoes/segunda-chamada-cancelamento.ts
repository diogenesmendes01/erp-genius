"use server";
import { createHash, randomUUID } from "node:crypto";
import { Papel, Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ErroRegra, executarAcao, exigirSessaoComPapel, registrarEvento } from "@/server/_shared";
import { bloquearLancamento } from "./lancamento-tx";
import { identificarMatriculaAvaliacao } from "./identificacao";
import { conferirGestorAvaliacao } from "./regras-tx";
import { instanteUtcSql } from "./segunda-chamada-utc";
const id = z.string().min(1).max(100), texto = z.string().trim().min(5).max(2000), evidencia = z.string().trim().min(5).max(4000), hash = (v: unknown) => createHash("sha256").update(JSON.stringify(v)).digest("hex");
const proposta = z.object({ reservaId: id, ocorridaEm: z.string().datetime({ offset: true }), motivo: texto, evidencia, origem: z.enum(["ESCOLA", "ALUNO"]).optional(), estadoConferido: z.string().regex(/^[a-f0-9]{64}$/), chaveIdempotencia: z.string().min(8).max(100) }).strict(), decisao = z.object({ propostaId: id, propostaHash: z.string().regex(/^[a-f0-9]{64}$/), aprovada: z.boolean(), motivo: texto }).strict(), consulta = z.object({ reservaId: id, beforeId: id.optional() }).strict();
type Reserva = {
    reservaId: string;
    matriculaId: string;
    alocacaoId: string;
    turmaId: string;
    status: string;
};
async function bloquear(tx: Prisma.TransactionClient, reservaId: string, u: string) {
    const [r] = await tx.$queryRaw<Reserva[]>(Prisma.sql `SELECT r.id AS "reservaId",r."matriculaId" AS "matriculaId",p."alocacaoId" AS "alocacaoId",p."turmaId" AS "turmaId",r.status::text AS status FROM "ReservaSegundaChamada" r JOIN "PropostaSegundaChamada" p ON p.id=r."propostaId" WHERE r.id=${reservaId} FOR UPDATE OF r`);
    if (!r)
        throw new ErroRegra("Reserva de segunda chamada não encontrada.");
    await bloquearLancamento(tx, r.alocacaoId);
    await conferirGestorAvaliacao(tx, u);
    return r;
}
type EstadoCancelamento = {
    encontro: {
        status: string;
    } | null;
    fatos: {
        realizacao: unknown | null;
    };
};
async function estado(tx: Prisma.TransactionClient, reservaId: string) {
    const [r] = await tx.$queryRaw<{
        estado: EstadoCancelamento;
    }[]>(Prisma.sql `SELECT estado_cancelamento_agenda_segunda_chamada(${reservaId}) AS estado`);
    if (!r?.estado)
        throw new ErroRegra("Estado da agenda de segunda chamada não encontrado.");
    return r.estado;
}
export async function proporCancelamentoAgendaSegundaChamada(input: z.input<typeof proposta>) {
    return executarAcao(async () => {
        const u = await exigirSessaoComPapel(Papel.GERENTE_PEDAGOGICO, Papel.ADMINISTRADOR), d = proposta.parse(input);
        return prisma.$transaction(async (tx) => {
            const r = await bloquear(tx, d.reservaId, u.id), entradaHash = hash(d);
            const [a] = await tx.$queryRaw<{
                id: string;
                entradaHash: string;
            }[]>(Prisma.sql `SELECT id,"entradaHash" AS "entradaHash" FROM "PropostaCancelamentoAgendaSegundaChamada" WHERE "autorId"=${u.id} AND "chaveIdempotencia"=${d.chaveIdempotencia} FOR SHARE`);
            if (a) {
                if (a.entradaHash !== entradaHash)
                    throw new ErroRegra("Chave utilizada com outra proposta de cancelamento.");
                return { id: a.id };
            }
            const atual = await estado(tx, d.reservaId);
            if (hash(atual) !== d.estadoConferido)
                throw new ErroRegra("A agenda mudou. Atualize a conferência antes de propor o cancelamento.");
            const propostaId = randomUUID();
            await tx.$executeRaw(Prisma.sql `INSERT INTO "PropostaCancelamentoAgendaSegundaChamada" (id,"reservaId","autorId",motivo,evidencia,origem,"ocorridaEm",snapshot,"chaveIdempotencia","entradaHash") VALUES (${propostaId},${d.reservaId},${u.id},${d.motivo},${d.evidencia},${d.origem ?? "ESCOLA"},${instanteUtcSql(new Date(d.ocorridaEm))},${JSON.stringify(atual)}::jsonb,${d.chaveIdempotencia},${entradaHash})`);
            await registrarEvento(tx, { tipo: "CancelamentoAgendaSegundaChamadaProposto", agregadoTipo: "Matricula", agregadoId: r.matriculaId, autorId: u.id, payload: { propostaId, reservaId: d.reservaId } });
            return { id: propostaId };
        });
    });
}
export async function decidirCancelamentoAgendaSegundaChamada(input: z.input<typeof decisao>) {
    return executarAcao(async () => {
        const u = await exigirSessaoComPapel(Papel.GERENTE_PEDAGOGICO, Papel.ADMINISTRADOR), d = decisao.parse(input);
        return prisma.$transaction(async (tx) => {
            const [ref] = await tx.$queryRaw<{
                reservaId: string;
            }[]>(Prisma.sql `SELECT "reservaId" AS "reservaId" FROM "PropostaCancelamentoAgendaSegundaChamada" WHERE id=${d.propostaId}`);
            if (!ref)
                throw new ErroRegra("Proposta de cancelamento não encontrada.");
            const r = await bloquear(tx, ref.reservaId, u.id);
            const [p] = await tx.$queryRaw<{
                id: string;
                reservaId: string;
                autorId: string;
                entradaHash: string;
            }[]>(Prisma.sql `SELECT id,"reservaId" AS "reservaId","autorId" AS "autorId","entradaHash" AS "entradaHash" FROM "PropostaCancelamentoAgendaSegundaChamada" WHERE id=${d.propostaId} FOR UPDATE`);
            if (!p)
                throw new ErroRegra("Proposta de cancelamento não encontrada.");
            if (p.autorId === u.id)
                throw new ErroRegra("Outra pessoa da gestão deve decidir o cancelamento.");
            if (p.entradaHash !== d.propostaHash)
                throw new ErroRegra("Confira a proposta exata antes de decidir.");
            const [x] = await tx.$queryRaw<{
                id: string;
                decisorId: string;
                aprovada: boolean;
                motivo: string;
            }[]>(Prisma.sql `SELECT id,"decisorId" AS "decisorId",aprovada,motivo FROM "DecisaoCancelamentoAgendaSegundaChamada" WHERE "propostaId"=${p.id} FOR SHARE`);
            if (x) {
                if (x.decisorId === u.id && x.aprovada === d.aprovada && x.motivo === d.motivo)
                    return { id: x.id };
                throw new ErroRegra("A proposta já possui decisão.");
            }
            const decisaoId = randomUUID();
            await tx.$executeRaw(Prisma.sql `INSERT INTO "DecisaoCancelamentoAgendaSegundaChamada" (id,"propostaId","decisorId",aprovada,motivo) VALUES (${decisaoId},${p.id},${u.id},${d.aprovada},${d.motivo})`);
            await registrarEvento(tx, { tipo: d.aprovada ? "CancelamentoAgendaSegundaChamadaAprovado" : "CancelamentoAgendaSegundaChamadaRejeitado", agregadoTipo: "Matricula", agregadoId: r.matriculaId, autorId: u.id, payload: { propostaId: p.id, decisaoId, reservaId: p.reservaId } });
            return { id: decisaoId };
        });
    });
}
export async function consultarCancelamentosAgendaSegundaChamada(input: z.input<typeof consulta>) {
    return executarAcao(async () => {
        const u = await exigirSessaoComPapel(Papel.GERENTE_PEDAGOGICO, Papel.ADMINISTRADOR), d = consulta.parse(input);
        return prisma.$transaction(async (tx) => {
            const r = await bloquear(tx, d.reservaId, u.id), atual = await estado(tx, d.reservaId);
            const [c] = d.beforeId ? await tx.$queryRaw<{
                id: string;
                criadaEm: Date;
            }[]>(Prisma.sql `SELECT id,"criadaEm" AS "criadaEm" FROM "PropostaCancelamentoAgendaSegundaChamada" WHERE id=${d.beforeId} AND "reservaId"=${d.reservaId} FOR SHARE`) : [];
            if (d.beforeId && !c)
                throw new ErroRegra("Cursor de cancelamentos não encontrado para esta reserva.");
            const ps = await tx.$queryRaw<{
                id: string;
                autorId: string;
                autorNome: string;
                motivo: string;
                evidencia: string;
                origem: "ESCOLA" | "ALUNO";
                ocorridaEm: Date;
                criadaEm: Date;
                entradaHash: string;
                snapshot: Prisma.JsonValue;
                decisaoId: string | null;
                aprovada: boolean | null;
                motivoDecisao: string | null;
                decisorNome: string | null;
            }[]>(Prisma.sql `SELECT p.id,p."autorId" AS "autorId",a.nome AS "autorNome",p.motivo,p.evidencia,p.origem::text AS origem,p."ocorridaEm" AS "ocorridaEm",p."criadaEm" AS "criadaEm",p."entradaHash" AS "entradaHash",p.snapshot,x.id AS "decisaoId",x.aprovada,x.motivo AS "motivoDecisao",de.nome AS "decisorNome" FROM "PropostaCancelamentoAgendaSegundaChamada" p JOIN "Usuario" a ON a.id=p."autorId" LEFT JOIN "DecisaoCancelamentoAgendaSegundaChamada" x ON x."propostaId"=p.id LEFT JOIN "Usuario" de ON de.id=x."decisorId" WHERE p."reservaId"=${d.reservaId} AND (${c?.criadaEm ?? null}::timestamptz IS NULL OR p."criadaEm"<${instanteUtcSql(c?.criadaEm ?? new Date(0))} OR (p."criadaEm"=${instanteUtcSql(c?.criadaEm ?? new Date(0))} AND p.id<${c?.id ?? ""})) ORDER BY p."criadaEm" DESC,p.id DESC LIMIT 21`);
            return { reservaId: d.reservaId, identificacao: await identificarMatriculaAvaliacao(tx, r.matriculaId, r.turmaId), atual, estadoConferido: hash(atual), podePropor: r.status === "RESERVADA" && atual.encontro?.status === "PREVISTO" && !atual.fatos.realizacao, propostas: ps.slice(0, 20).map(p => ({ id: p.id, autorNome: p.autorNome, motivo: p.motivo, evidencia: p.evidencia, origem: p.origem, ocorridaEm: p.ocorridaEm.toISOString(), criadaEm: p.criadaEm.toISOString(), entradaHash: p.entradaHash, snapshot: p.snapshot, decisao: p.decisaoId ? { aprovada: p.aprovada!, motivo: p.motivoDecisao ?? "", decisorNome: p.decisorNome ?? "" } : null, podeDecidir: !p.decisaoId && p.autorId !== u.id })), proximoId: ps.length > 20 ? ps[19].id : null };
        });
    });
}
