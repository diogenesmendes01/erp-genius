import { z } from "zod";
import type { Prisma } from "@prisma/client";
import type { prisma } from "@/lib/prisma";

const Status = z.enum(["RASCUNHO", "PREVISTO", "MINISTRADO", "CANCELADO", "NAO_REALIZADO", "IMPEDIDO_ESCOLA"]);
const EncontroFoto = z.object({ id: z.string().min(1).nullable(), inicio: z.string().datetime(), fim: z.string().datetime(), status: Status, professorId: z.string().min(1).nullable(), propostaGradeId: z.string().min(1).nullable() }).passthrough();
const FotoImpacto = z.object({ agendaAntes: z.array(EncontroFoto), agendaDepois: z.array(EncontroFoto) }).passthrough();
const Payload = z.object({ propostaId: z.string().min(1), decisaoId: z.string().min(1), aplicacaoId: z.string().min(1), encontros: z.array(z.object({ turmaId: z.string().min(1), encontroId: z.string().min(1) }).strict()).max(10000) }).passthrough();
type Foto = z.infer<typeof EncontroFoto>;
type Alvo = { turmaId: string; id?: string; chave?: string; antes?: Foto; depois: Foto };
const igual = (a: Foto, b: Foto) => a.inicio === b.inicio && a.fim === b.fim && a.status === b.status;

/** Confere a materialização exata da fotografia aprovada; edição posterior torna o aviso obsoleto. */
export async function validarFonteQuantidadeAulasTx(db: Prisma.TransactionClient | typeof prisma, entrada: { eventoId: string; encontrosIds?: readonly string[] }) {
  const evento = await db.evento.findUnique({ where: { id: entrada.eventoId }, select: { tipo: true, agregadoTipo: true, agregadoId: true, autorId: true, payload: true } });
  const payload = Payload.safeParse(evento?.payload);
  if (!evento || evento.tipo !== "QuantidadeAulasModalidadeAplicada" || evento.agregadoTipo !== "Modalidade" || !payload.success) return null;
  const proposta = await db.propostaQuantidadeAulasModalidade.findUnique({ where: { id: payload.data.propostaId }, include: { decisao: true, aplicacao: true, impactos: { select: { turmaId: true, publicada: true, snapshot: true } } } });
  if (!proposta || proposta.modalidadeId !== evento.agregadoId || proposta.situacao !== "APLICADA" || !proposta.decisao?.aprovada || proposta.decisao.id !== payload.data.decisaoId || proposta.aplicacao?.id !== payload.data.aplicacaoId || proposta.decisao.decisorId === proposta.preparadorId || proposta.aplicacao.aplicadorId !== proposta.decisao.decisorId || evento.autorId !== proposta.aplicacao.aplicadorId) return null;

  const alvos: Alvo[] = [];
  for (const impacto of proposta.impactos) {
    const foto = FotoImpacto.safeParse(impacto.snapshot);
    if (!foto.success) return null;
    const antes = new Map<string, Foto>(), depois = new Map<string, Foto>();
    for (const item of foto.data.agendaAntes) if (item.id) { if (antes.has(item.id)) return null; antes.set(item.id, item); }
    for (const item of foto.data.agendaDepois) if (item.id) { if (depois.has(item.id)) return null; depois.set(item.id, item); }
    if (!impacto.publicada) continue;
    for (const [id, antesItem] of antes) {
      const depoisItem = depois.get(id);
      if (!depoisItem) return null; // o aplicador cancela encontro publicado, não o apaga
      if (!igual(antesItem, depoisItem)) alvos.push({ turmaId: impacto.turmaId, id, antes: antesItem, depois: depoisItem });
    }
    for (const id of depois.keys()) if (!antes.has(id)) return null;
    for (const [indice, depoisItem] of foto.data.agendaDepois.filter((item) => item.id === null).entries()) alvos.push({ turmaId: impacto.turmaId, chave: `quantidade:${proposta.id}:${impacto.turmaId}:${indice}`, depois: depoisItem });
  }
  const ids = new Set(alvos.flatMap((alvo) => alvo.id ? [alvo.id] : []));
  const chaves = new Set(alvos.flatMap((alvo) => alvo.chave ? [alvo.chave] : []));
  if (ids.size + chaves.size !== alvos.length) return null;
  const paresPayload = new Set<string>();
  for (const item of payload.data.encontros) { const par = `${item.turmaId}\u0000${item.encontroId}`; if (paresPayload.has(par)) return null; paresPayload.add(par); }
  if (entrada.encontrosIds && (!entrada.encontrosIds.length || new Set(entrada.encontrosIds).size !== entrada.encontrosIds.length || entrada.encontrosIds.some((id) => !payload.data.encontros.some((item) => item.encontroId === id)))) return null;
  const atuais = alvos.length ? await db.encontroAgenda.findMany({ where: { OR: [{ id: { in: [...ids] } }, { chaveIdempotencia: { in: [...chaves] }, preparadorId: proposta.preparadorId }] }, select: { id: true, turmaId: true, inicio: true, fim: true, status: true, professorId: true, propostaGradeId: true, preparadorId: true, chaveIdempotencia: true } }) : [];
  const porIdAtual = new Map(atuais.map((item) => [item.id, item])), porChaveAtual = new Map(atuais.map((item) => [item.chaveIdempotencia, item]));
  const resolvidos: { turmaId: string; encontroId: string; antes?: Foto; depois: Foto }[] = [];
  for (const alvo of alvos) {
    const atual = alvo.id ? porIdAtual.get(alvo.id) : porChaveAtual.get(alvo.chave!);
    if (!atual || atual.turmaId !== alvo.turmaId || atual.inicio.toISOString() !== alvo.depois.inicio || atual.fim.toISOString() !== alvo.depois.fim || atual.status !== alvo.depois.status || atual.professorId !== alvo.depois.professorId || atual.propostaGradeId !== alvo.depois.propostaGradeId || (alvo.chave && (atual.chaveIdempotencia !== alvo.chave || atual.preparadorId !== proposta.preparadorId))) return null;
    resolvidos.push({ turmaId: alvo.turmaId, encontroId: atual.id, antes: alvo.antes, depois: alvo.depois });
  }
  const paresEsperados = new Set(resolvidos.map((item) => `${item.turmaId}\u0000${item.encontroId}`));
  if (paresEsperados.size !== paresPayload.size || [...paresEsperados].some((par) => !paresPayload.has(par))) return null;
  const porTurma = new Map<string, Set<string>>(), instantes = new Map<string, Date[]>();
  for (const item of resolvidos) {
    const idsTurma = porTurma.get(item.turmaId) ?? new Set<string>(); idsTurma.add(item.encontroId); porTurma.set(item.turmaId, idsTurma);
    instantes.set(item.encontroId, [item.antes?.inicio, item.depois.inicio].filter((v): v is string => !!v).map((v) => new Date(v)));
  }
  return { proposta, encontros: payload.data.encontros, porTurma, instantes };
}
