"use client";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { solicitarIndisponibilidadeLocal } from "@/server/agenda/indisponibilidade";
import { useInicioDoPeriodo } from "@/lib/periodo-form";
import { MensagemStatus } from "@/components/MensagemStatus";
import { botaoClasses } from "@/components/Botao";
import { MSG_RESULTADO_INCERTO } from "@/lib/mensagens";
import { EstadoVazio } from "@/components/EstadoVazio";

export function SolicitarAusencia({ professores, fusoInicial }: { professores: { id: string; nome: string }[]; fusoInicial: string }) {
  const router = useRouter();
  const tentativa = useRef<{ entrada: string; chave: string } | null>(null);
  const [mensagem, setMensagem] = useState("");
  const periodo = useInicioDoPeriodo();
  const [erro, setErro] = useState("");
  const [ocupado, iniciar] = useTransition();
  return <form className="space-y-3 rounded-lg border bg-[var(--surface)] p-4" onSubmit={(event) => {
    event.preventDefault();
    const form = event.currentTarget, dados = new FormData(form);
    const entrada = { professorId: String(dados.get("professorId")), inicioLocal: String(dados.get("inicio")), fimLocal: String(dados.get("fim")), fusoOrigem: String(dados.get("fuso")), motivo: String(dados.get("motivo")) };
    const serializada = JSON.stringify(entrada);
    if (tentativa.current?.entrada !== serializada) tentativa.current = { entrada: serializada, chave: crypto.randomUUID() };
    const chaveIdempotencia = tentativa.current.chave;
    iniciar(async () => {
      setErro(""); setMensagem("");
      try {
        const r = await solicitarIndisponibilidadeLocal({ ...entrada, chaveIdempotencia });
        if (!r.ok) { setErro(r.erro); return; }
        form.reset(); tentativa.current = null;
        setMensagem("Solicitação registrada. Aguarde a decisão da gestão."); router.refresh();
      } catch { setErro(MSG_RESULTADO_INCERTO); }
    });
  }}>
    <h2 className="font-medium">Solicitar indisponibilidade</h2>
    <fieldset disabled={ocupado || professores.length === 0} className="grid gap-3 sm:grid-cols-2">
      <label className="text-sm">Professor<select name="professorId" required className="mt-1 block w-full rounded border p-2">{professores.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}</select></label>
      <label className="text-sm">Fuso dos horários<input name="fuso" required defaultValue={fusoInicial} placeholder="America/Sao_Paulo" className="mt-1 block w-full rounded border p-2" /></label>
      <label className="text-sm">Início da indisponibilidade<input name="inicio" required type="datetime-local" {...periodo.propsInicio} className="mt-1 block w-full rounded border p-2" /></label>
      <label className="text-sm">Fim da indisponibilidade<input name="fim" required type="datetime-local" min={periodo.min} className="mt-1 block w-full rounded border p-2" /></label>
      <label className="text-sm sm:col-span-2">Motivo<textarea name="motivo" required minLength={5} maxLength={2000} className="mt-1 block w-full rounded border p-2" /></label>
      <button className={botaoClasses({ tamanho: "lg" })} type="submit">{ocupado ? "Registrando…" : "Enviar solicitação"}</button>
    </fieldset>
    {professores.length === 0 && <EstadoVazio>Nenhum professor ativo disponível.</EstadoVazio>}
    {erro && <p role="alert" className="text-red-700">{erro}</p>}
    <MensagemStatus texto={mensagem} className="text-green-700" />
  </form>;
}
