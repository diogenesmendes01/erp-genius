"use client";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { prepararGradeInicialTurma } from "@/server/agenda/grade-proposta";

type Turma = { id: string; codigo: string; versao: number; dataInicio: string | null; horario: string | null;
  dias: number[]; quantidade: number | null; duracao: number; frequencia: string; professor: string | null };
export function PrepararGrade({ turmas, turmaInicialId }: { turmas: Turma[]; turmaInicialId?: string | null }) {
  const router = useRouter();
  const inicialValida = turmas.some((t) => t.id === turmaInicialId) ? turmaInicialId ?? "" : "";
  const [turmaId, selecionar] = useState(inicialValida);
  const [fuso, setFuso] = useState("");
  const [motivo, setMotivo] = useState("");
  const [erro, setErro] = useState("");
  const [ocupado, iniciar] = useTransition();
  const tentativa = useRef<{ assinatura: string; chave: string } | null>(null);
  const turma = turmas.find((t) => t.id === turmaId);
  function enviar(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!turma) return;
    const dados = { turmaId, fusoOrigem: fuso.trim(), motivo, versaoAnterior: turma.versao };
    const assinatura = JSON.stringify(dados);
    if (tentativa.current?.assinatura !== assinatura) tentativa.current = { assinatura, chave: crypto.randomUUID() };
    const chaveIdempotencia = tentativa.current.chave;
    iniciar(async () => {
      setErro("");
      try {
        const r = await prepararGradeInicialTurma({ ...dados, chaveIdempotencia });
        if (!r.ok || !r.dado) { setErro(r.ok ? "Proposta não confirmada." : r.erro); return; }
        router.push(`/academico/grades/${r.dado.id}`);
      } catch { setErro("Não foi possível confirmar o envio. Tente novamente com os mesmos dados para conferir o resultado."); }
    });
  }
  const campo = "mt-1 block w-full rounded border bg-[var(--surface)] p-2";
  return <form onSubmit={enviar} className="space-y-4">
    <fieldset disabled={ocupado} className="space-y-4">
      <legend className="font-medium">Nova proposta de grade</legend>
      <label className="block">Turma<select required className={campo} value={turmaId} onChange={(e) => selecionar(e.target.value)}><option value="">Selecione uma turma</option>{turmas.map((t) => <option key={t.id} value={t.id}>{t.codigo}</option>)}</select></label>
      {turma && <div className="space-y-1 rounded border p-3">
        <p>Data inicial: {turma.dataInicio ?? "Não informada"} · Horário: {turma.horario ?? "Não informado"}</p>
        <p>Dias: {turma.dias.map((d) => ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"][d]).join(", ") || "Não informados"}</p>
        <p>{turma.quantidade ?? "Quantidade não definida"} aulas · {turma.duracao} minutos · {turma.frequencia}</p>
        <p>Professor: {turma.professor ?? "Não definido; obrigatório antes de publicar"}</p>
      </div>}
      <label className="block">Fuso de origem da turma<input required value={fuso} onChange={(e) => setFuso(e.target.value)} className={campo} placeholder="Ex.: America/Sao_Paulo" list="fusos-grade" /></label>
      <datalist id="fusos-grade"><option value="America/Sao_Paulo"/><option value="America/Costa_Rica"/><option value="UTC"/></datalist>
      <p className="text-sm">O horário cadastrado será interpretado neste fuso. Confira a primeira aula e o término na proposta antes da aprovação.</p>
      <label className="block">Motivo da proposta<textarea required minLength={5} maxLength={2000} value={motivo} onChange={(e) => setMotivo(e.target.value)} className={campo} /></label>
      <button disabled={!turma || !fuso.trim() || motivo.trim().length < 5} className="rounded bg-brand-700 px-3 py-2 text-white disabled:opacity-50">{ocupado ? "Preparando…" : "Preparar para revisão"}</button>
    </fieldset>
    {erro && <p role="alert" className="text-red-700">{erro}</p>}
  </form>;
}
