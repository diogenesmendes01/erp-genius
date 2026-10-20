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
  /** Rascunho aberto na tela (id + atualizadoEm): o servidor recusa se outra pessoa o alterou. */
  rascunho: RascunhoAberto;
  alterado: boolean;
};

/** Rodapé comum das abas de edição: grava a seção no rascunho (publicar é na barra da página). */
export function Salvar({ montar, baseVersaoId, rascunho, alterado }: Props) {
  const router = useRouter();
  // Idempotente por natureza (#166): se o rascunho já tem exatamente esta configuração, o servidor devolve o
  // rascunho como está, sem gravar nem registrar outro Evento, mesmo com o token antigo (salvarRascunho).
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
