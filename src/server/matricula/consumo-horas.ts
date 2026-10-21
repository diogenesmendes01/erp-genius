"use server";
import { Papel } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { exigirSessaoComPapel, executarAcao, ErroRegra, ErroPermissao, registrarEvento } from "@/server/_shared";
import { bloquearMatriculas } from "@/server/financeiro/recebimentos";
import { estadoDiario } from "@/server/diario/estado";

export async function conferirRealizacaoHoras(input: { reservaId: string; estadoDiario?: string; motivo?: string }) {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(Papel.FINANCEIRO);
    const d = z.object({ reservaId: z.string().min(1), estadoDiario: z.string().regex(/^[a-f0-9]{64}$/).optional(), motivo: z.string().trim().min(5).max(2000).optional() }).strict().parse(input);
    if (!!d.estadoDiario !== !!d.motivo) throw new ErroRegra("Confira o estado e informe o motivo para registrar consumo.");
    return prisma.$transaction(async tx => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended('calendario-escola', 0))`;
      const inicial = await tx.reservaHorasCompradas.findUnique({ where: { id: d.reservaId }, select: { compra: { select: { matriculaId: true } } } });
      if (!inicial) throw new ErroRegra("Reserva não encontrada.");
      await bloquearMatriculas(tx, [inicial.compra.matriculaId]);
      await tx.$queryRaw`SELECT id FROM "Usuario" WHERE id = ${autor.id} FOR SHARE`;
      const u = await tx.usuario.findUnique({ where: { id: autor.id }, select: { ativo: true, papeis: true } });
      if (!u?.ativo || !u.papeis.some(p => p === Papel.FINANCEIRO || p === Papel.ADMINISTRADOR)) throw new ErroPermissao();
      const r = await tx.reservaHorasCompradas.findUniqueOrThrow({ where: { id: d.reservaId }, include: { consumo: true, compra: { select: { matriculaId: true, matricula: { select: { alunoId: true } } } }, encontro: { include: { diario: { include: { registros: true } } } } } });
      if (r.consumo) {
        if (d.estadoDiario && (r.consumo.autorId !== autor.id || r.consumo.estadoDiario !== d.estadoDiario || r.consumo.motivo !== d.motivo)) throw new ErroRegra("Consumo já conferido por outra operação.");
        return { consumoId: r.consumo.id, estadoDiario: r.consumo.estadoDiario, minutos: r.minutos };
      }
      if (await tx.decisaoLiberacaoHoras.count({ where: { reservaId: r.id, aprovada: true } })) throw new ErroRegra("Reserva liberada não pode ser consumida.");
      const e = r.encontro, diario = e.diario;
      if (e.matriculaId !== r.compra.matriculaId || e.inicio.getTime() !== r.inicio.getTime() || e.fim.getTime() !== r.fim.getTime()) throw new ErroRegra("A agenda mudou. Confira o efeito na reserva antes do consumo.");
      if (!["PREVISTO", "MINISTRADO"].includes(e.status) || e.fim > new Date() || !diario || diario.professorId !== e.professorId || !diario.conteudo.trim() || diario.registros.length !== 1 || diario.registros[0].alunoId !== r.compra.matricula.alunoId || diario.registros[0].presente !== true) throw new ErroRegra("A realização precisa estar registrada com conteúdo e presença; falta e cancelamento seguem fluxo próprio.");
      const estado = estadoDiario(diario);
      if (!d.estadoDiario) return { consumoId: null, estadoDiario: estado, minutos: r.minutos };
      if (d.estadoDiario !== estado) throw new ErroRegra("O diário mudou. Confira a realização novamente.");
      const consumo = await tx.consumoHorasCompradas.create({ data: { reservaId: r.id, autorId: autor.id, estadoDiario: estado, motivo: d.motivo! } });
      await registrarEvento(tx, { tipo: "HorasCompradasConsumidas", agregadoTipo: "Matricula", agregadoId: r.compra.matriculaId, autorId: autor.id, payload: { consumoId: consumo.id, reservaId: r.id, minutos: r.minutos, diarioId: diario.id, estadoDiario: estado } });
      return { consumoId: consumo.id, estadoDiario: estado, minutos: r.minutos };
    });
  });
}
