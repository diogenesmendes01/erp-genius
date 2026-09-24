"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { prepararSubstituicaoContratual, decidirSubstituicaoContratual } from "@/server/contratos/substituicao";
import { MensagemStatus } from "@/components/MensagemStatus";

export function PrepararSubstituicao({ matriculaId, fonte, conferencias }: {
  matriculaId: string; fonte: { id: string; artefatoId: string; revisaoHash: string };
  conferencias: { id: string; artefatoId: string; revisaoHash: string; rotulo: string }[];
}) {
  const router = useRouter(), [pendente, iniciar] = useTransition(), [mensagem, setMensagem] = useState("");
  const [selecionada, selecionar] = useState("");
  const [chave] = useState(() => crypto.randomUUID());
  const destino = conferencias.find(c => c.id === selecionada);
  const pdf = (id: string) => `/api/matriculas/${encodeURIComponent(matriculaId)}/originais/${encodeURIComponent(id)}/pdf`;
  return <form className="space-y-3 rounded border p-4" onSubmit={e => {
    e.preventDefault(); const dados = new FormData(e.currentTarget);
    if (!destino) { setMensagem("Selecione o documento substituto conferido."); return; }
    const motivo = String(dados.get("motivo") ?? ""); setMensagem("");
    iniciar(async () => {
      const r = await prepararSubstituicaoContratual({ processoFonteId: fonte.id, conferenciaSubstitutoId: destino.id,
        revisaoFonteEsperada: fonte.revisaoHash, revisaoSubstitutoEsperada: destino.revisaoHash, motivo, chaveIdempotencia: chave });
      if (!r.ok) setMensagem(r.erro);
      else if (r.dado) router.push(`/matriculas/${encodeURIComponent(matriculaId)}/contrato/substituicoes/${encodeURIComponent(r.dado.id)}`);
    });
  }}>
    <h2 className="text-xl">Preparar proposta</h2>
    <label className="block">Conferência do documento substituto<select className="mt-1 block w-full rounded border p-2" value={selecionada} onChange={e => selecionar(e.target.value)} required disabled={pendente}>
      <option value="">Selecione uma conferência</option>{conferencias.map(c => <option key={c.id} value={c.id}>{c.rotulo}</option>)}
    </select></label>
    <nav className="flex flex-wrap gap-4"><a className="underline" href={pdf(fonte.artefatoId)} target="_blank" rel="noopener noreferrer">Abrir original enviado</a>
      {destino && <a className="underline" href={pdf(destino.artefatoId)} target="_blank" rel="noopener noreferrer">Abrir documento substituto</a>}</nav>
    <label className="block">Motivo e alterações propostas<textarea className="block w-full rounded border p-2" name="motivo" minLength={5} maxLength={4000} required disabled={pendente} /></label>
    <p>A proposta será encaminhada para decisão de outra pessoa da Administração. As condições do substituto serão conferidas novamente ao registrar.</p>
    {mensagem && <p role="alert">{mensagem}</p>}
    <button className="rounded border px-4 py-2" disabled={pendente || !destino}>{pendente ? "Registrando…" : "Registrar proposta de substituição"}</button>
  </form>;
}

export function DecidirSubstituicao({ propostaId, propostaHash, superada }: { propostaId: string; propostaHash: string; superada: boolean }) {
  const router = useRouter(), [pendente, iniciar] = useTransition(), [mensagem, setMensagem] = useState("");
  return <form className="space-y-3 rounded border p-4" onSubmit={e => {
    e.preventDefault(); const dados = new FormData(e.currentTarget), decisao = dados.get("decisao");
    if (decisao !== "aprovar" && decisao !== "rejeitar") { setMensagem("Escolha uma decisão."); return; }
    const motivo = String(dados.get("motivo") ?? ""); setMensagem("");
    iniciar(async () => {
      const r = await decidirSubstituicaoContratual({ propostaId, propostaHashEsperado: propostaHash, aprovada: decisao === "aprovar", motivo });
      if (!r.ok) setMensagem(r.erro); else { setMensagem("Decisão registrada."); router.refresh(); }
    });
  }}>
    <h2 className="text-xl">Decisão administrativa</h2>
    <label className="block"><input type="checkbox" required disabled={pendente} /> Conferi os documentos e as alterações desta proposta.</label>
    <label className="block">Decisão<select className="block rounded border p-2" name="decisao" defaultValue="" required disabled={pendente}>
      <option value="">Selecione</option><option value="aprovar" disabled={superada}>Aprovar proposta</option><option value="rejeitar">Rejeitar proposta</option>
    </select></label>
    <label className="block">Justificativa<textarea className="block w-full rounded border p-2" name="motivo" minLength={5} maxLength={4000} required disabled={pendente} /></label>
    <MensagemStatus texto={mensagem} />
    <button className="rounded border px-4 py-2" disabled={pendente}>{pendente ? "Registrando…" : "Registrar decisão"}</button>
  </form>;
}
