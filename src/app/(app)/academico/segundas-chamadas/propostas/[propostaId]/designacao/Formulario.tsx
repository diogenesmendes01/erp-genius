"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { designarProfessorSegundaChamadaLocal } from "@/server/avaliacoes/segunda-chamada-designacao-local";

export function Formulario({ propostaId, professores }: {
  propostaId: string;
  professores: { id: string; nome: string }[];
}) {
  const router = useRouter();
  const [ocupado, setOcupado] = useState(false);
  const [mensagem, setMensagem] = useState("");
  const tentativa = useRef<{ entrada: string; chave: string } | null>(null);

  return <form className="space-y-3 rounded border p-4" onSubmit={async evento => {
    evento.preventDefault();
    if (ocupado) return;
    const valores = new FormData(evento.currentTarget);
    const dados = {
      propostaId,
      professorId: String(valores.get("professorId") ?? ""),
      inicioLocal: String(valores.get("inicio") ?? ""),
      fimLocal: String(valores.get("fim") ?? "") || undefined,
      fuso: String(valores.get("fuso") ?? ""),
      motivo: String(valores.get("motivo") ?? ""),
    };
    const entrada = JSON.stringify(dados);
    if (tentativa.current?.entrada !== entrada) tentativa.current = { entrada, chave: crypto.randomUUID() };
    const chaveIdempotencia = tentativa.current.chave;
    setOcupado(true);
    setMensagem("");
    try {
      const r = await designarProfessorSegundaChamadaLocal({ ...dados, chaveIdempotencia });
      if (r.ok) router.refresh();
      else setMensagem(r.erro);
    } catch {
      setMensagem("Resultado não confirmado. Reenvie sem alterar os dados.");
    } finally {
      setOcupado(false);
    }
  }}>
    <h2 className="text-xl font-medium">Designar professor</h2>
    <p className="text-sm">O início deve estar no passado ou presente e o fim, se informado, deve ser posterior ao início. A designação não concede autorização retroativa: o acesso depende do registro e de sua vigência.</p>
    <fieldset disabled={ocupado} className="space-y-3">
      <label className="block">Professor
        <select name="professorId" required defaultValue="" className="block rounded border p-2">
          <option value="" disabled>Selecione</option>
          {professores.map(professor => <option key={professor.id} value={professor.id}>{professor.nome}</option>)}
        </select>
      </label>
      <label className="block">Início
        <input name="inicio" type="datetime-local" step="0.001" required className="block rounded border p-2" />
      </label>
      <label className="block">Fim (opcional)
        <input name="fim" type="datetime-local" step="0.001" className="block rounded border p-2" />
      </label>
      <label className="block">Fuso IANA
        <input name="fuso" list="fusos-designacao-segunda-chamada" defaultValue="UTC" required className="block rounded border p-2" />
      </label>
      <datalist id="fusos-designacao-segunda-chamada">
        <option value="UTC" />
        <option value="America/Sao_Paulo" />
        <option value="America/Manaus" />
        <option value="America/Rio_Branco" />
      </datalist>
      <label className="block">Motivo
        <textarea name="motivo" required minLength={5} maxLength={2000} className="block w-full rounded border p-2" />
      </label>
      <button className="rounded border px-4 py-2">{ocupado ? "Designando…" : "Designar professor"}</button>
    </fieldset>
    {mensagem && <p role="alert">{mensagem}</p>}
  </form>;
}
