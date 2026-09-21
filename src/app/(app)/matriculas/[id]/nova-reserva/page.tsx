import Link from "next/link";
import { Papel } from "@prisma/client";
import { exigirSessaoPagina } from "@/server/_shared";
import { consultarFormularioNovaReserva } from "@/server/matricula/nova-reserva-particular";
import { NovaReservaFormulario } from "./Formulario";
export default async function NovaReservaPage({ params }: { params: Promise<{ id: string }> }) {
  await exigirSessaoPagina(Papel.SECRETARIA_ACADEMICA);
  const { id } = await params, r = await consultarFormularioNovaReserva({ matriculaId: id });
  return <div className="space-y-4"><Link href={`/matriculas/${id}/preparacao`} className="underline">Voltar à preparação</Link><h1 className="text-2xl">Retomar com nova reserva particular</h1>
    <p>A reserva anterior permanece no histórico. Revise os novos horários e as condições antes de confirmar. Esta operação não confirma pagamento, assinatura ou ativação.</p>
    {!r.ok || !r.dado ? <p role="alert">{r.ok ? "Consulta indisponível." : r.erro}</p> : <NovaReservaFormulario key={`${r.dado.anteriorId}-${r.dado.versaoOferta}`} base={r.dado} />}
  </div>;
}
