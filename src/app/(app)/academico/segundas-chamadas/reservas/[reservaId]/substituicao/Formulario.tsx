"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { decidirSubstituicaoAgendaSegundaChamada, proporSubstituicaoAgendaSegundaChamada } from "@/server/avaliacoes/segunda-chamada-substituicao";

type Props = {
  reservaId: string;
  base: string;
  professores?: { id: string; nome: string }[];
  selecionado?: string;
  previa?: { estadoConferido: string; pendencias: string[]; substituto: { id: string; nome: string } | null } | null;
  proposta?: { id: string; hash: string; podeAprovar: boolean; impedimentoAprovacao: string | null };
};

export function Formulario({ reservaId, base, professores = [], selecionado, previa, proposta }: Props) {
  const router = useRouter();
  const trava = useRef(false);
  const tentativa = useRef<{ entrada: string; chave: string } | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState("");
  const [escolhido, setEscolhido] = useState(selecionado ?? "");
  const disponibilidadeConferida = !!previa?.substituto && previa.substituto.id === escolhido;
  const podeEnviar = disponibilidadeConferida && previa.pendencias.length === 0;
  return <form className="space-y-3 rounded border p-4" onSubmit={async (evento) => {
    evento.preventDefault();
    if (trava.current) return;
    const dadosForm = new FormData(evento.currentTarget);
    trava.current = true; setOcupado(true); setErro("");
    try {
      const resultado = proposta
        ? await decidirSubstituicaoAgendaSegundaChamada({ propostaId: proposta.id, propostaHash: proposta.hash, aprovada: dadosForm.get("decisao") === "aprovar", motivo: String(dadosForm.get("motivo")) })
        : await (async () => {
          if (!podeEnviar || !previa?.substituto) return { ok: false as const, erro: "Confira a disponibilidade do professor selecionado antes de enviar." };
          const dados = { reservaId, substitutoId: previa.substituto.id, estadoConferido: previa.estadoConferido, motivo: String(dadosForm.get("motivo")), evidencia: String(dadosForm.get("evidencia")) };
          const entrada = JSON.stringify(dados);
          if (tentativa.current?.entrada !== entrada) tentativa.current = { entrada, chave: crypto.randomUUID() };
          return proporSubstituicaoAgendaSegundaChamada({ ...dados, chaveIdempotencia: tentativa.current.chave });
        })();
      if (!resultado.ok) setErro(resultado.erro); else router.refresh();
    } catch { setErro("Resultado não confirmado. Confira o histórico antes de repetir."); }
    finally { trava.current = false; setOcupado(false); }
  }}>
    <fieldset disabled={ocupado} className="space-y-3">
      {proposta ? <><label className="block">Decisão<select className="block border p-2" name="decisao" defaultValue="" required><option value="" disabled>Selecione</option>{proposta.podeAprovar && <option value="aprovar">Aprovar substituição</option>}<option value="rejeitar">Rejeitar</option></select></label>{!proposta.podeAprovar && <p className="text-sm" role="status">{proposta.impedimentoAprovacao ?? "A aprovação exige uma nova proposta; esta versão ainda pode ser rejeitada."}</p>}</> : <>
        <label className="block">Professor substituto<select className="block border p-2" value={escolhido} onChange={(evento) => { const proximo = evento.target.value; setEscolhido(proximo); router.replace(proximo ? `${base}?substitutoId=${encodeURIComponent(proximo)}` : base); }}><option value="">Selecione para conferir</option>{professores.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}</select></label>
        {!escolhido ? <p>Selecione um professor para conferir a disponibilidade.</p> : !disponibilidadeConferida ? <p>Atualizando a conferência de disponibilidade do professor selecionado.</p> : <><p>Substituto em conferência: {previa.substituto!.nome}.</p>{previa.pendencias.length ? <ul className="list-disc pl-5">{previa.pendencias.map((pendencia) => <li key={pendencia}>{pendencia}</li>)}</ul> : <p>Não há pendência apontada nesta conferência.</p>}</>}
        <label className="block">Evidência<textarea className="block w-full border p-2" name="evidencia" minLength={5} maxLength={4000} required /></label>
      </>}
      <label className="block">{proposta ? "Motivo da decisão" : "Motivo da substituição"}<textarea className="block w-full border p-2" name="motivo" minLength={5} maxLength={2000} required /></label>
      <button className="rounded border px-3 py-2" disabled={ocupado || (!proposta && !podeEnviar)}>{ocupado ? "Salvando…" : proposta ? "Registrar decisão" : "Enviar proposta"}</button>
    </fieldset>
    {erro && <p role="alert">{erro}</p>}
  </form>;
}
