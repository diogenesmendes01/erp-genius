import { createHash } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { ErroRegra, registrarEvento } from "@/server/_shared";
import { HABILIDADES } from "./calculo";
import { bloquearLancamento } from "./lancamento-tx";
import { conferirGestorAvaliacao } from "./regras-tx";
import { carregarConsolidadoAvaliacoesTx } from "./consolidado-tx";
import { ConteudoRegraAvaliacaoSchema } from "./regra-schema";
import { prazoRecuperacaoVigente } from "./recuperacao-prazo";
import { quantidadeExtraRecuperacaoTx } from "./extra-recuperacao-tx";

export const ReservarTentativaRecuperacaoSchema = z.object({ propostaId: z.string().min(1).max(100), propostaHash: z.string().regex(/^[a-f0-9]{64}$/),
  habilidades: z.array(z.enum(HABILIDADES)).min(1).max(4), motivo: z.string().trim().min(5).max(2000), chaveIdempotencia: z.string().min(8).max(100),
  autorizacaoEspecialReservaId: z.string().min(1).max(100).optional(),
}).strict().superRefine((d, ctx) => { if (new Set(d.habilidades).size !== d.habilidades.length) ctx.addIssue({ code: "custom", message: "Habilidade repetida." }); });

export async function reservarTentativaRecuperacaoTx(tx: Prisma.TransactionClient, autorId: string, input: z.input<typeof ReservarTentativaRecuperacaoSchema>) {
  const original = ReservarTentativaRecuperacaoSchema.parse(input), d = { ...original, habilidades: [...original.habilidades].sort() };
  const entradaHash = createHash("sha256").update(JSON.stringify(d)).digest("hex");
  const ref = await tx.propostaPlanoRecuperacao.findUnique({ where: { id: d.propostaId }, select: { alocacaoId: true } });
  if (!ref) throw new ErroRegra("Plano não encontrado.");
  await bloquearLancamento(tx, ref.alocacaoId); await conferirGestorAvaliacao(tx, autorId);
  const repetida = await tx.reservaTentativaRecuperacao.findUnique({ where: { autorId_chaveIdempotencia: { autorId, chaveIdempotencia: d.chaveIdempotencia } } });
  if (repetida) {
    if (repetida.entradaHash !== entradaHash) throw new ErroRegra("Chave já utilizada com outra reserva.");
    return { id: repetida.id };
  }
  const p = await tx.propostaPlanoRecuperacao.findUniqueOrThrow({ where: { id: d.propostaId }, include: { disponibilizacao: true, decisao: true, regra: true, matricula: true, alocacao: { include: { turma: true } } } });
  if (p.entradaHash !== d.propostaHash || !p.decisao?.aprovada) throw new ErroRegra("Confira o plano aprovado e sua versão.");
  if (!p.disponibilizacao || new Date() >= await prazoRecuperacaoVigente(tx, p.disponibilizacao.id)) throw new ErroRegra("Registre a disponibilização do plano e confira o prazo vigente antes de reservar.");
  if (p.alocacao.matriculaId !== p.matriculaId || p.alocacao.turma.nivelId !== p.nivelId || p.alocacao.turma.regraAvaliacaoId !== p.regraId) throw new ErroRegra("O vínculo ou a situação da matrícula exige conferência.");
  if (d.autorizacaoEspecialReservaId) {
    const especial = await tx.autorizacaoEspecialReservaRecuperacao.findUnique({ where: { id: d.autorizacaoEspecialReservaId }, include: { autorizador: { select: { ativo: true, papeis: true } } } });
    const agora = new Date();
    if (!especial || especial.propostaId !== p.id || d.habilidades.length !== 1 || especial.habilidade !== d.habilidades[0] ||
      especial.criadaEm > agora || especial.prazoAte <= agora || !especial.autorizador.ativo ||
      !especial.autorizador.papeis.some(papel => papel === "GERENTE_PEDAGOGICO" || papel === "ADMINISTRADOR") ||
      !["PAUSADA", "ENCERRADA"].includes(p.matricula.status)) throw new ErroRegra("A autorização específica não permite esta reserva.");
    const fonte = { matriculaId: p.matriculaId, alocacaoId: p.alocacaoId, regraId: p.regraId, propostaId: p.id,
      propostaHash: p.entradaHash, decisaoId: p.decisao.id, disponibilizacaoId: p.disponibilizacao.id,
      habilidade: especial.habilidade, statusMatricula: p.matricula.status };
    if (!isDeepStrictEqual(especial.snapshot, fonte)) throw new ErroRegra("A fonte da autorização mudou. Solicite nova conferência.");
    if (await tx.reservaTentativaRecuperacao.findFirst({ where: { autorizacaoEspecialReservaId: especial.id }, select: { id: true } })) throw new ErroRegra("Esta autorização já foi utilizada por outra reserva.");
  } else if (!p.alocacao.ativa || p.matricula.status !== "ATIVA") throw new ErroRegra("O vínculo ou a situação da matrícula exige conferência.");
  const atual = await carregarConsolidadoAvaliacoesTx(tx, autorId, p.alocacaoId, "BASE_PLANO");
  if (!isDeepStrictEqual(p.snapshot, atual)) throw new ErroRegra("As notas mudaram desde a aprovação. Prepare novo plano.");
  const atividades = z.array(z.object({ habilidade: z.enum(HABILIDADES) })).parse(p.atividades);
  const regra = ConteudoRegraAvaliacaoSchema.parse(p.regra.conteudo);
  for (const habilidade of d.habilidades) {
    if (!atividades.some(a => a.habilidade === habilidade)) throw new ErroRegra("Habilidade não incluída no plano aprovado.");
    const ocupadas = await tx.itemReservaTentativaRecuperacao.count({ where: { habilidade, reserva: { proposta: { matriculaId: p.matriculaId, nivelId: p.nivelId } }, OR: [{ reserva: { cancelamento: null } }, { realizacao: { isNot: null } }] } });
    const limite = regra.habilidades.find(h => h.habilidade === habilidade)!.limiteRecuperacoes + await quantidadeExtraRecuperacaoTx(tx, p.matriculaId, p.nivelId, habilidade);
    if (ocupadas >= limite) throw new ErroRegra(`Limite de tentativas esgotado para ${habilidade}. Oportunidade extra exige autorização específica.`);
  }
  const reserva = await tx.reservaTentativaRecuperacao.create({ data: { propostaId: p.id, autorId, motivo: d.motivo, chaveIdempotencia: d.chaveIdempotencia, entradaHash,
    autorizacaoEspecialReservaId: d.autorizacaoEspecialReservaId,
    itens: { create: d.habilidades.map(habilidade => ({ habilidade })) } } });
  await registrarEvento(tx, { tipo: "TentativaRecuperacaoReservada", agregadoTipo: "Matricula", agregadoId: p.matriculaId, autorId,
    payload: { reservaId: reserva.id, propostaId: p.id, nivelId: p.nivelId, habilidades: d.habilidades } });
  return { id: reserva.id };
}
