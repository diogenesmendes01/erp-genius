import { isDeepStrictEqual } from "node:util";
import { Prisma, type StatusCobranca } from "@prisma/client";
import { z } from "zod";
import { ErroRegra } from "@/server/_shared";
import { pagamentoConfirmado } from "@/server/financeiro/regras";
import { instanteDaGrade } from "@/server/agenda/grade";
import { planejarCobrancasEntrada } from "./plano-cobrancas-entrada";

const itemSchema = z.object({ id: z.string().min(1), tipo: z.enum(["MATRICULA", "MENSALIDADE", "HORA_PARTICULAR"]), etapa: z.enum(["CONFERENCIA_SECRETARIA", "ATIVACAO"]),
  valor: z.string(), moeda: z.string(), vencimento: z.string(), cobertura: z.object({ inicio: z.string(), fim: z.string(), dias: z.number() }).nullable(), minutos: z.number().nullable() });
type Cobranca = { id: string; tipo: string; moeda: string; valorNegociado: Prisma.Decimal.Value; vencimento: Date; coberturaInicio: Date | null; coberturaFim: Date | null;
  status: StatusCobranca; valorRecebido: Prisma.Decimal.Value | null; pagoEm: Date | null; versao: number };

/** Confere lastro e recebimentos; não confirma contrato, disponibilidade ou ativação. */
export function conferirPagamentosEntradaParticular(condicoes: unknown, memoria: unknown, cobrancas: Cobranca[], vinculadas: string[]) {
  const politica = z.object({ aulas: z.object({ regime: z.enum(["MENSALIDADE", "HORA_PARTICULAR"]) }), politicaEntrada: z.object({ adiantamentoHoraExigido: z.boolean().nullable() }) }).parse(condicoes);
  const plano = planejarCobrancasEntrada(condicoes), previstos = plano.filter(c => c.etapa === "CONFERENCIA_SECRETARIA");
  const memoriaValidada = z.object({ fusoInstitucional: z.string(), cobrancas: z.array(itemSchema) }).parse(memoria);
  const emitidos = memoriaValidada.cobrancas;
  if (emitidos.length !== previstos.length || new Set(emitidos.map(c => c.id)).size !== emitidos.length || vinculadas.length !== emitidos.length || cobrancas.length !== emitidos.length || new Set(vinculadas).size !== vinculadas.length) throw new ErroRegra("Concilie as cobranças iniciais e seus vínculos antes de ativar.");
  const itens = previstos.map(previsto => {
    const registros = emitidos.filter(c => c.tipo === previsto.tipo);
    if (registros.length !== 1) throw new ErroRegra("A emissão não corresponde às condições de entrada.");
    const { id, ...registrado } = registros[0];
    if (!isDeepStrictEqual(registrado, previsto) || !vinculadas.includes(id)) throw new ErroRegra("Confira a memória e o vínculo da emissão inicial.");
    const c = cobrancas.find(c => c.id === id);
    if (!c || c.tipo !== previsto.tipo || c.moeda !== previsto.moeda || !new Prisma.Decimal(c.valorNegociado).equals(previsto.valor) || c.vencimento.getTime() !== instanteDaGrade(previsto.vencimento, "12:00", memoriaValidada.fusoInstitucional).getTime()
      || (c.coberturaInicio?.toISOString() ?? null) !== (previsto.cobertura ? `${previsto.cobertura.inicio}T00:00:00.000Z` : null)
      || (c.coberturaFim?.toISOString() ?? null) !== (previsto.cobertura ? `${previsto.cobertura.fim}T00:00:00.000Z` : null)) throw new ErroRegra("A cobrança difere das condições conferidas. Regularize o ajuste antes de ativar.");
    const exigido = previsto.tipo !== "HORA_PARTICULAR" || politica.politicaEntrada.adiantamentoHoraExigido === true;
    const confirmada = pagamentoConfirmado(c);
    return { id, tipo: previsto.tipo, moeda: c.moeda, valor: new Prisma.Decimal(c.valorNegociado).toString(), versao: c.versao, exigido, confirmada, minutos: previsto.minutos,
      pendencia: c.status === "CANCELADA" ? "Cobrança cancelada: regularize a entrada." : exigido && !confirmada ? "Pagamento exigido ainda não confirmado integralmente." : null };
  });
  return { regime: politica.aulas.regime, pagamentosExigidosConfirmados: itens.every(i => !i.pendencia), itens,
    emitirNaAtivacao: plano.filter(c => c.etapa === "ATIVACAO") };
}
