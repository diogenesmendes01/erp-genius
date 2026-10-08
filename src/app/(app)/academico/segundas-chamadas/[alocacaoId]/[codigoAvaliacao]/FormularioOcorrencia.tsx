"use client";

import { useId } from "react";
import { useRouter } from "next/navigation";
import { registrarOcorrenciaSegundaChamadaLocal } from "@/server/avaliacoes/segunda-chamada-ocorrencia-local";
import { botaoClasses } from "@/components/Botao";
import { FeedbackAcao } from "@/components/FeedbackAcao";
import { useAcaoCliente } from "@/lib/acao-cliente";
import { CampoTexto } from "@/components/CampoTexto";

const tipos = [
  ["FALTA", "Falta"],
  ["IMPEDIMENTO_ESCOLA", "Impedimento pela escola"],
] as const;

export function FormularioOcorrencia({ reservaId, fuso }: { reservaId: string; fuso: string }) {
  const router = useRouter();
  const listaFusosId = useId();
  // Sem chave de idempotência: na falha de transporte, conferir antes de repetir (MSG_RESULTADO_INCERTO_SEM_CHAVE).
  const acao = useAcaoCliente({ idempotente: false });

  return <form className="space-y-3 rounded border p-3" onSubmit={async evento => {
    evento.preventDefault();
    const valores = new FormData(evento.currentTarget);
    const d = await acao.executar(() => registrarOcorrenciaSegundaChamadaLocal({
      reservaId,
      tipo: String(valores.get("tipo")) as (typeof tipos)[number][0],
      dataHoraLocal: String(valores.get("dataHoraLocal")),
      fuso: String(valores.get("fuso")),
      motivo: String(valores.get("motivo")),
      evidencia: String(valores.get("evidencia")),
    }), "Ocorrência registrada.");
    if (d?.tipo === "ok") router.refresh();
  }}>
    <h3 className="font-medium">Registrar ocorrência</h3>
    <p className="text-sm">O sistema calcula cancelamento dentro ou fora do prazo. Falta não lança nota zero; impedimento pela escola não consome a oportunidade.</p>
    <fieldset disabled={acao.ocupado} className="space-y-2">
      <label className="block">Tipo
        <select name="tipo" required defaultValue="" className="block rounded border p-2">
          <option value="" disabled>Selecione</option>
          {tipos.map(([valor, rotulo]) => <option key={valor} value={valor}>{rotulo}</option>)}
        </select>
      </label>
      <label className="block">Data e hora da ocorrência
        <input name="dataHoraLocal" type="datetime-local" step="0.001" required className="block rounded border p-2" />
      </label>
      <label className="block">Fuso IANA
        <input name="fuso" list={listaFusosId} defaultValue={fuso} required className="block rounded border p-2" />
      </label>
      <datalist id={listaFusosId}>
        <option value="UTC" />
        <option value="America/Sao_Paulo" />
        <option value="America/Manaus" />
        <option value="America/Rio_Branco" />
      </datalist>
      <label className="block">Motivo
        <CampoTexto name="motivo" required minLength={5} maxLength={2000} className="block w-full rounded border p-2" />
      </label>
      <label className="block">Evidência
        <CampoTexto name="evidencia" required minLength={5} maxLength={4000} className="block w-full rounded border p-2" />
      </label>
      <button className={botaoClasses({ variante: "secundario", tamanho: "lg" })}>{acao.ocupado ? "Registrando…" : "Registrar ocorrência"}</button>
    </fieldset>
    <FeedbackAcao erro={acao.erro} sucesso={acao.sucesso} />
  </form>;
}
