"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { materializarCasosHistoricosCorrecao } from "@/server/avaliacoes/casos-historicos";
import { MensagemStatus } from "@/components/MensagemStatus";
import { botaoClasses } from "@/components/Botao";
import { MSG_RESULTADO_INCERTO_SEM_CHAVE } from "@/lib/mensagens";

export function PrepararCasosHistoricos({ tipo, decisaoId }: { tipo: "REGULAR" | "RECUPERACAO"; decisaoId: string }) {
  const router = useRouter();
  const [ocupado, iniciar] = useTransition();
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");

  function preparar() {
    iniciar(async () => {
      setErro(""); setAviso("");
      try {
        const resposta = await materializarCasosHistoricosCorrecao({ tipo, decisaoId });
        if (!resposta.ok || !resposta.dado) { setErro(resposta.ok ? "Não foi possível preparar os casos de revisão." : resposta.erro); return; }
        setAviso(resposta.dado.criados > 0
          ? `${resposta.dado.criados} caso(s) de revisão preparado(s).`
          : "Os casos de revisão já estavam preparados.");
        router.refresh();
      } catch {
        setErro(MSG_RESULTADO_INCERTO_SEM_CHAVE);
      }
    });
  }

  return <div className="space-y-2 border-t pt-3">
    <p className="text-sm">Prepare os casos históricos para revisão. Esta ação registra os casos sem resolver nem alterar decisões anteriores.</p>
    {erro && <p role="alert">{erro}</p>}<MensagemStatus texto={aviso} />
    <button type="button" disabled={ocupado} onClick={preparar} className={botaoClasses({ variante: "secundario", tamanho: "lg" })}>Preparar casos de revisão</button>
  </div>;
}
