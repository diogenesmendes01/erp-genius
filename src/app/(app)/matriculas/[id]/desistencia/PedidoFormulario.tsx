"use client";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { registrarPedidoDesistenciaPreparacao } from "@/server/matricula/desistencia-preparacao";
import { FeedbackAcao } from "@/components/FeedbackAcao";
import { botaoClasses } from "@/components/Botao";
import { CampoTexto } from "@/components/CampoTexto";
import { useAcaoCliente } from "@/lib/acao-cliente";

export function PedidoFormulario({ matriculaId, estadoHash }: { matriculaId: string; estadoHash: string }) {
  const router = useRouter();
  const [chave] = useState(() => crypto.randomUUID());
  const [registrado, setRegistrado] = useState(false);
  // Chave de idempotência estável pela vida do formulário: na falha de transporte, reenviar sem
  // alterar os dados confere a mesma operação (MSG_RESULTADO_INCERTO).
  const acao = useAcaoCliente({ idempotente: true });
  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const dados = new FormData(evento.currentTarget);
    const d = await acao.executar(() => registrarPedidoDesistenciaPreparacao({ matriculaId, estadoHash,
      motivo: String(dados.get("motivo") ?? ""), evidenciaPedido: String(dados.get("evidenciaPedido") ?? ""), chaveIdempotencia: chave }),
    "Pedido registrado para tratamento pela equipe.");
    if (d?.tipo === "ok") { setRegistrado(true); router.refresh(); }
  }
  return <form onSubmit={enviar} className="space-y-3 rounded border p-4">
    <h2 className="text-lg font-medium">Registrar pedido do cliente</h2>
    <p className="text-sm">O registro inicia o acompanhamento. A matrícula e a reserva permanecem na situação atual até a efetivação da desistência.</p>
    <fieldset disabled={acao.ocupado || registrado} className="space-y-3">
      <label className="block">Motivo<CampoTexto className="mt-1 block w-full rounded border p-2" name="motivo" required minLength={5} maxLength={3000} /></label>
      <label className="block">Referência da solicitação do cliente<CampoTexto className="mt-1 block w-full rounded border p-2" name="evidenciaPedido" required minLength={10} maxLength={3000} placeholder="Informe quando e por qual canal o cliente pediu a desistência e onde a solicitação pode ser conferida." /></label>
      <button className={botaoClasses({ variante: "secundario", tamanho: "lg" })} type="submit">{acao.ocupado ? "Registrando…" : "Registrar pedido"}</button>
    </fieldset>
    <FeedbackAcao erro={acao.erro} sucesso={acao.sucesso} />
  </form>;
}
