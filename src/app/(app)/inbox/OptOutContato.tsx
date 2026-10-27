"use client";

import { useState } from "react";
import { Botao } from "@/components/Botao";
import { ConfirmarAcao } from "@/components/ConfirmarAcao";
import { FeedbackAcao } from "@/components/FeedbackAcao";
import { useAcaoCliente } from "@/lib/acao-cliente";
import { registrarOptOutContato, removerOptOutContato } from "@/server/whatsapp/acoes";

export interface PropsOptOutContato {
  contatoId: string;
  nome: string;
  optOut: boolean;
  podeReautorizar: boolean;
  aoMudar?: () => void;
}

export function OptOutContato({ contatoId, nome, optOut, podeReautorizar, aoMudar }: PropsOptOutContato) {
  const [confirmar, setConfirmar] = useState(false);
  const [evidencia, setEvidencia] = useState("");
  const [aviso, setAviso] = useState<string | null>(null);
  const remover = useAcaoCliente({ idempotente: true });

  async function reautorizar() {
    setAviso(null);
    const d = await remover.executar(() => removerOptOutContato(contatoId, evidencia), "Nova autorização registrada.");
    if (d?.tipo === "ok") { setEvidencia(""); setAviso("Nova autorização registrada."); aoMudar?.(); }
  }

  return (
    <section aria-label="Opt-out do contato" className="space-y-2 border-t p-4 text-sm">
      {optOut ? (
        <>
          <p role="status" className="text-red-700">O contato pediu opt-out: nenhuma mensagem sai para {nome} por nenhum número da escola.</p>
          {podeReautorizar && (
            <div className="space-y-2">
              <label className="grid gap-1 text-xs">Evidência da nova autorização (mínimo de 12 caracteres)
                <input value={evidencia} onChange={(e) => setEvidencia(e.target.value)} minLength={12} maxLength={1000} className="rounded border p-1.5 text-sm" />
              </label>
              <Botao tamanho="sm" variante="perigo" ocupado={remover.ocupado} disabled={evidencia.trim().length < 12} onClick={() => void reautorizar()}>Remover opt-out</Botao>
            </div>
          )}
        </>
      ) : (
        <Botao tamanho="sm" variante="secundario" aria-haspopup="dialog" aria-expanded={confirmar} onClick={() => { setAviso(null); setConfirmar(true); }}>Registrar opt-out</Botao>
      )}
      <FeedbackAcao erro={remover.erro} sucesso={aviso} />
      {confirmar && (
        <ConfirmarAcao
          folha
          titulo={`Registrar o opt-out de ${nome}?`}
          confirmacao="opt-out"
          idempotente
          acao={() => registrarOptOutContato(contatoId)}
          aoConcluir={() => { setConfirmar(false); setAviso("Opt-out registrado: automações bloqueadas."); aoMudar?.(); }}
          aoCancelar={() => setConfirmar(false)}
        >
          <p>Nenhuma mensagem sai mais para {nome} por nenhum número da escola: nem as automáticas (régua de cobrança e régua comercial) nem as enviadas por aqui.</p>
          <p>Só a administração desfaz, registrando a evidência da nova autorização do contato (mínimo de 12 caracteres).</p>
        </ConfirmarAcao>
      )}
    </section>
  );
}
