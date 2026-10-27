"use client";

import { useRouter } from "next/navigation";
import { Botao } from "@/components/Botao";
import { FeedbackAcao } from "@/components/FeedbackAcao";
import { useAcaoCliente } from "@/lib/acao-cliente";
import type { ConfigAria } from "@/server/aria/config-schema";
import { salvarRascunho } from "@/server/aria/acoes";
import type { RascunhoAberto } from "@/server/aria/versoes";

type Props = {
  montar: () => ConfigAria;
  baseVersaoId: string | null;
  rascunho: RascunhoAberto;
  alterado: boolean;
};

export function Salvar({ montar, baseVersaoId, rascunho, alterado }: Props) {
  const router = useRouter();
  const acao = useAcaoCliente({ idempotente: true });
  async function salvar() {
    const d = await acao.executar(() => salvarRascunho({ config: montar(), baseVersaoId, rascunho }), "Rascunho salvo. Publique para a Aria usar.");
    if (d?.tipo === "ok") router.refresh();
  }
  return (
    <div className="mt-6">
      <Botao ocupado={acao.ocupado} disabled={!alterado} onClick={salvar}>Salvar rascunho</Botao>
      <FeedbackAcao erro={acao.erro} sucesso={acao.sucesso} className="mt-3" />
    </div>
  );
}
