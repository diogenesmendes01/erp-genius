"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Botao } from "@/components/Botao";
import { ConfirmarAcao } from "@/components/ConfirmarAcao";
import { FeedbackAcao } from "@/components/FeedbackAcao";
import { useAcaoCliente } from "@/lib/acao-cliente";
import { descartarRascunho, publicarRascunho } from "@/server/aria/versoes";

type Props = {
  /** Caminhos alterados do rascunho em relação à versão publicada (ex.: "confianca.executaAPartirDe"). */
  diff: string[];
  podePublicar: boolean;
  podeDescartar: boolean;
};

/** Barra fixa acima da tabbar do celular; só existe quando há rascunho com alterações. */
export function BarraPublicar({ diff, podePublicar, podeDescartar }: Props) {
  const router = useRouter();
  const acao = useAcaoCliente({ idempotente: false });
  const [confirmando, setConfirmando] = useState<"publicar" | "descartar" | null>(null);
  if (diff.length === 0) return null;

  return (
    <div role="region" aria-label="Alterações não publicadas" className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-30 border-t border-border-soft bg-surface px-4 py-3 md:bottom-0 md:left-auto md:right-0 md:rounded-tl-lg md:border-l">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-gray-800">Alterações não publicadas em {diff.length} {diff.length === 1 ? "campo" : "campos"}. A Aria continua com a versão publicada.</p>
        <div className="flex flex-wrap gap-2">
          {podeDescartar && <Botao variante="perigo" onClick={() => setConfirmando("descartar")}>Descartar</Botao>}
          {podePublicar && <Botao onClick={() => setConfirmando("publicar")}>Publicar</Botao>}
        </div>
      </div>
      <FeedbackAcao erro={acao.erro} sucesso={acao.sucesso} className="mt-2" />

      {confirmando === "publicar" && (
        <ConfirmarAcao
          titulo="Publicar as alterações?"
          confirmacao="a publicação"
          idempotente={false}
          acao={() => publicarRascunho({})}
          aoConcluir={() => { setConfirmando(null); acao.setSucesso("Versão publicada. A Aria já usa as novas regras."); router.refresh(); }}
          aoCancelar={() => setConfirmando(null)}
        >
          <p>A Aria passa a usar estas regras nas próximas conversas. Mudam: {diff.join(", ")}.</p>
        </ConfirmarAcao>
      )}
      {confirmando === "descartar" && (
        <ConfirmarAcao
          titulo="Descartar as alterações?"
          confirmacao="o descarte"
          idempotente={false}
          acao={() => descartarRascunho()}
          aoConcluir={() => { setConfirmando(null); acao.setSucesso("Alterações descartadas."); router.refresh(); }}
          aoCancelar={() => setConfirmando(null)}
        >
          <p>O rascunho some e a Aria segue com a versão publicada. Isto não tem volta.</p>
        </ConfirmarAcao>
      )}
    </div>
  );
}
