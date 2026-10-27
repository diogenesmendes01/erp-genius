import { cache } from "react";
import { Papel } from "@prisma/client";
import { exigirPapelLeitura } from "@/lib/guards";
import { contarInformesAConferir, podeConfigurarComissoes } from "@/server/financeiro/consultas";
import { listarAprovacoesPendentes } from "@/server/ajustes/consultas";
import { listarPropostasRetomada } from "@/server/retomada/consultas";
import { abasVisiveis, type AbaFinanceiro, type PermissoesFinanceiro } from "./abas";
import type { AprovacaoRow } from "./FinanceiroPainel";
import { PAPEIS_FINANCEIRO } from "./papeis";

const memo: <F extends (...args: never[]) => unknown>(f: F) => F = typeof cache === "function" ? cache : (f) => f;

export type ContextoFinanceiro = { papeis: Papel[]; permissoes: PermissoesFinanceiro };

export const carregarContextoFinanceiro = memo(async (): Promise<ContextoFinanceiro | null> => {
  const papeis = await exigirPapelLeitura(...PAPEIS_FINANCEIRO);
  if (!papeis) return null;
  const tem = (p: Papel) => papeis.includes(p);
  return {
    papeis,
    permissoes: {
      podeOperarCobranca: tem(Papel.ADMINISTRADOR) || tem(Papel.FINANCEIRO),
      podeAprovar: tem(Papel.ADMINISTRADOR) || tem(Papel.GERENTE_COMERCIAL),
      podeGerenciarCambio: tem(Papel.ADMINISTRADOR) || tem(Papel.FINANCEIRO),
      podeConfigurarPoliticas: await podeConfigurarComissoes(),
    },
  };
});

export async function contextoDaAba(aba: AbaFinanceiro): Promise<ContextoFinanceiro | null> {
  const ctx = await carregarContextoFinanceiro();
  return ctx && abasVisiveis(ctx.permissoes).includes(aba) ? ctx : null;
}

export const carregarFilasPendentes = memo(async (p: PermissoesFinanceiro) => {
  const [informesAConferir, retomadas, aprovacoesRaw] = await Promise.all([
    p.podeOperarCobranca ? contarInformesAConferir() : Promise.resolve(0),
    p.podeOperarCobranca ? listarPropostasRetomada() : Promise.resolve({ ok: true as const, dado: [] }),
    p.podeAprovar ? listarAprovacoesPendentes() : Promise.resolve([]),
  ]);
  const aprovacoes: AprovacaoRow[] = aprovacoesRaw.map((a) => {
    const d = (a.payload ?? {}) as Record<string, unknown>;
    return {
      id: a.id,
      solicitante: a.solicitante.nome,
      tipo: a.tipo,
      motivo: a.motivo ?? "",
      vigencia: a.vigencia,
      impactoMensal: a.impactoMensal ?? 0,
      alunoNome: typeof d.alunoNome === "string" ? d.alunoNome : "—",
      valorDe: typeof d.valorDe === "number" ? d.valorDe : 0,
      valorPara: typeof d.valorPara === "number" ? d.valorPara : 0,
      descontoValor: typeof d.descontoValor === "number" ? d.descontoValor : 0,
      moeda: typeof d.moeda === "string" ? d.moeda : "",
    };
  });
  return {
    informesAConferir,
    retomadas: retomadas.ok ? retomadas.dado ?? [] : [],
    erroRetomadas: retomadas.ok ? null : retomadas.erro,
    aprovacoes,
  };
});
