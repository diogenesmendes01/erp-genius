"use client";

import { useRef } from "react";
import { useRouter } from "next/navigation";
import { designarProfessorSegundaChamadaLocal } from "@/server/avaliacoes/segunda-chamada-designacao-local";
import { CampoFuso } from "@/components/CampoFuso";
import { useInicioDoPeriodo } from "@/lib/periodo-form";
import { botaoClasses } from "@/components/Botao";
import { FeedbackAcao } from "@/components/FeedbackAcao";
import { useAcaoCliente } from "@/lib/acao-cliente";
import { CampoTexto } from "@/components/CampoTexto";
import { CampoCombobox, CampoInstante } from "@/app/(app)/academico/controles";

export function Formulario({ propostaId, professores, fusoInstitucional }: {
  propostaId: string;
  professores: { id: string; nome: string }[];
  fusoInstitucional: string | null;
}) {
  const router = useRouter();
  const acao = useAcaoCliente({ idempotente: true });
  const periodo = useInicioDoPeriodo();
  const tentativa = useRef<{ entrada: string; chave: string } | null>(null);

  return <form className="space-y-3 rounded border p-4" onSubmit={async evento => {
    evento.preventDefault();
    if (acao.ocupado) return;
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
    const d = await acao.executar(() => designarProfessorSegundaChamadaLocal({ ...dados, chaveIdempotencia }), "Professor designado.");
    if (d?.tipo === "ok") router.refresh();
  }}>
    <h2 className="text-xl font-medium">Designar professor</h2>
    <p className="text-sm">O início deve estar no passado ou presente e o fim, se informado, deve ser posterior ao início. A designação não concede autorização retroativa: o acesso depende do registro e de sua vigência.</p>
    <fieldset disabled={acao.ocupado} className="space-y-3">
      <label className="block">Professor
        <CampoCombobox name="professorId" required defaultValue="" className="block rounded border p-2" placeholder="Selecione" opcoes={[...professores.map(professor => ({ valor: professor.id, rotulo: professor.nome }))]} />
      </label>
      <label className="block">Início
        <CampoInstante name="inicio" step="0.001" required {...periodo.propsInicio} className="block rounded border p-2" />
      </label>
      <label className="block">Fim (opcional)
        <CampoInstante name="fim" step="0.001" min={periodo.min} className="block rounded border p-2" />
      </label>
      <label className="block">Fuso IANA
        <CampoFuso padrao={fusoInstitucional ?? ""} className="block rounded border p-2" />
      </label>
      <label className="block">Motivo
        <CampoTexto name="motivo" required minLength={5} maxLength={2000} className="block w-full rounded border p-2" />
      </label>
      <button className={botaoClasses({ variante: "secundario", tamanho: "lg" })}>{acao.ocupado ? "Designando…" : "Designar professor"}</button>
    </fieldset>
    <FeedbackAcao erro={acao.erro} sucesso={acao.sucesso} />
  </form>;
}
