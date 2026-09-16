"use server";
import { Papel, Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { executarAcao, exigirSessaoComPapel, ErroPermissao, ErroRegra } from "@/server/_shared";
import { AjustesReplanejamentoSchema } from "./replanejamento-ajustes";
import { carregarReplanejamentoTx } from "./replanejamento-tx";
import { estadoReplanejamento } from "./replanejamento-estado";
import { ReplanejamentoSnapshotSchema } from "./replanejamento-snapshot";

/** Consulta atual separada do histórico. Não autoriza nem aplica alterações. */
export async function conferirRevisaoParaDecisao(input: { calendarioId: string; revisaoId: string }) {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(Papel.SECRETARIA_ACADEMICA, Papel.GERENTE_PEDAGOGICO);
    const d = z.object({ calendarioId: z.string().min(1), revisaoId: z.string().min(1) }).strict().parse(input);
    return prisma.$transaction(async (tx) => {
      const u = await tx.usuario.findUnique({ where: { id: autor.id }, select: { ativo: true, papeis: true } });
      if (!u?.ativo || !u.papeis.some((p) => ["SECRETARIA_ACADEMICA", "GERENTE_PEDAGOGICO", "ADMINISTRADOR"].includes(p))) throw new ErroPermissao();
      const r = await tx.rascunhoReplanejamento.findFirst({ where: { id: d.revisaoId, calendarioId: d.calendarioId },
        include: { calendario: { include: { decisao: true } } } });
      if (!r) throw new ErroRegra("Revisão não encontrada neste calendário.");
      const motivos: string[] = [];
      const independente = autor.id !== r.preparadorId && autor.id !== r.calendario.preparadorId;
      const papelDecisor = u.papeis.some((p) => p === "GERENTE_PEDAGOGICO" || p === "ADMINISTRADOR");
      if (!papelDecisor) motivos.push("A decisão exige Gerência Pedagógica ou Administração.");
      if (!independente) motivos.push("Outra pessoa deve decidir: quem preparou o calendário ou a revisão não pode aprovar o conjunto.");
      const ultima = await tx.rascunhoReplanejamento.findFirst({ where: { calendarioId: d.calendarioId }, orderBy: { versao: "desc" }, select: { id: true } });
      if (ultima?.id !== r.id) motivos.push("Existe revisão mais recente deste calendário.");
      const snapshot = ReplanejamentoSnapshotSchema.safeParse(r.snapshot);
      const entrada = z.object({ ajustes: AjustesReplanejamentoSchema.default([]) }).safeParse(r.snapshot);
      let estadoCorresponde = false;
      if (!snapshot.success || !entrada.success || snapshot.data.calendarioId !== d.calendarioId) motivos.push("Conteúdo histórico incompleto; preparar nova revisão conferida.");
      else {
        try {
          const atual = await carregarReplanejamentoTx(tx, d.calendarioId, entrada.data.ajustes);
          estadoCorresponde = estadoReplanejamento(atual) === r.estadoHash;
          if (!estadoCorresponde) motivos.push("A agenda ou suas condições mudaram desde o registro; conferir e guardar nova revisão.");
          if (atual.recursos.internos.length || atual.recursos.externos.length) motivos.push("Resolver os conflitos de horário apontados na conferência atual.");
          if (atual.recursos.indisponibilidades.length) motivos.push("Há indisponibilidade docente nos horários propostos.");
          if (atual.recursos.semDocenteApto.length) motivos.push("Há encontro sem professor ativo e apto.");
          if (atual.revisoes.some((t) => !t.previsao)) motivos.push("Há turma sem proposta válida para integrar o conjunto.");
          if (atual.particulares.length) motivos.push("Conferir os encontros particulares e seus horários contratados.");
          if (!atual.recursos.reservasConferidas) motivos.push("A conferência das reservas comerciais ainda está pendente.");
        } catch (erro) {
          if (!(erro instanceof ErroRegra)) throw erro;
          motivos.push(erro.message);
        }
      }
      const excecoes = snapshot.success ? snapshot.data.revisoes.flatMap((t) => t.previsao?.propostas.filter((p) => p.periodosNaoLetivos?.length).map((p) => ({
        turmaId: t.turmaId, codigo: t.codigo, encontroId: p.encontroId, inicio: p.inicioProposto, fim: p.fimProposto,
        fusoOrigem: t.fusoOrigem, periodos: p.periodosNaoLetivos!, motivoProposto: p.motivoAjuste ?? null,
      })) ?? []) : [];
      if (excecoes.length) motivos.push("Exceções de dia não letivo precisam de autorização explícita para os encontros identificados.");
      return { conferidoEm: new Date().toISOString(), estadoCorresponde, independente, papelDecisor, motivos, excecoes,
        decisaoCalendario: r.calendario.decisao ? { aprovada: r.calendario.decisao.aprovada } : null,
        aplicada: false as const, aprovacaoDisponivel: false as const };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead, timeout: 20000 });
  });
}
