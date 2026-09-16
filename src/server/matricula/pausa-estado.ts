import { Papel, Prisma } from "@prisma/client";
import { ErroPermissao, ErroRegra } from "@/server/_shared";
import { bloquearMatriculas } from "@/server/financeiro/recebimentos";
import { efeitoPausaNaCobertura } from "./cobertura";
import { recebimentoPreservavel } from "./recebimento-preservavel";
import type { PreviaPausaMatriculasInput } from "./pausa-schema";
import { carregarFusoInstitucionalTx } from "@/server/operacao/relogio";
export const PAPEIS_PAUSA: Papel[] = [Papel.SECRETARIA_ACADEMICA, Papel.FINANCEIRO, Papel.ADMINISTRADOR];
const PAPEIS = PAPEIS_PAUSA;
export async function carregarPreviaPausaTx(tx: Prisma.TransactionClient, alunoId: string, dados: PreviaPausaMatriculasInput, usuarioId: string) {
  const ids = [...dados.matriculaIds].sort();
  // Conferir pertença antes de carregar conteúdo ou travar contratos de outra pessoa.
  const encontrados = await tx.matricula.count({ where: { id: { in: ids }, alunoId } });
  if (encontrados !== ids.length) throw new ErroRegra("Seleção de matrículas inválida para este aluno.");
  await bloquearMatriculas(tx, ids);
  await tx.$queryRaw`SELECT id FROM "Cobranca" WHERE "matriculaId" IN (${Prisma.join(ids)}) ORDER BY id FOR UPDATE`;
  const atual = await tx.usuario.findUnique({ where: { id: usuarioId }, select: { ativo: true, papeis: true } });
  if (!atual?.ativo || !atual.papeis.some((p) => PAPEIS.includes(p))) throw new ErroPermissao("Acesso à prévia de pausa revogado.");
  const contratos = await tx.matricula.findMany({ where: { id: { in: ids }, alunoId }, orderBy: { id: "asc" }, select: {
    id: true, codigo: true, status: true, referenciaCobertura: true, dataReferenciaCobertura: true,
    alocacoes: { where: { ativa: true }, select: { id: true, turmaId: true }, orderBy: { id: "asc" } },
    cobrancas: { where: { tipo: "MENSALIDADE", status: { not: "CANCELADA" } }, orderBy: { id: "asc" }, select: {
      id: true, codigo: true, versao: true, coberturaInicio: true, coberturaFim: true, vencimento: true,
      valorRecebido: true, valorLiquidadoCredito: true, valorNegociado: true, saldo: true, status: true, informes: { where: { status: "A_CONFERIR" }, select: { id: true } },
    } },
  } });
  if (contratos.length !== ids.length) throw new ErroRegra("A titularidade mudou durante a conferência.");
  const legadoSemVinculo = await tx.alocacaoTurma.count({ where: { alunoId, ativa: true, matriculaId: null } });
  const fusoInstitucional = await carregarFusoInstitucionalTx(tx);
  return {
    alunoId, dataEfetiva: dados.dataEfetiva, fusoInstitucional, somentePrevia: true as const,
    matriculas: contratos.map((m) => {
      const pendencias: string[] = [];
      if (!fusoInstitucional) pendencias.push("FUSO_INSTITUCIONAL_A_CONFERIR");
      if (m.status !== "ATIVA") pendencias.push("MATRICULA_NAO_ATIVA");
      if (!m.referenciaCobertura) pendencias.push("REFERENCIA_CONTRATUAL_A_CONFERIR");
      if (legadoSemVinculo) pendencias.push("ALOCACAO_LEGADA_SEM_MATRICULA");
      const periodos = m.cobrancas.map((c) => {
        if (!c.coberturaInicio || !c.coberturaFim) {
          pendencias.push(`COBERTURA_A_CONFERIR:${c.id}`);
          return { cobrancaId: c.id, codigo: c.codigo, versao: c.versao, inicio: null, fim: null,
            vencimento: c.vencimento.toISOString(), efeito: "CONFERIR_COBERTURA" as const };
        }
        const inicio = c.coberturaInicio.toISOString().slice(0, 10), fim = c.coberturaFim.toISOString().slice(0, 10);
        const efeito = efeitoPausaNaCobertura({ inicio, fim }, dados.dataEfetiva);
        if (efeito === "SUSPENDER_PERIODO_FUTURO" && (c.informes.length > 0 || (!recebimentoPreservavel(c) && (c.valorRecebido?.greaterThan(0) || c.status === "PAGO"))))
          pendencias.push(`RECEBIMENTO_FUTURO_A_CONFERIR:${c.id}`);
        return { cobrancaId: c.id, codigo: c.codigo, versao: c.versao, inicio, fim, vencimento: c.vencimento.toISOString(), efeito };
      });
      const ordenados = periodos.filter((p) => p.inicio && p.fim).sort((a, b) => a.inicio!.localeCompare(b.inicio!));
      let maiorFim = "";
      for (const p of ordenados) {
        if (p.inicio! <= maiorFim) pendencias.push(`COBERTURA_SOBREPOSTA:${p.cobrancaId}`);
        if (p.fim! > maiorFim) maiorFim = p.fim!;
      }
      return { matriculaId: m.id, codigo: m.codigo, status: m.status, referenciaCobertura: m.referenciaCobertura,
        alocacoes: m.alocacoes, periodos, pendencias };
    }),
  };

}
