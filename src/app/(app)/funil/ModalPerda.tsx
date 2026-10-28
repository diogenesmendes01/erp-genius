"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MotivoPerda } from "@prisma/client";
import { Modal } from "@/components/Modal";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { CampoTexto } from "@/components/CampoTexto";
import { Botao } from "@/components/Botao";
import { FeedbackAcao } from "@/components/FeedbackAcao";
import { useAcaoCliente } from "@/lib/acao-cliente";
import { MOTIVO_PERDA_LABEL } from "@/lib/labels";
import { marcarPerdido } from "@/server/comercial/acoes";
import { PerdaSchema, type PerdaInput } from "@/server/comercial/schema";
import type { Resultado } from "@/server/_shared/resultado";
import { garantirEstilo } from "@/app/(app)/inbox/garantir-estilo";

export type ValoresPerda = { motivoPerda: MotivoPerda | ""; observacao: string };

export function validarPerda(v: ValoresPerda): { erro: string | null; input: { motivoPerda: MotivoPerda; observacao?: string } | null } {
  if (!v.motivoPerda) return { erro: "Escolha o motivo da perda", input: null };
  const r = PerdaSchema.safeParse({ motivoPerda: v.motivoPerda, observacao: v.observacao.trim() || undefined });
  if (!r.success) return { erro: r.error.issues[0]?.message ?? "Dados inválidos", input: null };
  return { erro: null, input: { motivoPerda: r.data.motivoPerda, observacao: r.data.observacao?.trim() || undefined } };
}

export function ModalPerda({ oportunidadeId, nome, aoFechar, aoConcluir, acao: acaoRecebida }: {
  oportunidadeId: string;
  nome: string;
  aoFechar: () => void;
  aoConcluir?: () => void;
  acao?: (input: PerdaInput) => Promise<Resultado>;
}) {
  garantirEstilo();
  const router = useRouter();
  const acao = useAcaoCliente({ idempotente: true });
  const [motivo, setMotivo] = useState<MotivoPerda | "">("");
  const [observacao, setObservacao] = useState("");
  const [erroLocal, setErroLocal] = useState<string | null>(null);

  async function confirmar() {
    const v = validarPerda({ motivoPerda: motivo, observacao });
    if (!v.input) {
      setErroLocal(v.erro);
      return;
    }
    setErroLocal(null);
    const input = v.input;
    const desfecho = await acao.executar(() => acaoRecebida ? acaoRecebida(input) : marcarPerdido(oportunidadeId, input));
    if (desfecho?.tipo === "ok") {
      if (!acaoRecebida) router.refresh();
      aoConcluir?.();
      aoFechar();
    }
  }

  return (
    <Modal titulo={`Marcar ${nome} como perdida`} aoFechar={aoFechar} bloquearFechamento={acao.ocupado}>
      <fieldset className="grid gap-1">
        <legend className="mb-2 text-sm text-gray-700">Motivo da perda</legend>
        <RadioGroup name="motivoPerda" value={motivo} disabled={acao.ocupado} onValueChange={(valor) => setMotivo(valor as MotivoPerda)}>
          {Object.values(MotivoPerda).map((m) => (
            <label key={m} className="flex min-h-11 items-center gap-2 rounded-md px-1 text-sm text-gray-800 hover:bg-highlight sm:min-h-9">
              <RadioGroupItem value={m} disabled={acao.ocupado} />
              {MOTIVO_PERDA_LABEL[m]}
            </label>
          ))}
        </RadioGroup>
      </fieldset>
      <label className="mt-3 grid gap-1 text-sm text-gray-700">
        <span>Observação{motivo === MotivoPerda.OUTRO ? " (obrigatória)" : " (opcional)"}</span>
        <CampoTexto
          name="observacao"
          rows={3}
          maxLength={500}
          value={observacao}
          disabled={acao.ocupado}
          onChange={(e) => setObservacao(e.target.value)}
          className="rounded-md border border-gray-200 px-2 py-1.5 text-sm"
        />
      </label>
      <FeedbackAcao erro={erroLocal ?? acao.erro} className="mt-3" />
      <div className="mt-6 flex flex-wrap justify-end gap-3">
        <Botao variante="secundario" disabled={acao.ocupado} onClick={aoFechar}>Voltar</Botao>
        <Botao variante="perigo" disabled={acao.ocupado} aria-busy={acao.ocupado || undefined} onClick={confirmar}>
          {acao.ocupado ? "Salvando…" : "Marcar como perdida"}
        </Botao>
      </div>
    </Modal>
  );
}
