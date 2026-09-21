import { Prisma } from "@prisma/client";
import { z } from "zod";
import { DataCivilSchema } from "./cobertura";
import { hashPausa } from "./pausa-integridade";
import { PreviaRetomadaMatriculasSchema } from "./retomada-schema";

const CoberturaSnapshotSchema = z.object({
  inicio: DataCivilSchema,
  fim: DataCivilSchema,
}).strict();

/* O snapshot contém outros dados da prévia. Esta leitura só aceita a parte que
 * comprova a cobertura, sem fazer do formato completo uma API da continuidade.
 */
const SnapshotRetomadaSchema = z.object({
  matriculas: z.array(z.object({
    matriculaId: z.string().trim().min(1),
    periodos: z.array(z.object({
      cobrancaId: z.string().trim().min(1),
      cobertura: CoberturaSnapshotSchema,
    }).passthrough()),
  }).passthrough()),
}).passthrough();

const EventoRetomadaSchema = z.object({
  propostaId: z.string().trim().min(1),
  periodos: z.array(z.object({
    cobrancaId: z.string().trim().min(1),
    cobertura: CoberturaSnapshotSchema,
  }).passthrough()),
}).passthrough();

export type ReferenciaRetomadaAplicada = Readonly<{
  propostaId: string;
  decisorId: string;
  decididoEm: string;
  aplicadaEm: string;
}>;

type Entrada = {
  matriculaId: string;
  cobrancaId: string;
  inicio: Date;
  fim: Date;
};

const dataCivil = (data: Date) => data.toISOString().slice(0, 10);

/**
 * Prova, a partir da persistência, que esta cobertura foi aplicada pela
 * retomada contratual Q66 com decisão independente. A chamada não recebe nem
 * aceita uma alegação de aprovação do consumidor.
 */
export async function carregarReferenciaRetomadaAplicadaTx(
  tx: Prisma.TransactionClient,
  input: Entrada,
): Promise<ReferenciaRetomadaAplicada | null> {
  if (!Number.isFinite(input.inicio.getTime()) || !Number.isFinite(input.fim.getTime()) || input.inicio > input.fim) return null;

  // Confere contra a cobrança, em vez de tratar as datas recebidas do chamador
  // como evidência de que a cobertura persiste.
  const cobranca = await tx.cobranca.findFirst({ where: {
    id: input.cobrancaId,
    matriculaId: input.matriculaId,
    tipo: "MENSALIDADE",
    coberturaInicio: input.inicio,
    coberturaFim: input.fim,
  }, select: { id: true } });
  if (!cobranca) return null;

  const [propostas, eventos] = await Promise.all([
    tx.itemPropostaRetomadaMatriculas.findMany({ where: {
    matriculaId: input.matriculaId,
    proposta: {
      status: "APLICADA",
      decisorId: { not: null },
      decididoEm: { not: null },
      aplicadaEm: { not: null },
    },
    }, select: { proposta: { select: {
      id: true,
      alunoId: true,
      solicitanteId: true,
      decisorId: true,
      decididoEm: true,
      aplicadaEm: true,
      motivo: true,
      entrada: true,
      entradaHash: true,
      snapshot: true,
      itens: { orderBy: { matriculaId: "asc" }, select: { matriculaId: true } },
    } } } }),
    tx.evento.findMany({ where: {
      agregadoTipo: "Matricula",
      agregadoId: input.matriculaId,
      tipo: "MatriculaRetomada",
    }, select: { autorId: true, payload: true } }),
  ]);

  const inicio = dataCivil(input.inicio);
  const fim = dataCivil(input.fim);
  const referencias: ReferenciaRetomadaAplicada[] = [];
  for (const { proposta } of propostas) {
    if (!proposta.decisorId || !proposta.decididoEm || !proposta.aplicadaEm || proposta.decisorId === proposta.solicitanteId) continue;
    const entrada = PreviaRetomadaMatriculasSchema.safeParse(proposta.entrada);
    if (!entrada.success || hashPausa({ alunoId: proposta.alunoId, entrada: entrada.data, motivo: proposta.motivo }) !== proposta.entradaHash) continue;
    const matriculasEntrada = entrada.data.matriculas.map((matricula) => matricula.matriculaId).sort();
    if (matriculasEntrada.length !== proposta.itens.length || matriculasEntrada.some((id, indice) => id !== proposta.itens[indice].matriculaId)) continue;
    const snapshot = SnapshotRetomadaSchema.safeParse(proposta.snapshot);
    if (!snapshot.success) continue;
    const periodos = snapshot.data.matriculas
      .filter((matricula) => matricula.matriculaId === input.matriculaId)
      .flatMap((matricula) => matricula.periodos)
      .filter((periodo) => periodo.cobrancaId === cobranca.id);
    if (periodos.length !== 1 || periodos[0].cobertura.inicio !== inicio || periodos[0].cobertura.fim !== fim) continue;
    const eventosAplicacao = eventos.filter((evento) => {
      if (!evento.autorId) return false;
      const payload = EventoRetomadaSchema.safeParse(evento.payload);
      if (!payload.success || payload.data.propostaId !== proposta.id) return false;
      const periodosEvento = payload.data.periodos.filter((periodo) => periodo.cobrancaId === cobranca.id);
      return periodosEvento.length === 1 && periodosEvento[0].cobertura.inicio === inicio && periodosEvento[0].cobertura.fim === fim;
    });
    if (eventosAplicacao.length !== 1) continue;
    referencias.push(Object.freeze({
      propostaId: proposta.id,
      decisorId: proposta.decisorId,
      decididoEm: proposta.decididoEm.toISOString(),
      aplicadaEm: proposta.aplicadaEm.toISOString(),
    }));
  }

  // Mais de uma origem para a mesma cobertura deixa a cadeia ambígua; quem
  // planeja deve pedir conferência em vez de escolher uma arbitrariamente.
  return referencias.length === 1 ? referencias[0] : null;
}
