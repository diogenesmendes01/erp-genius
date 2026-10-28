"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Botao } from "@/components/Botao";
import { ConfirmarAcao } from "@/components/ConfirmarAcao";
import { estornarComissaoDoPainel } from "@/server/crm/comissoes-estorno-acao";
import { CampoSelect } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { MotivoEstorno } from "@/server/crm/comissoes-estorno";

const MOTIVOS: { valor: MotivoEstorno; rotulo: string }[] = [
  { valor: "CANCELAMENTO_MATRICULA", rotulo: "Cancelamento da matrícula" },
  { valor: "DESISTENCIA_7_DIAS", rotulo: "Desistência em até 7 dias" },
  { valor: "ERRO_LANCAMENTO", rotulo: "Erro de lançamento" },
  { valor: "OUTRO", rotulo: "Outro motivo" },
];

const FALHA_DE_REDE = { ok: false as const, erro: "Não foi possível confirmar o estorno. Confira a conexão e tente de novo: o mesmo estorno não é gravado duas vezes." };

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
          idempotente
          acao={() => estornarComissaoDoPainel({ id, motivo, detalhe: detalhe.trim() || undefined }).catch(() => FALHA_DE_REDE)}
          aoConcluir={() => { setAberto(false); router.refresh(); }}
          aoCancelar={() => setAberto(false)}
        >
          <p>A comissão de {valor} sai dos totais a pagar. O valor fica registrado e não há reativação pela tela.</p>
          <label className="grid gap-1">
            <span>Motivo</span>
            <CampoSelect value={motivo} onValueChange={(v) => setMotivo(v as MotivoEstorno)} opcoes={MOTIVOS.map((m) => ({ valor: m.valor, rotulo: m.rotulo }))} />
          </label>
          <label className="grid gap-1">
            <span>{motivo === "OUTRO" ? "Descreva o motivo" : "Detalhe (opcional)"}</span>
            <Textarea value={detalhe} onChange={(e) => setDetalhe(e.target.value)} maxLength={1000} rows={3} />
          </label>
        </ConfirmarAcao>
      )}
    </>
  );
}
