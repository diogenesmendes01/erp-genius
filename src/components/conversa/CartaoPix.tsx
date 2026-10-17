"use client";

import { useState, type ReactNode } from "react";
import { IconCopy } from "@tabler/icons-react";
import { Botao } from "@/components/Botao";
import { MensagemStatus } from "@/components/MensagemStatus";

export interface PixDados { quantia: string; solicitante: string; codigoCopiaCola: string; referencia?: string | null; descricao?: string | null }

/** Cobrança Pix recebida na conversa: só leitura, com cópia do código. Nada é pago nem enviado daqui. */
export function CartaoPix({ pix, meta }: { pix: PixDados; meta?: ReactNode }) {
  const [copiado, setCopiado] = useState(false);
  const [erro, setErro] = useState(false);
  return (
    <div className="flex min-w-[220px] flex-col gap-2" data-pix>
      <div className="text-xl font-semibold">{pix.quantia}</div>
      <div className="text-sm"><strong>Pagar com Pix</strong><div className="text-gray-600">{pix.solicitante} solicitou um pagamento</div></div>
      {pix.referencia && <small className="text-gray-600">Nº da cobrança: {pix.referencia}</small>}
      {pix.descricao && <small>{pix.descricao}</small>}
      {meta}
      <Botao variante="secundario" tamanho="sm"
        onClick={async () => {
          setCopiado(false); setErro(false);
          try { await navigator.clipboard.writeText(pix.codigoCopiaCola); setCopiado(true); } catch { setErro(true); }
        }}>
        <IconCopy size={18} aria-hidden /> Copiar código Pix
      </Botao>
      <MensagemStatus texto={copiado ? "Código Pix copiado" : null} />
      {erro && (
        <div role="alert" className="flex flex-col gap-1">
          <small>Não foi possível copiar. Selecione o código para copiar manualmente.</small>
          <code aria-label="Código Pix" className="select-all break-all rounded border border-gray-300 p-1 text-xs">{pix.codigoCopiaCola}</code>
        </div>
      )}
    </div>
  );
}
