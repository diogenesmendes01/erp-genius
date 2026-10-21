"use client";

import type { MotivoPausaAtendimentoIA } from "@prisma/client";
import { Botao } from "@/components/Botao";
import { FeedbackAcao } from "@/components/FeedbackAcao";
import { useAcaoCliente } from "@/lib/acao-cliente";
import { ACAO_AGENTE_IA_LABEL, MOTIVO_PAUSA_IA_LABEL } from "@/lib/labels";
import { aprovarAcaoAria, devolverParaAria, rejeitarAcaoAria } from "@/server/aria/acoes";
import type { AriaDoAtendimento } from "@/server/whatsapp/consultas-inbox";
import { formatarInstanteExibicao } from "@/server/operacao/fuso-exibicao";

export function textoPausaAria(motivo: MotivoPausaAtendimentoIA | null): string {
  return motivo ? `Aria pausada · ${MOTIVO_PAUSA_IA_LABEL[motivo]}` : "Aria pausada";
}

/** Bloco "Aria" do painel do atendimento: pausa com "Devolver para Aria" (só com escopo de envio) e sugestões a aprovar ou rejeitar. */
export function PainelAria({ atendimentoId, aria, fuso, aoMudar }: { atendimentoId: string; aria: AriaDoAtendimento | null | undefined; fuso: string | null; aoMudar(): void }) {
  // Idempotente por natureza (#166, 7º lote): devolver a quem já está com a Aria não grava nada, e aprovar ou rejeitar
  // de novo a sugestão que a mesma pessoa já decidiu devolve ok sem enviar a resposta outra vez (server/aria/historico.ts).
  const acao = useAcaoCliente({ idempotente: true });
  if (!aria || (!aria.pausada && aria.sugestoes.length === 0)) return null;

  const hora = (iso: string) => formatarInstanteExibicao(iso, fuso, "UTC", "hora").texto;
  async function decidir(fn: () => ReturnType<typeof devolverParaAria>, ok: string) {
    const d = await acao.executar(fn, ok);
    if (d?.tipo === "ok") aoMudar();
  }

  return (
    <section aria-label="Aria" className="space-y-2 border-t p-4 text-sm">
      <h3 className="font-medium">Aria</h3>
      {aria.pausada && (
        <div className="space-y-2">
          <p className="text-gray-700">{textoPausaAria(aria.motivo)}</p>
          {aria.podeDevolver && (
            <Botao tamanho="sm" variante="secundario" disabled={acao.ocupado} onClick={() => decidir(() => devolverParaAria(atendimentoId), "Aria retomou o atendimento.")}>Devolver para Aria</Botao>
          )}
        </div>
      )}
      {aria.sugestoes.length > 0 && (
        <ul className="space-y-2">
          {aria.sugestoes.map((s) => (
            <li key={s.id} className="space-y-1 rounded-md border border-border-soft p-2">
              <p className="font-medium">{ACAO_AGENTE_IA_LABEL[s.acao]}</p>
              <p className="text-gray-700">{s.resumo}</p>
              <p className="text-xs text-gray-600">Expira às {hora(s.expiraEm)}</p>
              <div className="flex gap-2">
                <Botao tamanho="sm" aria-label={`Aprovar ${ACAO_AGENTE_IA_LABEL[s.acao]}`} disabled={acao.ocupado} onClick={() => decidir(() => aprovarAcaoAria(s.id), "Sugestão aprovada.")}>Aprovar</Botao>
                <Botao tamanho="sm" variante="perigo" aria-label={`Rejeitar ${ACAO_AGENTE_IA_LABEL[s.acao]}`} disabled={acao.ocupado} onClick={() => decidir(() => rejeitarAcaoAria(s.id), "Sugestão rejeitada.")}>Rejeitar</Botao>
              </div>
            </li>
          ))}
        </ul>
      )}
      <FeedbackAcao erro={acao.erro} sucesso={acao.sucesso} />
    </section>
  );
}
