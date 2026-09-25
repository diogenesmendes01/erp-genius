"use client";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { registrarPedidoDesistenciaPreparacao } from "@/server/matricula/desistencia-preparacao";
import { MensagemStatus } from "@/components/MensagemStatus";
import { botaoClasses } from "@/components/Botao";
import { MSG_RESULTADO_INCERTO } from "@/lib/mensagens";

export function PedidoFormulario({ matriculaId, estadoHash }: { matriculaId: string; estadoHash: string }) {
  const router = useRouter();
  const [chave] = useState(() => crypto.randomUUID());
  const [ocupado, setOcupado] = useState(false);
  const [registrado, setRegistrado] = useState(false);
  const [mensagem, setMensagem] = useState("");
  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const dados = new FormData(evento.currentTarget);
    setOcupado(true); setMensagem("");
    try {
      const r = await registrarPedidoDesistenciaPreparacao({ matriculaId, estadoHash,
        motivo: String(dados.get("motivo") ?? ""), evidenciaPedido: String(dados.get("evidenciaPedido") ?? ""), chaveIdempotencia: chave });
      if (r.ok) { setRegistrado(true); setMensagem("Pedido registrado para tratamento pela equipe."); router.refresh(); }
      else setMensagem(r.erro);
    } catch { setMensagem(MSG_RESULTADO_INCERTO); }
    finally { setOcupado(false); }
  }
  return <form onSubmit={enviar} className="space-y-3 rounded border p-4">
    <h2 className="text-lg font-medium">Registrar pedido do cliente</h2>
    <p className="text-sm">O registro inicia o acompanhamento. A matrícula e a reserva permanecem na situação atual até a efetivação da desistência.</p>
    <fieldset disabled={ocupado || registrado} className="space-y-3">
      <label className="block">Motivo<textarea className="mt-1 block w-full rounded border p-2" name="motivo" required minLength={5} maxLength={3000} /></label>
      <label className="block">Referência da solicitação do cliente<textarea className="mt-1 block w-full rounded border p-2" name="evidenciaPedido" required minLength={10} maxLength={3000} placeholder="Informe quando e por qual canal o cliente pediu a desistência e onde a solicitação pode ser conferida." /></label>
      <button className={botaoClasses({ variante: "secundario", tamanho: "lg" })} type="submit">{ocupado ? "Registrando…" : "Registrar pedido"}</button>
    </fieldset>
    <MensagemStatus texto={mensagem} />
  </form>;
}
