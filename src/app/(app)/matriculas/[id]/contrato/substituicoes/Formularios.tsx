"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { prepararSubstituicaoContratual, decidirSubstituicaoContratual } from "@/server/contratos/substituicao";
import { FeedbackAcao } from "@/components/FeedbackAcao";
import { useAcaoCliente } from "@/lib/acao-cliente";
import { botaoClasses } from "@/components/Botao";

export function PrepararSubstituicao({ matriculaId, fonte, conferencias }: {
  matriculaId: string; fonte: { id: string; artefatoId: string; revisaoHash: string };
  conferencias: { id: string; artefatoId: string; revisaoHash: string; rotulo: string }[];
}) {
  const router = useRouter();
  const [selecionada, selecionar] = useState("");
  const [chave] = useState(() => crypto.randomUUID());
  // Chave fixa pela vida do formulário e o servidor devolve a proposta existente quando ela se repete
  // com a mesma entrada (server/contratos/substituicao-tx.ts:20-24): reenviar sem alterar é seguro.
  const acao = useAcaoCliente({ idempotente: true });
  const pendente = acao.ocupado;
  const destino = conferencias.find(c => c.id === selecionada);
  const pdf = (id: string) => `/api/matriculas/${encodeURIComponent(matriculaId)}/originais/${encodeURIComponent(id)}/pdf`;
  return <form className="space-y-3 rounded border p-4" onSubmit={async e => {
    e.preventDefault(); const dados = new FormData(e.currentTarget);
    if (!destino) { acao.setErro("Selecione o documento substituto conferido."); return; }
    const motivo = String(dados.get("motivo") ?? "");
    const d = await acao.executar(() => prepararSubstituicaoContratual({ processoFonteId: fonte.id, conferenciaSubstitutoId: destino.id,
      revisaoFonteEsperada: fonte.revisaoHash, revisaoSubstitutoEsperada: destino.revisaoHash, motivo, chaveIdempotencia: chave }));
    if (d?.tipo === "ok" && d.dado) router.push(`/matriculas/${encodeURIComponent(matriculaId)}/contrato/substituicoes/${encodeURIComponent(d.dado.id)}`);
  }}>
    <h2 className="text-xl">Preparar proposta</h2>
    <label className="block">Conferência do documento substituto<select className="mt-1 block w-full rounded border p-2" value={selecionada} onChange={e => selecionar(e.target.value)} required disabled={pendente}>
      <option value="">Selecione uma conferência</option>{conferencias.map(c => <option key={c.id} value={c.id}>{c.rotulo}</option>)}
    </select></label>
    <nav className="flex flex-wrap gap-4"><a className="underline" href={pdf(fonte.artefatoId)} target="_blank" rel="noopener noreferrer">Abrir original enviado</a>
      {destino && <a className="underline" href={pdf(destino.artefatoId)} target="_blank" rel="noopener noreferrer">Abrir documento substituto</a>}</nav>
    <label className="block">Motivo e alterações propostas<textarea className="block w-full rounded border p-2" name="motivo" minLength={5} maxLength={4000} required disabled={pendente} /></label>
    <p>A proposta será encaminhada para decisão de outra pessoa da Administração. As condições do substituto serão conferidas novamente ao registrar.</p>
    <FeedbackAcao erro={acao.erro} />
    <button className={botaoClasses({ variante: "secundario", tamanho: "lg" })} disabled={pendente || !destino}>{pendente ? "Registrando…" : "Registrar proposta de substituição"}</button>
  </form>;
}

export function DecidirSubstituicao({ propostaId, propostaHash, superada }: { propostaId: string; propostaHash: string; superada: boolean }) {
  const router = useRouter();
  // decidirSubstituicaoContratual não recebe chave de idempotência (server/contratos/substituicao.ts:24;
  // só propostaHashEsperado). Conferir antes de repetir. Chave no servidor fica fora deste recorte.
  const acao = useAcaoCliente({ idempotente: false });
  const pendente = acao.ocupado;
  return <form className="space-y-3 rounded border p-4" onSubmit={async e => {
    e.preventDefault(); const dados = new FormData(e.currentTarget), decisao = dados.get("decisao");
    if (decisao !== "aprovar" && decisao !== "rejeitar") { acao.setErro("Escolha uma decisão."); return; }
    const motivo = String(dados.get("motivo") ?? "");
    const d = await acao.executar(() => decidirSubstituicaoContratual({ propostaId, propostaHashEsperado: propostaHash, aprovada: decisao === "aprovar", motivo }), "Decisão registrada.");
    if (d?.tipo === "ok") router.refresh();
  }}>
    <h2 className="text-xl">Decisão administrativa</h2>
    <label className="block"><input type="checkbox" required disabled={pendente} /> Conferi os documentos e as alterações desta proposta.</label>
    <label className="block">Decisão<select className="block rounded border p-2" name="decisao" defaultValue="" required disabled={pendente}>
      <option value="">Selecione</option><option value="aprovar" disabled={superada}>Aprovar proposta</option><option value="rejeitar">Rejeitar proposta</option>
    </select></label>
    <label className="block">Justificativa<textarea className="block w-full rounded border p-2" name="motivo" minLength={5} maxLength={4000} required disabled={pendente} /></label>
    <FeedbackAcao erro={acao.erro} sucesso={acao.sucesso} />
    <button className={botaoClasses({ variante: "secundario", tamanho: "lg" })} disabled={pendente}>{pendente ? "Registrando…" : "Registrar decisão"}</button>
  </form>;
}
