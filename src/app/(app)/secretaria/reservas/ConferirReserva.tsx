"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { conferirReservaSecretaria, conferirReservaParticularSecretaria } from "@/server/matricula/reserva-painel";
import { MensagemStatus } from "@/components/MensagemStatus";
import { MSG_RESULTADO_INCERTO_SEM_CHAVE } from "@/lib/mensagens";
export function ConferirReserva({ reservaId, particular = false }: { reservaId: string; particular?: boolean }) {
  const router = useRouter();
  const [mensagem, setMensagem] = useState("");
  const [ocupado, iniciar] = useTransition();
  function conferir() {
    iniciar(async () => {
      try {
        const r = await (particular ? conferirReservaParticularSecretaria : conferirReservaSecretaria)({ reservaId });
        if (!r.ok || !r.dado) { setMensagem(r.ok ? "Resultado não confirmado. Atualize a página para ver o estado atual da reserva." : r.erro); return; }
        setMensagem(({ PRAZO_VIGENTE: "O prazo da reserva ainda está vigente.", SEM_TRANSICAO: "A reserva já foi tratada; consulte seu estado atual.",
          PENDENCIA_REGISTRADA: "Reserva mantida por pendência da contratação.", HORARIOS_LIBERADOS: "Reserva expirada; horários liberados. A preparação permanece pendente de nova reserva.", CONFERIR_ASSINATURA_EXTERNA: "É necessário conferir o processo de assinatura externa antes de liberar a vaga. Esta conferência não liberou a reserva." })[r.dado.resultado]);
        router.refresh();
      } catch { setMensagem(MSG_RESULTADO_INCERTO_SEM_CHAVE); }
    });
  }
  return <div className="space-y-2"><button disabled={ocupado} onClick={conferir} className="rounded border px-3 py-2">{ocupado ? "Conferindo…" : "Conferir vencimento"}</button><MensagemStatus texto={mensagem} /></div>;
}
