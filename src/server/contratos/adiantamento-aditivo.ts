"use server";
import { randomUUID } from "node:crypto";
import { Papel, Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { executarAcao, exigirSessaoComPapel, ErroPermissao, ErroRegra, registrarEvento } from "@/server/_shared";
import { carregarEstadoConferenciaFinalAditivoTx } from "./aditivo-conferencia-final-estado";
import { consultarAlvoAdiantamentoTx } from "./aditivo-adiantamento";
import { carregarFusoInstitucionalTx } from "@/server/operacao/relogio";
import { instanteDaGrade } from "@/server/agenda/grade";

// Q172 — mesmo protocolo do vencimento da primeira mensalidade (225/228): Financeiro prepara,
// outro aprovador financeiro decide e aplica; o trigger do banco reconfere a fotografia e altera a cobrança.
const id = z.string().trim().min(1).max(100);
const motivo = z.string().trim().min(5).max(2000);
const chaveIdempotencia = z.string().trim().min(1).max(200);
const Preparar = z.object({ matriculaId: id, versaoCondicoesId: id, revisaoHash: z.string().regex(/^[a-f0-9]{64}$/), motivo, evidencia: z.string().trim().min(5).max(4000), chaveIdempotencia }).strict();
const Decidir = z.object({ propostaId: id, aprovada: z.boolean(), motivo, chaveIdempotencia }).strict();

async function autorFinanceiro(tx: Prisma.TransactionClient, autorId: string, aprovacao = false) {
  await tx.$queryRaw`SELECT id FROM "Usuario" WHERE id=${autorId} FOR SHARE`;
  const u = await tx.usuario.findUnique({ where: { id: autorId }, select: { ativo: true, papeis: true, permissoes: true } });
  if (!u?.ativo || !u.papeis.some(p => p === Papel.ADMINISTRADOR || p === Papel.FINANCEIRO)
    || (aprovacao && !u.papeis.includes(Papel.ADMINISTRADOR) && !u.permissoes.includes("financeiro.aprovar_acertos"))) throw new ErroPermissao();
  return u;
}
async function bloquear(tx: Prisma.TransactionClient, matriculaId: string) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended('calendario-escola',0))`;
  await tx.$queryRaw`SELECT id FROM "Matricula" WHERE id=${matriculaId} FOR UPDATE`;
}
async function conferirVersao(tx: Prisma.TransactionClient, matriculaId: string, versaoId: string, revisaoHash?: string) {
  const v = await tx.versaoCondicoesAditivo.findFirst({ where: { id: versaoId, matriculaId }, include: { conferenciaFinal: true } });
  if (!v) throw new ErroRegra("Versão contratual indisponível nesta matrícula.");
  const estado = await carregarEstadoConferenciaFinalAditivoTx(tx, { matriculaId, propostaId: v.propostaId, conclusaoId: v.conferenciaFinal.conclusaoId });
  if (estado.dados.ambiente !== "PRODUCAO" || estado.revisaoHash !== v.conferenciaFinal.revisaoHash
    || (revisaoHash !== undefined && revisaoHash !== estado.revisaoHash)) throw new ErroRegra("A assinatura e a conferência final precisam corresponder à revisão atual.");
  return v;
}

export async function proporAdiantamentoAditivo(input: unknown) {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(Papel.FINANCEIRO), d = Preparar.parse(input);
    return prisma.$transaction(async tx => {
      await bloquear(tx, d.matriculaId); await autorFinanceiro(tx, autor.id);
      const anterior = await tx.propostaAdiantamentoAditivo.findUnique({ where: { preparadorId_chaveIdempotencia: { preparadorId: autor.id, chaveIdempotencia: d.chaveIdempotencia } }, include: { versaoCondicoes: { select: { conferenciaFinal: { select: { revisaoHash: true } } } } } });
      if (anterior) {
        if (anterior.matriculaId !== d.matriculaId || anterior.versaoCondicoesId !== d.versaoCondicoesId || anterior.motivo !== d.motivo || anterior.evidencia !== d.evidencia || anterior.versaoCondicoes.conferenciaFinal.revisaoHash !== d.revisaoHash) throw new ErroRegra("A chave já corresponde a outra proposta.");
        return { id: anterior.id };
      }
      const v = await conferirVersao(tx, d.matriculaId, d.versaoCondicoesId, d.revisaoHash);
      const alvo = await consultarAlvoAdiantamentoTx(tx, d.matriculaId, v.condicoes);
      if (!alvo.cobranca || !alvo.podePreparar || alvo.cobranca.minutosAtuais === null) throw new ErroRegra(alvo.pendencia);
      await tx.$queryRaw`SELECT id FROM "Cobranca" WHERE id=${alvo.cobranca.id} FOR UPDATE`;
      const c = await tx.cobranca.findUniqueOrThrow({ where: { id: alvo.cobranca.id } });
      const fuso = await carregarFusoInstitucionalTx(tx);
      if (!fuso) throw new ErroRegra("Configure o fuso institucional antes do acerto.");
      const valorNovo = alvo.proposto.valor ? new Prisma.Decimal(alvo.proposto.valor.valor) : c.valorNegociado;
      const vencimentoNovo = alvo.proposto.vencimento ? instanteDaGrade(alvo.proposto.vencimento, "12:00", fuso) : c.vencimento;
      const minutosNovos = alvo.proposto.minutos ?? alvo.cobranca.minutosAtuais;
      if (valorNovo.equals(c.valorNegociado) && vencimentoNovo.getTime() === c.vencimento.getTime() && minutosNovos === alvo.cobranca.minutosAtuais) throw new ErroRegra("As condições formalizadas já correspondem ao adiantamento emitido.");
      const [foto] = await tx.$queryRaw<Array<{ fotografia: Prisma.JsonValue }>>`
        SELECT fotografia_adiantamento_aditivo_172(${v.id},${c.id},${fuso},${valorNovo}::numeric(12,2),(${vencimentoNovo}::timestamptz AT TIME ZONE 'UTC'),${minutosNovos}::integer) AS fotografia`;
      if (!foto?.fotografia) throw new ErroRegra("Fotografia do acerto indisponível.");
      // Fotografia e hash usam o mesmo JSONB no INSERT, sem nova conversão numérica pelo ORM.
      const [p] = await tx.$queryRaw<Array<{ id: string; fotografiaHash: string }>>`
        WITH foto AS (SELECT fotografia_adiantamento_aditivo_172(${v.id},${c.id},${fuso},${valorNovo}::numeric(12,2),(${vencimentoNovo}::timestamptz AT TIME ZONE 'UTC'),${minutosNovos}::integer) AS dados)
        INSERT INTO "PropostaAdiantamentoAditivo" (id,"matriculaId","propostaAditivoId","versaoCondicoesId","cobrancaId","preparadorId","versaoCobranca","valorAnterior","valorNovo","vencimentoAnterior","vencimentoNovo","minutosAnteriores","minutosNovos",fuso,fotografia,"fotografiaHash",motivo,evidencia,"chaveIdempotencia")
        SELECT ${randomUUID()},${d.matriculaId},${v.propostaId},${v.id},${c.id},${autor.id},${c.versao},${c.valorNegociado}::numeric(12,2),${valorNovo}::numeric(12,2),(${c.vencimento}::timestamptz AT TIME ZONE 'UTC'),(${vencimentoNovo}::timestamptz AT TIME ZONE 'UTC'),${alvo.cobranca.minutosAtuais}::integer,${minutosNovos}::integer,${fuso},foto.dados,encode(sha256(convert_to(foto.dados::text,'UTF8')),'hex'),${d.motivo},${d.evidencia},${d.chaveIdempotencia}
        FROM foto RETURNING id,"fotografiaHash"`;
      await registrarEvento(tx, { tipo: "AdiantamentoAditivoProposto", agregadoTipo: "Matricula", agregadoId: d.matriculaId, autorId: autor.id, payload: { propostaId: p.id, cobrancaId: c.id, fotografiaHash: p.fotografiaHash } });
      return { id: p.id };
    }, { timeout: 30000 });
  });
}

export async function decidirAdiantamentoAditivo(input: unknown) {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(Papel.FINANCEIRO), d = Decidir.parse(input);
    return prisma.$transaction(async tx => {
      const referencia = await tx.propostaAdiantamentoAditivo.findUniqueOrThrow({ where: { id: d.propostaId }, select: { matriculaId: true } });
      await bloquear(tx, referencia.matriculaId); await autorFinanceiro(tx, autor.id, true);
      const p = await tx.propostaAdiantamentoAditivo.findUniqueOrThrow({ where: { id: d.propostaId }, include: { decisao: true } });
      if (p.preparadorId === autor.id) throw new ErroRegra("A decisão exige outra pessoa.");
      if (p.decisao) {
        if (p.decisao.decisorId !== autor.id || p.decisao.aprovada !== d.aprovada || p.decisao.motivo !== d.motivo || p.decisao.chaveIdempotencia !== d.chaveIdempotencia) throw new ErroRegra("A proposta já recebeu outra decisão.");
        return { id: p.decisao.id, aprovada: p.decisao.aprovada };
      }
      if (d.aprovada) {
        const v = await conferirVersao(tx, p.matriculaId, p.versaoCondicoesId);
        const alvo = await consultarAlvoAdiantamentoTx(tx, p.matriculaId, v.condicoes);
        if (!alvo.podePreparar) throw new ErroRegra(alvo.pendencia);
      }
      const decisao = await tx.decisaoAdiantamentoAditivo.create({ data: { propostaId: p.id, decisorId: autor.id, aprovada: d.aprovada, motivo: d.motivo, fotografiaHash: p.fotografiaHash, chaveIdempotencia: d.chaveIdempotencia } });
      await registrarEvento(tx, { tipo: "AdiantamentoAditivoDecidido", agregadoTipo: "Matricula", agregadoId: p.matriculaId, autorId: autor.id, payload: { propostaId: p.id, decisaoId: decisao.id, aprovada: d.aprovada } });
      return { id: decisao.id, aprovada: decisao.aprovada };
    }, { timeout: 30000 });
  });
}

export async function aplicarAdiantamentoAditivo(input: unknown) {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(Papel.FINANCEIRO);
    const d = z.object({ propostaId: id, chaveIdempotencia }).strict().parse(input);
    return prisma.$transaction(async tx => {
      const referencia = await tx.propostaAdiantamentoAditivo.findUniqueOrThrow({ where: { id: d.propostaId }, select: { matriculaId: true } });
      await bloquear(tx, referencia.matriculaId); await autorFinanceiro(tx, autor.id, true);
      const p = await tx.propostaAdiantamentoAditivo.findUniqueOrThrow({ where: { id: d.propostaId }, include: { decisao: { include: { aplicacao: true } } } });
      if (!p.decisao?.aprovada || p.decisao.decisorId !== autor.id || p.preparadorId === autor.id) throw new ErroRegra("Aplicação exige o aprovador independente da proposta.");
      if (p.decisao.aplicacao) {
        if (p.decisao.aplicacao.executorId !== autor.id || p.decisao.aplicacao.chaveIdempotencia !== d.chaveIdempotencia) throw new ErroRegra("Aplicação já registrada com outra chave.");
        return { id: p.decisao.aplicacao.id, aplicada: true };
      }
      const versao = await conferirVersao(tx, p.matriculaId, p.versaoCondicoesId);
      if (versao.vigenciaInicio > new Date()) throw new ErroRegra("Aguarde a vigência aprovada antes de aplicar o adiantamento.");
      const alvo = await consultarAlvoAdiantamentoTx(tx, p.matriculaId, versao.condicoes);
      if (!alvo.podePreparar) throw new ErroRegra(alvo.pendencia);
      // A trigger reconfere a fotografia e altera a cobrança na mesma transação.
      const aplicacao = await tx.aplicacaoAdiantamentoAditivo.create({ data: {
        decisaoId: p.decisao.id, executorId: autor.id, chaveIdempotencia: d.chaveIdempotencia, fotografiaHash: p.fotografiaHash,
        versaoCobrancaAntes: p.versaoCobranca, versaoCobrancaDepois: p.versaoCobranca + 1, valorAnterior: p.valorAnterior, valorNovo: p.valorNovo,
        vencimentoAnterior: p.vencimentoAnterior, vencimentoNovo: p.vencimentoNovo, minutosAnteriores: p.minutosAnteriores, minutosNovos: p.minutosNovos,
      } });
      await registrarEvento(tx, { tipo: "AdiantamentoAditivoAplicado", agregadoTipo: "Matricula", agregadoId: p.matriculaId, autorId: autor.id,
        payload: { propostaId: p.id, aplicacaoId: aplicacao.id, cobrancaId: p.cobrancaId, fotografiaHash: p.fotografiaHash } });
      return { id: aplicacao.id, aplicada: true };
    }, { timeout: 30000 });
  });
}

/** Histórico financeiro restrito à matrícula e à versão solicitadas. */
export async function consultarAdiantamentosAditivo(input: unknown) {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(Papel.FINANCEIRO);
    const d = z.object({ matriculaId: id, versaoCondicoesId: id, pagina: z.number().int().min(1).max(10000).default(1) }).strict().parse(input);
    return prisma.$transaction(async tx => {
      const usuario = await autorFinanceiro(tx, autor.id);
      const versao = await tx.versaoCondicoesAditivo.findFirst({ where: { id: d.versaoCondicoesId, matriculaId: d.matriculaId },
        select: { id: true, versao: true, vigenciaInicio: true, condicoes: true, conferenciaFinal: { select: { revisaoHash: true } } } });
      if (!versao) throw new ErroRegra("Versão contratual indisponível nesta matrícula.");
      const aprova = usuario.papeis.includes(Papel.ADMINISTRADOR) || usuario.permissoes.includes("financeiro.aprovar_acertos");
      const linhas = await tx.propostaAdiantamentoAditivo.findMany({ where: { matriculaId: d.matriculaId, versaoCondicoesId: versao.id },
        orderBy: [{ criadaEm: "desc" }, { id: "desc" }], skip: (d.pagina - 1) * 50, take: 51, include: { decisao: { include: { aplicacao: true } } } });
      const alvo = await consultarAlvoAdiantamentoTx(tx, d.matriculaId, versao.condicoes);
      const emAndamento = linhas.some(p => !p.decisao || (p.decisao.aprovada && !p.decisao.aplicacao));
      return {
        matriculaId: d.matriculaId, versaoCondicoesId: versao.id, versao: versao.versao, vigenciaInicio: versao.vigenciaInicio.toISOString(), revisaoHash: versao.conferenciaFinal.revisaoHash,
        alvo: { ...alvo, cobranca: alvo.cobranca ? { ...alvo.cobranca, vencimentoAtual: alvo.cobranca.vencimentoAtual.toISOString() } : null, podePreparar: alvo.podePreparar && !emAndamento },
        pagina: d.pagina, temProxima: linhas.length > 50,
        propostas: linhas.slice(0, 50).map(p => ({
          id: p.id, cobrancaId: p.cobrancaId, versaoCobranca: p.versaoCobranca, fuso: p.fuso,
          valorAnterior: p.valorAnterior.toFixed(2), valorNovo: p.valorNovo.toFixed(2), vencimentoAnterior: p.vencimentoAnterior.toISOString(), vencimentoNovo: p.vencimentoNovo.toISOString(),
          minutosAnteriores: p.minutosAnteriores, minutosNovos: p.minutosNovos, motivo: p.motivo, evidencia: p.evidencia, criadaEm: p.criadaEm.toISOString(),
          estado: p.decisao?.aplicacao ? "APLICADA" : p.decisao ? (p.decisao.aprovada ? "APROVADA" : "REJEITADA") : "PENDENTE",
          podeDecidir: !p.decisao && aprova && p.preparadorId !== autor.id,
          podeSolicitarAplicacao: versao.vigenciaInicio <= new Date() && !!p.decisao?.aprovada && !p.decisao.aplicacao && aprova && p.decisao.decisorId === autor.id,
          decisao: p.decisao ? { aprovada: p.decisao.aprovada, motivo: p.decisao.motivo, decididaEm: p.decisao.decididaEm.toISOString() } : null,
          aplicadaEm: p.decisao?.aplicacao?.aplicadaEm.toISOString() ?? null,
        })),
      };
    });
  });
}
