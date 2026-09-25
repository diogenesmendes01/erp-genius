"use client";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { decidirDesistenciaAdministrativa } from "@/server/matricula/desistencia-administrativa";
import { MensagemStatus } from "@/components/MensagemStatus";
import { botaoClasses } from "@/components/Botao";

export function DecisaoFormulario({ pedidoId, estadoHash, podeAprovar }: { pedidoId: string; estadoHash: string; podeAprovar: boolean }) {
  const router = useRouter();
  const [ocupado, setOcupado] = useState(false), [concluido, setConcluido] = useState(false), [mensagem, setMensagem] = useState("");
  async function enviar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const dados = new FormData(event.currentTarget);
    setOcupado(true); setMensagem("");
    try {
      const r = await decidirDesistenciaAdministrativa({ pedidoId, estadoHash, aprovada: dados.get("decisao") === "aprovar", motivo: String(dados.get("motivo") ?? "") });
      if (r.ok) { setConcluido(true); setMensagem("Decisão registrada. A efetivação ainda depende das conferências e dos tratamentos aplicáveis."); router.refresh(); }
      else setMensagem(r.erro);
    } catch { setMensagem("Não foi possível confirmar o registro. Reenvie os mesmos dados para conferir a decisão."); }
    finally { setOcupado(false); }
  }
  return <form onSubmit={enviar} className="space-y-3"><fieldset disabled={ocupado || concluido} className="space-y-3">
    <label className="block">Decisão<select name="decisao" required className="ml-2 rounded border p-2"><option value="">Selecione</option>
      {podeAprovar && <option value="aprovar">Aprovar o pedido</option>}<option value="rejeitar">Rejeitar o pedido</option>
    </select></label>
    {!podeAprovar && <p>Esta versão não está disponível para aprovação. A rejeição pode ser registrada no histórico.</p>}
    <label className="block">Justificativa<textarea name="motivo" required minLength={5} maxLength={3000} className="block w-full rounded border p-2" /></label>
    <button type="submit" className={botaoClasses({ variante: "secundario", tamanho: "lg" })}>{ocupado ? "Registrando…" : "Registrar decisão administrativa"}</button>
  </fieldset><MensagemStatus texto={mensagem} /></form>;
}
