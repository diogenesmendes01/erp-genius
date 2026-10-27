"use client";
import { useRouter } from "next/navigation";
import { conferirReservaSecretaria, conferirReservaParticularSecretaria } from "@/server/matricula/reserva-painel";
import { FeedbackAcao } from "@/components/FeedbackAcao";
import { botaoClasses } from "@/components/Botao";
import { useAcaoCliente } from "@/lib/acao-cliente";
import { MSG_RESULTADO_INCERTO_SEM_CHAVE } from "@/lib/mensagens";
import type { Resultado } from "@/server/_shared/resultado";
const RESULTADOS = { PRAZO_VIGENTE: "O prazo da reserva ainda está vigente.", SEM_TRANSICAO: "A reserva já foi tratada; consulte seu estado atual.",
  PENDENCIA_REGISTRADA: "Reserva mantida por pendência da contratação.", HORARIOS_LIBERADOS: "Reserva expirada; horários liberados. A preparação permanece pendente de nova reserva.", CONFERIR_ASSINATURA_EXTERNA: "É necessário conferir o processo de assinatura externa antes de liberar a vaga. Esta conferência não liberou a reserva." } as const;
export function ConferirReserva({ reservaId, particular = false }: { reservaId: string; particular?: boolean }) {
  const router = useRouter();
  const acao = useAcaoCliente({ idempotente: false });
  async function conferir() {
    const d = await acao.executar(async (): Promise<Resultado<{ resultado: keyof typeof RESULTADOS } | null>> => (particular ? conferirReservaParticularSecretaria : conferirReservaSecretaria)({ reservaId }), (dado) => dado ? RESULTADOS[dado.resultado] : null);
    if (d?.tipo !== "ok") return;
    if (!d.dado) { acao.setErro(MSG_RESULTADO_INCERTO_SEM_CHAVE); return; }
    router.refresh();
  }
  return <div className="space-y-2"><button disabled={acao.ocupado} onClick={conferir} className={botaoClasses({ variante: "secundario", tamanho: "lg" })}>{acao.ocupado ? "Conferindo…" : "Conferir vencimento"}</button><FeedbackAcao erro={acao.erro} sucesso={acao.sucesso} /></div>;
}
