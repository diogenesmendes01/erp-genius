"use client";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { reservarVagaContratacao } from "@/server/matricula/reserva-comercial";
import { botaoClasses } from "@/components/Botao";
export function ReservarFormulario({ matriculaId, turmas }: { matriculaId: string; turmas: { id: string; nome: string }[] }) {
  const router = useRouter(), chave = useRef<string | null>(null);
  const [erro, setErro] = useState(""); const [ocupado, iniciar] = useTransition();
  return <form className="space-y-3 rounded border p-4" onSubmit={(e) => { e.preventDefault(); const form = new FormData(e.currentTarget);
    iniciar(async () => { try { chave.current ??= crypto.randomUUID();
      const r = await reservarVagaContratacao({ matriculaId, turmaId: String(form.get("turma")), motivo: String(form.get("motivo")), chaveIdempotencia: chave.current });
      if (!r.ok) { setErro(r.erro); return; } router.refresh();
    } catch { setErro("Resultado não confirmado. Reenvie os mesmos dados para conferir a tentativa."); } }); }}>
    <label className="block">Turma<select required name="turma" className="block w-full rounded border p-2" defaultValue=""><option value="" disabled>Selecione uma turma disponível nesta página</option>{turmas.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}</select></label>
    <label className="block">Motivo da reserva<textarea name="motivo" required minLength={5} maxLength={2000} className="block w-full rounded border p-2" /></label>
    <button disabled={ocupado || !turmas.length} className={botaoClasses({ variante: "secundario", tamanho: "lg" })}>{ocupado ? "Conferindo e reservando…" : "Confirmar reserva de vaga"}</button>{erro && <p role="alert">{erro}</p>}
  </form>;
}
