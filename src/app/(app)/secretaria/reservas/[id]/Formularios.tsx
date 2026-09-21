"use client";
import { useRef, useState, useTransition } from "react";
import { instanteDaGrade } from "@/server/agenda/grade";
import { useRouter } from "next/navigation";
import { prepararResolucaoParticular, decidirResolucaoParticular } from "@/server/matricula/reserva-particular-resolucao";
import { prepararResolucaoReserva, decidirResolucaoReserva } from "@/server/matricula/reserva-resolucao";
export function PrepararResolucao({ reservaId, versao, fuso, particular = false }: { reservaId: string; versao: number; fuso: string; particular?: boolean }) {
  const router = useRouter(), chave = useRef<string | null>(null);
  const [tipo, setTipo] = useState<"PRORROGAR" | "LIBERAR">("PRORROGAR");
  const [mensagem, setMensagem] = useState(""); const [ocupado, iniciar] = useTransition();
  return <form className="space-y-3 rounded border p-4" onSubmit={(e) => { e.preventDefault(); const dados = new FormData(e.currentTarget);
    iniciar(async () => { try {
      chave.current ??= crypto.randomUUID();
      const r = await (particular ? prepararResolucaoParticular : prepararResolucaoReserva)({ reservaId, versaoAnterior: versao, tipo,
        ...(tipo === "PRORROGAR" ? { novoPrazo: instanteDaGrade(String(dados.get("data")), String(dados.get("horario")), fuso).toISOString() } : {}), motivo: String(dados.get("motivo")), tratamentoContratacao: String(dados.get("tratamento")), chaveIdempotencia: chave.current });
      if (!r.ok) { setMensagem(r.erro); return; } router.refresh();
    } catch { setMensagem("Não foi possível confirmar. Reenvie os mesmos dados para conferir a tentativa."); } }); }}>
    <h2 className="font-medium">Preparar resolução</h2>
    <label className="block">Decisão proposta<select className="block rounded border p-2" value={tipo} onChange={(e) => setTipo(e.target.value as typeof tipo)} disabled={ocupado}><option value="PRORROGAR">Prorrogar reserva</option><option value="LIBERAR">{particular ? "Liberar horários" : "Liberar vaga"}</option></select></label>
    {tipo === "PRORROGAR" && <div><p>Novo prazo no fuso {fuso}</p><label className="block">Data<input className="block rounded border p-2" type="date" name="data" required /></label><label className="block">Horário<input className="block rounded border p-2" type="time" name="horario" required /></label></div>}
    <label className="block">Motivo<textarea className="block w-full rounded border p-2" name="motivo" required minLength={5} maxLength={2000} /></label>
    <label className="block">Tratamento previsto para contratação, documentos e valores<textarea className="block w-full rounded border p-2" name="tratamento" required minLength={10} maxLength={4000} /></label>
    <p>A decisão da reserva não executa o tratamento financeiro ou documental. Esses processos conservam suas próprias aprovações.</p>
    <button className="rounded border px-3 py-2" disabled={ocupado}>Enviar proposta para revisão</button>{mensagem && <p role="alert">{mensagem}</p>}
  </form>;
}
export function DecidirResolucao({ propostaId, podeAprovar, particular = false }: { propostaId: string; podeAprovar: boolean; particular?: boolean }) {
  const router = useRouter(); const [motivo, setMotivo] = useState(""); const [mensagem, setMensagem] = useState(""); const [ocupado, iniciar] = useTransition();
  function decidir(aprovar: boolean) { iniciar(async () => { try {
    const r = await (particular ? decidirResolucaoParticular : decidirResolucaoReserva)({ propostaId, aprovar, motivo });
    if (!r.ok) { setMensagem(r.erro); return; } router.refresh();
  } catch { setMensagem("Resultado não confirmado. Reenvie a mesma decisão para conferir."); } }); }
  return <div className="space-y-2"><label className="block">Motivo da decisão<textarea className="block w-full rounded border p-2" value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={2000} /></label>
    <div className="flex gap-3"><button className="rounded border p-2" disabled={ocupado || motivo.trim().length < 5 || !podeAprovar} onClick={() => decidir(true)}>Aprovar e aplicar</button><button className="rounded border p-2" disabled={ocupado || motivo.trim().length < 5} onClick={() => decidir(false)}>Rejeitar proposta</button></div>
    {!podeAprovar && <p>A aprovação exige a proposta mais recente, estado conferido e prazo válido. Prepare uma nova proposta se necessário.</p>}{mensagem && <p role="alert">{mensagem}</p>}
  </div>;
}
