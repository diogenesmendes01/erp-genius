"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { EstadoPolitica } from "@prisma/client";
import { Aviso } from "@/components/Aviso";
import { Botao } from "@/components/Botao";
import { Campo } from "@/components/Campo";
import { FeedbackAcao } from "@/components/FeedbackAcao";
import { useAcaoCliente } from "@/lib/acao-cliente";
import { ESTADO_POLITICA_LABEL } from "@/lib/labels";
import { definirEstadoAria, pausarAria, reativarAria } from "@/server/aria/acoes";

type Props = {
  nome: string;
  funcao: string;
  versaoPublicada: number | null;
  estado: EstadoPolitica;
  pausada: boolean;
  motivoPausa: string | null;
  supervisao: boolean;
  podeMudarEstado: boolean;
  podePausar: boolean;
  /** Só quem vê o provedor ganha o atalho para ele. */
  verProvedor: boolean;
};

const ESTADOS: EstadoPolitica[] = ["DESLIGADA", "SHADOW", "ATIVA"];
const DICA_ESTADO = "Desligada não faz nada. Sombra simula e registra o que faria, sem enviar nem mudar o CRM. Ativa responde e age conforme a matriz de permissões.";

export function Cabecalho({ nome, funcao, versaoPublicada, estado, pausada, motivoPausa, supervisao, podeMudarEstado, podePausar, verProvedor }: Props) {
  const router = useRouter();
  const acao = useAcaoCliente({ idempotente: false });
  const [motivo, setMotivo] = useState("");
  const [pedindoMotivo, setPedindoMotivo] = useState(false);

  async function executar(fn: () => ReturnType<typeof pausarAria>, ok: string) {
    const d = await acao.executar(fn, ok);
    if (d?.tipo === "ok") {
      setPedindoMotivo(false);
      setMotivo("");
      router.refresh();
    }
  }

  return (
    <header>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Agente de IA</h1>
          <p className="mt-1 text-sm text-gray-600">
            {nome} · {funcao} · {versaoPublicada ? `versão ${versaoPublicada} publicada` : "ainda sem versão publicada"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-gray-100 px-3 py-1 text-sm text-gray-800">{pausada ? "Pausada" : ESTADO_POLITICA_LABEL[estado]}</span>
          {supervisao && <span className="rounded-full bg-amber-100 px-3 py-1 text-sm text-amber-800">Supervisão ligada</span>}
          {podePausar && !pausada && !pedindoMotivo && (
            <Botao variante="secundario" onClick={() => setPedindoMotivo(true)}>Pausar</Botao>
          )}
          {podePausar && pausada && (
            <Botao ocupado={acao.ocupado} onClick={() => executar(reativarAria, "Aria reativada.")}>Reativar</Botao>
          )}
          {verProvedor && (
            <Link className="text-sm text-brand-700 underline" href="/configuracao/operacao">Provedor e modelo</Link>
          )}
        </div>
      </div>

      {pausada && (
        <Aviso tom="atencao" className="mt-3" titulo={`${nome} está pausada.`}>
          Novas conversas vão para a fila do Comercial e as sugestões pendentes continuam no Inbox.
          {motivoPausa ? <> Motivo: {motivoPausa}</> : null}
        </Aviso>
      )}

      {pedindoMotivo && (
        <div className="mt-3 max-w-xl rounded-md border border-border-soft p-3">
          <Campo rotulo="Motivo da pausa" obrigatorio dica="Fica registrado no histórico de auditoria.">
            {(campo) => (
              <input {...campo} type="text" maxLength={500} value={motivo} onChange={(e) => setMotivo(e.target.value)} className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm" />
            )}
          </Campo>
          <div className="mt-3 flex flex-wrap gap-2">
            <Botao variante="secundario" onClick={() => setPedindoMotivo(false)}>Voltar</Botao>
            <Botao ocupado={acao.ocupado} disabled={!motivo.trim()} onClick={() => executar(() => pausarAria({ motivo }), "Aria pausada.")}>Pausar a Aria</Botao>
          </div>
        </div>
      )}

      {podeMudarEstado && (
        <div className="mt-3 max-w-md">
          <Campo rotulo="Estado da Aria" dica={DICA_ESTADO}>
            {(campo) => (
              <select
                {...campo}
                value={estado}
                disabled={acao.ocupado}
                onChange={(e) => executar(() => definirEstadoAria(e.target.value as EstadoPolitica), "Estado alterado.")}
                className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
              >
                {ESTADOS.map((e) => <option key={e} value={e}>{ESTADO_POLITICA_LABEL[e]}</option>)}
              </select>
            )}
          </Campo>
        </div>
      )}
      <FeedbackAcao erro={acao.erro} sucesso={acao.sucesso} className="mt-3" />
    </header>
  );
}
