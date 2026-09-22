"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { conciliarEnvioAditivo, enviarAditivoParaAssinatura } from "@/server/contratos/aditivo-envio";

const textoEstado: Record<string, string> = {
  ENVIADO: "Aditivo registrado no serviço de assinatura. Isso ainda não comprova assinatura nem aplica condições.",
  ENVIO_INCERTO: "O serviço não confirmou a criação. Não repita o envio: concilie o resultado antes de prosseguir.",
  PREPARADO: "O serviço confirmou que nada foi criado. Revise a pendência antes de enviar novamente.",
};

export function EnvioAditivoFormulario({ matriculaId, propostaId, processoId, modo }: { matriculaId: string; propostaId: string; processoId: string; modo: "ENVIAR" | "CONCILIAR" }) {
  const router = useRouter(), [pendente, iniciar] = useTransition(), [mensagem, setMensagem] = useState("");
  return <form className="space-y-2" onSubmit={event => { event.preventDefault(); setMensagem("");
    iniciar(async () => { try {
      const resultado = await (modo === "ENVIAR" ? enviarAditivoParaAssinatura : conciliarEnvioAditivo)({ matriculaId, propostaId, processoId });
      if (!resultado.ok) setMensagem(resultado.erro); else { setMensagem(textoEstado[resultado.dado?.estado ?? ""] ?? "Resultado registrado. Confira o estado do envio."); router.refresh(); }
    } catch { setMensagem("Não foi possível concluir a operação. Confira o estado do processo antes de repetir."); } });
  }}>
    <p>{modo === "ENVIAR" ? "O original preservado e os participantes conferidos serão enviados uma única vez. Falha de comunicação não autoriza repetir o envio."
      : "A conciliação consulta o serviço pela tentativa registrada. Só uma resposta conclusiva altera o estado do processo."}</p>
    {mensagem && <p role="status">{mensagem}</p>}
    <button className="rounded border px-4 py-2" disabled={pendente}>{pendente ? "Aguarde…" : modo === "ENVIAR" ? "Enviar aditivo para assinatura" : "Conciliar envio do aditivo"}</button>
  </form>;
}
