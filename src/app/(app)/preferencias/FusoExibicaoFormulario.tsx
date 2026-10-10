"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { salvarPreferenciaFusoEquipe } from "@/server/preferencias/fuso-exibicao";
import { FeedbackAcao } from "@/components/FeedbackAcao";
import { useAcaoCliente } from "@/lib/acao-cliente";
import { botaoClasses } from "@/components/Botao";
import { CampoFuso, validadeDoFuso, type SugestaoFuso } from "@/components/CampoFuso";

export const DESTAQUES_FUSO_EXIBICAO: readonly SugestaoFuso[] = [["America/Sao_Paulo", "Brasil — São Paulo"], ["America/Costa_Rica", "Costa Rica"], ["UTC", "UTC — horário universal"], ["US/Eastern", "Estados Unidos — Leste"]];

export function FusoExibicaoFormulario({ atual }: { atual: string | null }) {
  const [fuso, setFuso] = useState(atual ?? ""); const router = useRouter();
  // Sem chave de idempotência (a action sobrescreve a preferência): resultado incerto manda conferir antes de repetir.
  const acao = useAcaoCliente({ idempotente: false }), ocupado = acao.ocupado;
  function enviar() {
    const fusoExibicao = fuso.trim();
    // Mesma validação do campo e do servidor (fusoIanaValido); vazio é "sem preferência".
    const invalido = validadeDoFuso(fusoExibicao);
    if (invalido) { acao.setErro(invalido); return; }
    void acao.executar(() => salvarPreferenciaFusoEquipe({ fusoExibicao }), "Preferência salva.").then((d) => { if (d?.tipo === "ok") router.refresh(); });
  }
  return <form className="space-y-3 rounded border bg-surface p-5" onSubmit={(e) => { e.preventDefault(); enviar(); }}>
    <label className="block">Fuso de exibição<CampoFuso name="fusoExibicao" valor={fuso} onChange={setFuso} required={false} disabled={ocupado} placeholder="Usar fuso de origem" sugestoes={DESTAQUES_FUSO_EXIBICAO} todos opcaoVazia="Usar fuso de origem do encontro" className="mt-1 block w-full rounded border p-2" /></label>
    <p className="text-sm text-gray-600">Pesquise pelo local ou identificador IANA. Sem preferência, cada encontro continua no fuso de origem. Isso não altera calendário, cobrança ou mensagens.</p>
    <FeedbackAcao erro={acao.erro} sucesso={acao.sucesso} /><button disabled={ocupado} className={botaoClasses({ variante: "secundario", tamanho: "lg" })}>{ocupado ? "Salvando…" : "Salvar preferência"}</button>
  </form>;
}
