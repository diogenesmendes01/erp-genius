"use server";

import { Papel, Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { executarAcao, exigirSessaoComPapel, ErroPermissao, ErroRegra, registrarEvento, type Resultado } from "@/server/_shared";
import { bloquearMatriculas } from "@/server/financeiro/recebimentos";
import { carregarConferenciaDesistenciaTx } from "./desistencia-conferencia-tx";

const id = z.string().trim().min(1).max(100);
const hash = z.string().regex(/^[a-f0-9]{64}$/);
const decidirSchema = z.object({
  pedidoId: id,
  estadoHash: hash,
  aprovada: z.boolean(),
  motivo: z.string().trim().min(5).max(3000),
}).strict();
const consultaSchema = z.object({ matriculaId: id }).strict();

async function exigirAdministradorAtualTx(tx: Prisma.TransactionClient, usuarioId: string) {
  await tx.$queryRaw`SELECT id FROM "Usuario" WHERE id = ${usuarioId} FOR SHARE`;
  const usuario = await tx.usuario.findUnique({ where: { id: usuarioId }, select: { ativo: true, papeis: true } });
  if (!usuario?.ativo || !usuario.papeis.includes(Papel.ADMINISTRADOR)) throw new ErroPermissao();
}

async function exigirLeitorAtualTx(tx: Prisma.TransactionClient, usuarioId: string) {
  await tx.$queryRaw`SELECT id FROM "Usuario" WHERE id = ${usuarioId} FOR SHARE`;
  const usuario = await tx.usuario.findUnique({ where: { id: usuarioId }, select: { ativo: true, papeis: true } });
  if (!usuario?.ativo || !usuario.papeis.some(p => p === Papel.SECRETARIA_ACADEMICA || p === Papel.ADMINISTRADOR)) throw new ErroPermissao();
  return usuario;
}

export type DecisaoAdministrativaDesistenciaView = {
  aprovada: boolean;
  motivo: string;
  decisorNome: string;
  dataISO: string;
};
export type PedidoDecisaoAdministrativaDesistenciaView = {
  id: string;
  versao: number;
  motivo: string;
  evidenciaPedido: string;
  registradorNome: string;
  estadoHash: string;
  atual: boolean;
  decisao: DecisaoAdministrativaDesistenciaView | null;
  podeDecidir: boolean;
  podeAprovar: boolean;
};
export type ConsultaDecisaoAdministrativaDesistencia = {
  matricula: { id: string; codigo: string | null };
  exigeAprovacaoAdministrativa: boolean;
  pendencias: string[];
  pedidos: PedidoDecisaoAdministrativaDesistenciaView[];
};

/** Consulta administrativa somente de leitura. Não expõe valores, saldos ou a
 * fotografia financeira que fundamenta a pendência. */
export async function consultarDecisaoAdministrativaDesistencia(input: { matriculaId: string }): Promise<Resultado<ConsultaDecisaoAdministrativaDesistencia>> {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(Papel.SECRETARIA_ACADEMICA, Papel.ADMINISTRADOR);
    const dados = consultaSchema.parse(input);
    return prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended('calendario-escola', 0))`;
      await bloquearMatriculas(tx, [dados.matriculaId]);
      const atual = await exigirLeitorAtualTx(tx, autor.id);
      const conferencia = await carregarConferenciaDesistenciaTx(tx, dados.matriculaId);
      const [pedidos, efetivacao] = await Promise.all([
        tx.pedidoDesistenciaPreparacao.findMany({
          where: { matriculaId: dados.matriculaId }, orderBy: [{ versao: "desc" }, { id: "desc" }], take: 20,
          select: { id: true, versao: true, motivo: true, evidenciaPedido: true, estadoHash: true, registradorId: true,
            registrador: { select: { nome: true } }, decisaoAdministrativa: { select: { aprovada: true, motivo: true, decididaEm: true, decisor: { select: { nome: true } } } } },
        }),
        tx.efetivacaoPedidoDesistenciaPreparacao.findUnique({ where: { matriculaId: dados.matriculaId }, select: { id: true } }),
      ]);
      const ultima = pedidos[0];
      const administrador = atual.papeis.includes(Papel.ADMINISTRADOR);
      return {
        matricula: { id: conferencia.resumo.matriculaId, codigo: conferencia.resumo.codigo },
        exigeAprovacaoAdministrativa: conferencia.resumo.exigeAprovacaoAdministrativa,
        pendencias: conferencia.resumo.pendencias,
        pedidos: pedidos.map(pedido => {
          const atualPedido = pedido.estadoHash === conferencia.estadoHash;
          const podeDecidir = administrador && !efetivacao && !pedido.decisaoAdministrativa && pedido.registradorId !== autor.id;
          return {
            id: pedido.id, versao: pedido.versao, motivo: pedido.motivo, evidenciaPedido: pedido.evidenciaPedido,
            registradorNome: pedido.registrador.nome, estadoHash: pedido.estadoHash, atual: atualPedido,
            decisao: pedido.decisaoAdministrativa ? { aprovada: pedido.decisaoAdministrativa.aprovada, motivo: pedido.decisaoAdministrativa.motivo,
              decisorNome: pedido.decisaoAdministrativa.decisor.nome, dataISO: pedido.decisaoAdministrativa.decididaEm.toISOString() } : null,
            podeDecidir,
            podeAprovar: podeDecidir && pedido.id === ultima?.id && conferencia.resumo.podeRegistrar && atualPedido &&
              conferencia.resumo.exigeAprovacaoAdministrativa,
          };
        }),
      };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted });
  });
}

/** Registra a decisão independente. Mesmo uma aprovação permanece deliberativa:
 * ela não efetiva desistência, não baixa recebimentos e não cancela assinatura. */
export async function decidirDesistenciaAdministrativa(input: z.input<typeof decidirSchema>): Promise<Resultado<{ id: string; aprovada: boolean; estadoHash: string }>> {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(Papel.ADMINISTRADOR);
    const dados = decidirSchema.parse(input);
    return prisma.$transaction(async (tx) => {
      // Ordem global: calendário, lead/matrícula, usuário e somente então o pedido.
      const referencia = await tx.pedidoDesistenciaPreparacao.findUnique({ where: { id: dados.pedidoId }, select: { matriculaId: true } });
      if (!referencia) throw new ErroRegra("Pedido de desistência não encontrado.");
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended('calendario-escola', 0))`;
      await bloquearMatriculas(tx, [referencia.matriculaId]);
      await exigirAdministradorAtualTx(tx, autor.id);
      await tx.$queryRaw`SELECT id FROM "PedidoDesistenciaPreparacao" WHERE id = ${dados.pedidoId} FOR UPDATE`;
      const pedido = await tx.pedidoDesistenciaPreparacao.findUnique({ where: { id: dados.pedidoId }, select: {
        id: true, matriculaId: true, registradorId: true, versao: true, estadoHash: true,
        decisaoAdministrativa: { select: { id: true, decisorId: true, aprovada: true, motivo: true, estadoHash: true } },
      } });
      if (!pedido) throw new ErroRegra("Pedido de desistência não encontrado.");
      const existente = pedido.decisaoAdministrativa;
      if (existente) {
        if (existente.decisorId === autor.id && existente.estadoHash === dados.estadoHash && existente.aprovada === dados.aprovada && existente.motivo === dados.motivo)
          return { id: existente.id, aprovada: existente.aprovada, estadoHash: existente.estadoHash };
        throw new ErroRegra("Este pedido já possui uma decisão administrativa imutável.");
      }
      if (pedido.registradorId === autor.id) throw new ErroPermissao("A decisão deve ser registrada por outra pessoa da Administração.");
      const efetivacao = await tx.efetivacaoPedidoDesistenciaPreparacao.findUnique({ where: { matriculaId: pedido.matriculaId }, select: { id: true } });
      if (efetivacao) throw new ErroRegra("A desistência já foi efetivada e não admite decisão administrativa.");
      // Rejeição documenta qualquer pedido histórico com o hash que ele tinha;
      // aprovação só vale para o último pedido ainda em preparação e conferido.
      if (dados.estadoHash !== pedido.estadoHash) throw new ErroRegra("O hash informado não corresponde ao pedido de desistência.");
      if (dados.aprovada) {
        const ultima = await tx.pedidoDesistenciaPreparacao.findFirst({ where: { matriculaId: pedido.matriculaId }, orderBy: [{ versao: "desc" }, { id: "desc" }], select: { id: true } });
        if (ultima?.id !== pedido.id) throw new ErroRegra("Aprovação exige o pedido mais recente.");
        const conferencia = await carregarConferenciaDesistenciaTx(tx, pedido.matriculaId);
        if (!conferencia.resumo.podeRegistrar) throw new ErroRegra("Esta matrícula não está em preparação para aprovação da desistência.");
        if (!conferencia.resumo.exigeAprovacaoAdministrativa) throw new ErroRegra("Este pedido não exige aprovação administrativa.");
        if (conferencia.estadoHash !== pedido.estadoHash || conferencia.estadoHash !== dados.estadoHash)
          throw new ErroRegra("A preparação mudou. Confira novamente antes de aprovar.");
      }
      const decisao = await tx.decisaoAdministrativaDesistencia.create({ data: {
        pedidoId: pedido.id, decisorId: autor.id, aprovada: dados.aprovada, motivo: dados.motivo, estadoHash: pedido.estadoHash,
      } });
      await registrarEvento(tx, { tipo: "DecisaoAdministrativaDesistenciaRegistrada", agregadoTipo: "Matricula", agregadoId: pedido.matriculaId,
        autorId: autor.id, payload: { pedidoId: pedido.id, decisaoId: decisao.id, aprovada: decisao.aprovada, estadoHash: decisao.estadoHash } });
      await tx.$executeRaw`SET CONSTRAINTS ALL IMMEDIATE`;
      return { id: decisao.id, aprovada: decisao.aprovada, estadoHash: decisao.estadoHash };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted });
  });
}
