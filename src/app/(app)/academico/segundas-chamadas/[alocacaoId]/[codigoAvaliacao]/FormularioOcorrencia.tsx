"use client";

import { useRouter } from "next/navigation";
import { registrarOcorrenciaSegundaChamadaLocal } from "@/server/avaliacoes/segunda-chamada-ocorrencia-local";
import { botaoClasses } from "@/components/Botao";
import { FeedbackAcao } from "@/components/FeedbackAcao";
import { useAcaoCliente } from "@/lib/acao-cliente";
import { CampoTexto } from "@/components/CampoTexto";
import { CampoFuso } from "@/components/CampoFuso";
import { CampoSelect, CampoInstante, SelectItem } from "@/app/(app)/academico/controles";

const tipos = [
  ["FALTA", "Falta"],
  ["IMPEDIMENTO_ESCOLA", "Impedimento pela escola"],
] as const;

export function FormularioOcorrencia({ reservaId, fuso }: { reservaId: string; fuso: string }) {
  const router = useRouter();
  const acao = useAcaoCliente({ idempotente: true });

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
        <CampoSelect name="tipo" required defaultValue="" className="block rounded border p-2" placeholder="Selecione">{tipos.map(([valor, rotulo]) => <SelectItem key={valor} value={valor}>{rotulo}</SelectItem>)}</CampoSelect>
      </label>
      <label className="block">Data e hora da ocorrência
        <CampoInstante name="dataHoraLocal" step="0.001" required className="block rounded border p-2" />
      </label>
      <label className="block">Fuso da data e hora
        <CampoFuso padrao={fuso} className="block rounded border p-2" />
      </label>
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
