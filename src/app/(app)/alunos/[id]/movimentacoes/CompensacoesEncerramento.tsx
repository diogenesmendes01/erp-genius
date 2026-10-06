import { z } from "zod";
import { formatarMoeda } from "@/lib/dinheiro";
import { formatarDataCivil } from "@/lib/data-civil";
import { EstadoVazio } from "@/components/EstadoVazio";
import { ESTADO_DIA_COMPENSACAO_LABEL, ESTADO_PROPOSTA_DECIDIDA_LABEL, rotular } from "@/lib/labels";

export const CompensacoesEncerramentoSchema = z.array(z.object({
  id: z.string(), status: z.enum(["PENDENTE", "APROVADA", "REJEITADA"]),
  cobrancaOrigemId: z.string(), documentoOrigemId: z.string().nullable(),
  coberturaOriginalInicio: z.string(), coberturaOriginalFim: z.string(),
  valorCoberturaOriginal: z.string(), moeda: z.string(), motivo: z.string(), evidenciaCondicoes: z.string(),
  dias: z.array(z.object({
    id: z.string(), diaOrigem: z.string(), estado: z.enum(["PENDENTE", "RECOMPOSTO", "LIQUIDADO_FINANCEIRAMENTE"]),
    versao: z.number(), destinacaoReferencia: z.string().nullable(), destinadoEm: z.string().nullable(),
    programacao: z.object({ id: z.string(), aplicacaoId: z.string(), dataCobertura: z.string() }).optional(),
  })),
}));

export function CompensacoesEncerramento({ compensacoes }: { compensacoes: z.infer<typeof CompensacoesEncerramentoSchema> }) {
  if (!compensacoes.length) return <EstadoVazio>Nenhuma compensação registrada nesta consulta.</EstadoVazio>;
  return <div className="space-y-2 rounded border p-3">
    <h4 className="font-medium">Compensações de cobertura</h4>
    <p>Os valores de compensação ainda precisam compor o acerto completo; não estão incluídos no total mensal apresentado.</p>
    {compensacoes.map((comp) => <details key={comp.id}>
      <summary>{rotular(ESTADO_PROPOSTA_DECIDIDA_LABEL, comp.status)} · origem {comp.coberturaOriginalInicio} a {comp.coberturaOriginalFim}{comp.status === "APROVADA" ? ` · ${comp.dias.filter((d) => d.estado === "PENDENTE").length} dias ainda devidos` : " · sem concessão de dias"}</summary>
      <p>Cobrança de origem: {comp.cobrancaOrigemId}. Documento: {comp.documentoOrigemId ?? "não registrado"}.</p>
      <p>Valor da cobertura original: {formatarMoeda(comp.valorCoberturaOriginal, comp.moeda)}. {comp.motivo}</p>
      <p>Condições: {comp.evidenciaCondicoes}</p>
      {comp.dias.length > 0 && <ul>{comp.dias.map((dia) => <li key={dia.id}>
        {dia.diaOrigem}: {rotular(ESTADO_DIA_COMPENSACAO_LABEL, dia.estado)} · versão {dia.versao}
        {dia.destinacaoReferencia ? ` · referência ${dia.destinacaoReferencia}` : ""}
        {dia.destinadoEm ? ` · registrado em ${dia.destinadoEm}` : ""}
        {dia.programacao && <span> · cobertura programada para {formatarDataCivil(dia.programacao.dataCobertura)}{dia.estado === "PENDENTE" ? " (cumprimento ainda não confirmado)" : ""}</span>}
      </li>)}</ul>}
    </details>)}
  </div>;
}
