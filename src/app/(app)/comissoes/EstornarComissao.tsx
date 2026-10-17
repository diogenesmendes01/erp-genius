"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Botao } from "@/components/Botao";
import { CampoTexto } from "@/components/CampoTexto";
import { ConfirmarAcao } from "@/components/ConfirmarAcao";
import { estornarComissaoDoPainel } from "@/server/crm/comissoes-estorno-acao";
import type { MotivoEstorno } from "@/server/crm/comissoes-estorno";

const MOTIVOS: { valor: MotivoEstorno; rotulo: string }[] = [
  { valor: "CANCELAMENTO_MATRICULA", rotulo: "Cancelamento da matrícula" },
  { valor: "DESISTENCIA_7_DIAS", rotulo: "Desistência em até 7 dias" },
  { valor: "ERRO_LANCAMENTO", rotulo: "Erro de lançamento" },
  { valor: "OUTRO", rotulo: "Outro motivo" },
];

const FALHA_DE_REDE = { ok: false as const, erro: "Não foi possível confirmar o estorno. Confira a conexão, atualize a tela e veja se a comissão já aparece como estornada antes de tentar de novo." };

/** Botão "Estornar" de uma linha do painel: pede o motivo e confirma; a tela só muda depois do `ok` do servidor. */
export function EstornarComissao({ id, aluno, valor }: { id: string; aluno: string; valor: string }) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [motivo, setMotivo] = useState<MotivoEstorno>("CANCELAMENTO_MATRICULA");
  const [detalhe, setDetalhe] = useState("");
  return (
    <>
      <Botao variante="perigo" onClick={() => setAberto(true)} aria-label={`Estornar comissão de ${aluno}`}>Estornar</Botao>
      {aberto && (
        <ConfirmarAcao
          titulo={`Estornar a comissão de ${aluno}?`}
          confirmacao="estorno"
          idempotente={false}
          acao={() => estornarComissaoDoPainel({ id, motivo, detalhe: detalhe.trim() || undefined }).catch(() => FALHA_DE_REDE)}
          aoConcluir={() => { setAberto(false); router.refresh(); }}
          aoCancelar={() => setAberto(false)}
        >
          <p>A comissão de {valor} sai dos totais a pagar. O valor fica registrado e não há reativação pela tela.</p>
          <label className="grid gap-1">
            <span>Motivo</span>
            <select value={motivo} onChange={(e) => setMotivo(e.target.value as MotivoEstorno)} className="min-h-11 rounded-md border border-gray-300 px-2 text-sm md:min-h-0 md:py-1.5">
              {MOTIVOS.map((m) => <option key={m.valor} value={m.valor}>{m.rotulo}</option>)}
            </select>
          </label>
          <label className="grid gap-1">
            <span>{motivo === "OUTRO" ? "Descreva o motivo" : "Detalhe (opcional)"}</span>
            <CampoTexto value={detalhe} onChange={(e) => setDetalhe(e.target.value)} maxLength={1000} rows={3} className="rounded-md border border-gray-300 px-2 py-1.5 text-sm" />
          </label>
        </ConfirmarAcao>
      )}
    </>
  );
}
