"use server";
import { planejarCobrancasEntrada, type CobrancaEntradaPlanejada } from "@/server/matricula/plano-cobrancas-entrada";
import { createHash } from "node:crypto";
import { z } from "zod";
import { Papel } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { executarAcao, exigirSessaoComPapel, ErroRegra, ErroPermissao, registrarEvento } from "@/server/_shared";
import { periodoMensalNaData } from "@/server/matricula/cobertura";
import { exigirPrecoPreparacaoAutorizado } from "@/server/matricula/preco-autorizado";

import { Entrada } from "./condicoes-entrada-schema";

export async function registrarCondicoesEntrada(input: z.input<typeof Entrada>) {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(Papel.SECRETARIA_ACADEMICA), d = Entrada.parse(input);
    const hash = createHash("sha256").update(JSON.stringify(d)).digest("hex");
    return prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Matricula" WHERE id = ${d.matriculaId} FOR UPDATE`;
      const u = await tx.usuario.findUnique({ where: { id: autor.id }, select: { ativo: true, papeis: true } });
      if (!u?.ativo || !u.papeis.some((p) => p === Papel.SECRETARIA_ACADEMICA || p === Papel.ADMINISTRADOR)) throw new ErroPermissao();
      const repetida = await tx.condicoesEntradaPreparacao.findUnique({ where: { preparadorId_chaveIdempotencia: { preparadorId: autor.id, chaveIdempotencia: d.chaveIdempotencia } } });
      if (repetida) {
        if (repetida.entradaHash !== hash) throw new ErroRegra("Chave já utilizada para outras condições de entrada.");
        return { id: repetida.id, versao: repetida.versao };
      }
      const m = await tx.matricula.findUnique({ where: { id: d.matriculaId }, include: { preparacaoComercial: true,
        pagadoresPreparacao: { orderBy: { versao: "desc" }, take: 1 }, condicoesEntradaPreparacao: { orderBy: { versao: "desc" }, take: 1 }, _count: { select: { cobrancas: true } } } });
      if (!m?.preparacaoComercial || !m.secretariaAssumiuEm || !["RASCUNHO", "AGUARDANDO"].includes(m.status)) throw new ErroRegra("Assuma a matrícula em preparação antes de registrar condições de entrada.");
      if (m.contratoOk || m.confirmacaoContratoEm || m._count.cobrancas) throw new ErroRegra("Condições com cobrança ou aceite exigem revisão financeira/documental.");
      if (m.pagadoresPreparacao[0]?.id !== d.pagadorRegistroId) throw new ErroRegra("Confira a versão atual do pagador antes de registrar as condições.");
      if ((m.condicoesEntradaPreparacao[0]?.versao ?? 0) !== d.versaoEsperada) throw new ErroRegra("As condições mudaram. Atualize a consulta.");
      const p = m.preparacaoComercial;
      if (p.regime !== d.aulas.regime) throw new ErroRegra("O regime deve corresponder à preparação comercial.");
      await exigirPrecoPreparacaoAutorizado(tx, m.id);
      const memoria = z.object({ politicaEntrada: z.object({ taxaPreviaAssinatura: z.boolean(), exigirPrimeiraMensalidade: z.boolean().nullable().optional(), adiantamentoHoraExigido: z.boolean().nullable() }),
        adiantamentoProposto: z.object({ minutos: z.number().int().positive(), valor: z.string(), valorHora: z.string(), unidadeMinutos: z.literal(60), arredondamento: z.string() }).nullable().optional() }).safeParse(p.referencias);
      if (!memoria.success) throw new ErroRegra("Regras de entrada incompletas nesta preparação.");
      const regra = memoria.data.politicaEntrada, adiantamento = memoria.data.adiantamentoProposto ?? null;
      let cobertura = null;
      if (d.aulas.regime === "MENSALIDADE") {
        if (regra.exigirPrimeiraMensalidade == null) throw new ErroRegra("Confira a exigência da primeira mensalidade.");
        const c = d.aulas.cobertura;
        cobertura = periodoMensalNaData(c.referencia === "MES_CIVIL" ? { referencia: "MES_CIVIL" } : { referencia: "CICLO_MATRICULA", dataReferencia: c.inicio }, c.inicio);
      } else {
        if (regra.adiantamentoHoraExigido == null || (regra.adiantamentoHoraExigido && !adiantamento)) throw new ErroRegra("Confira a antecipação exigida pela oferta.");
        if (!!adiantamento !== !!d.aulas.vencimentoAdiantamento) throw new ErroRegra("Informe vencimento somente quando houver adiantamento proposto.");
      }
      const registro = await tx.condicoesEntradaPreparacao.create({ data: { matriculaId: m.id, preparadorId: autor.id, versao: d.versaoEsperada + 1, motivo: d.motivo, chaveIdempotencia: d.chaveIdempotencia, entradaHash: hash,
        dados: { preparacaoId: p.id, pagadorRegistroId: d.pagadorRegistroId, moeda: p.moeda, taxaProposta: p.taxaProposta.toString(), valorServicoProposto: p.valorServicoProposto.toString(), taxaVencimento: d.taxaVencimento,
          aulas: d.aulas, coberturaCalculada: cobertura, politicaEntrada: regra, adiantamentoProposto: adiantamento } } });
      await registrarEvento(tx, { tipo: "CondicoesEntradaRegistradas", agregadoTipo: "Matricula", agregadoId: m.id, autorId: autor.id, payload: { registroId: registro.id, versao: registro.versao, motivo: d.motivo } });
      return { id: registro.id, versao: registro.versao };
    });
  });
}

export async function consultarCondicoesEntrada(matriculaId: string) {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(Papel.SECRETARIA_ACADEMICA, Papel.FINANCEIRO);
    z.string().min(1).parse(matriculaId);
    return prisma.$transaction(async (tx) => {
      const m = await tx.matricula.findUnique({ where: { id: matriculaId }, select: { id: true, codigo: true, status: true, secretariaAssumiuEm: true, contratoOk: true, confirmacaoContratoEm: true,
        preparacaoComercial: { select: { regime: true, referencias: true } }, pagadoresPreparacao: { orderBy: { versao: "desc" }, take: 1, select: { id: true, versao: true } },
        condicoesEntradaPreparacao: { orderBy: { versao: "desc" }, take: 1, select: { id: true, versao: true, dados: true, motivo: true, preparador: { select: { nome: true } } } }, _count: { select: { cobrancas: true } } } });
      if (!m) throw new ErroRegra("Matrícula não encontrada.");
      const ultimo = m.condicoesEntradaPreparacao[0];
      const dados = ultimo ? Entrada.pick({ taxaVencimento: true, aulas: true }).extend({ pagadorRegistroId: z.string(), moeda: z.string(), taxaProposta: z.string(), valorServicoProposto: z.string(), coberturaCalculada: z.object({ inicio: z.string(), fim: z.string(), dias: z.number() }).nullable() }).strip().parse(ultimo.dados) : null;
      const proposta = m.preparacaoComercial ? z.object({ adiantamentoProposto: z.unknown().nullable().optional() }).parse(m.preparacaoComercial.referencias) : null;
      let impedimento = !autor.papeis.some((p) => p === Papel.SECRETARIA_ACADEMICA || p === Papel.ADMINISTRADOR) ? "Financeiro consulta; Secretaria registra as condições." : !m.preparacaoComercial || !m.secretariaAssumiuEm ? "Assuma uma matrícula com preparação comercial." : !["RASCUNHO", "AGUARDANDO"].includes(m.status) || m.contratoOk || m.confirmacaoContratoEm || m._count.cobrancas ? "Esta contratação exige revisão documental/financeira." : !m.pagadoresPreparacao.length ? "Registre primeiro o pagador desta matrícula." : null;
      if (!impedimento) try { await exigirPrecoPreparacaoAutorizado(tx, m.id); } catch (e) { if (!(e instanceof ErroRegra)) throw e; impedimento = e.message; }
      let previaCobrancas: CobrancaEntradaPlanejada[] = [], pendenciaPrevia: string | null = null;
      if (ultimo) try { previaCobrancas = planejarCobrancasEntrada(ultimo.dados); } catch (e) { if (!(e instanceof ErroRegra)) throw e; pendenciaPrevia = e.message; }
      return { previaCobrancas, pendenciaPrevia, matriculaId: m.id, codigo: m.codigo, regime: m.preparacaoComercial?.regime ?? null, temAdiantamento: !!proposta?.adiantamentoProposto,
        pagador: m.pagadoresPreparacao[0] ?? null, impedimento, podeEditar: !impedimento,
        registro: ultimo ? { id: ultimo.id, versao: ultimo.versao, motivo: ultimo.motivo, preparador: ultimo.preparador, dados: dados! } : null,
        pagadorAlterado: !!dados && dados.pagadorRegistroId !== m.pagadoresPreparacao[0]?.id };
    }, { isolationLevel: "RepeatableRead" });
  });
}
