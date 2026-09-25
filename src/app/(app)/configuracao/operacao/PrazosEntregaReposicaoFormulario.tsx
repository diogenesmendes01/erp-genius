"use client";

import { useState, type FormEvent } from "react";
import { salvarPrazosEntregaReposicao } from "@/server/portal-aluno/configuracao";
import { MensagemStatus } from "@/components/MensagemStatus";
import { botaoClasses } from "@/components/Botao";
import { MSG_RESULTADO_INCERTO_SEM_CHAVE } from "@/lib/mensagens";

type Valores = { prazoPrimeiraEntregaReposicaoMinutos: number | null; prazoRespostaCorrecaoReposicaoMinutos: number | null };

export function PrazosEntregaReposicaoFormulario({ valores }: { valores: Valores }) {
  const [ocupado, setOcupado] = useState(false), [mensagem, setMensagem] = useState("");
  async function salvar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault(); const form = new FormData(evento.currentTarget);
    setOcupado(true); setMensagem("");
    try {
      const resultado = await salvarPrazosEntregaReposicao({
        prazoPrimeiraEntregaReposicaoMinutos: Number(form.get("prazoPrimeiraEntregaReposicaoMinutos")),
        prazoRespostaCorrecaoReposicaoMinutos: Number(form.get("prazoRespostaCorrecaoReposicaoMinutos")),
      });
      setMensagem(resultado.ok ? "Prazos salvos para novas disponibilizações e novos pedidos de correção." : resultado.erro);
    } catch { setMensagem(MSG_RESULTADO_INCERTO_SEM_CHAVE); }
    finally { setOcupado(false); }
  }
  return <form onSubmit={salvar} className="space-y-3 rounded border p-4"><h3 className="font-medium">Reposições por gravação</h3>
    <p className="text-sm">Defina as duas etapas em minutos. Material já publicado e correções já abertas preservam o prazo que receberam.</p>
    <fieldset disabled={ocupado} className="space-y-3"><label className="block text-sm">Primeira entrega (minutos)<input required name="prazoPrimeiraEntregaReposicaoMinutos" type="number" min={1} max={525600} step={1} defaultValue={valores.prazoPrimeiraEntregaReposicaoMinutos ?? ""} className="mt-1 block w-full rounded border p-2" /></label>
      <label className="block text-sm">Resposta a pedido de correção (minutos)<input required name="prazoRespostaCorrecaoReposicaoMinutos" type="number" min={1} max={525600} step={1} defaultValue={valores.prazoRespostaCorrecaoReposicaoMinutos ?? ""} className="mt-1 block w-full rounded border p-2" /></label>
      <button className={botaoClasses({ variante: "secundario", tamanho: "md" })} type="submit">{ocupado ? "Salvando…" : "Salvar prazos de reposição"}</button></fieldset>
    <MensagemStatus texto={mensagem} className="text-sm" />
  </form>;
}
