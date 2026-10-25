"use client";
import { useEffect, useRef, useState } from "react";
import { Botao } from "@/components/Botao";
import { Campo } from "@/components/Campo";
import { FeedbackAcao } from "@/components/FeedbackAcao";
import { Modal } from "@/components/Modal";
import { useAcaoCliente } from "@/lib/acao-cliente";
import { pausarAria, reativarAria } from "@/server/aria/acoes";

/** A faixa dá uma key por estado/capacidade: nenhum ACK atravessa uma geração global. */
export function InterruptorAria({ pausada, aoMudar }: { pausada: boolean; aoMudar?: () => void }) {
  const acao = useAcaoCliente({ idempotente: true });
  const [aberto, setAberto] = useState(false);
  const [motivo, setMotivo] = useState("");
  const ciclo = useRef({ ativo: false });
  const campo = useRef<HTMLInputElement>(null);
  useEffect(() => { const atual = { ativo: true }; ciclo.current = atual; return () => { atual.ativo = false; }; }, []);
  async function executar() {
    const sessao = ciclo.current;
    const texto = motivo.trim();
    if (!sessao.ativo || (!pausada && (!aberto || !texto || texto.length > 500))) return;
    const r = await acao.executar(() => pausada ? reativarAria() : pausarAria({ motivo: texto }), pausada ? "Aria reativada." : "Aria pausada.");
    if (!sessao.ativo || ciclo.current !== sessao || r?.tipo !== "ok") return;
    setAberto(false); setMotivo(""); aoMudar?.();
  }
  return <>
    <Botao variante="iaFantasma" tamanho="sm" role="switch" title="Pausar ou reativar a Aria em todas as conversas" aria-label="Aria ativa" aria-checked={!pausada} ocupado={acao.ocupado} onClick={() => { if (pausada) void executar(); else { acao.limpar(); setAberto(true); } }}>
      <span aria-hidden="true" className={"relative inline-flex h-5 w-9 items-center rounded-full " + (pausada ? "bg-gray-300" : "bg-ai-solid")}>
        <span className={"h-4 w-4 rounded-full bg-white transition-transform " + (pausada ? "translate-x-0.5" : "translate-x-[18px]")} />
      </span><span className="sr-only">Aria ativa</span>
    </Botao>
    {!aberto && <FeedbackAcao erro={acao.erro} sucesso={acao.sucesso} className="basis-full" />}
    {aberto && <Modal titulo="Pausar a Aria em todas as conversas" aoFechar={() => setAberto(false)} bloquearFechamento={acao.ocupado} focoInicial={campo}>
      <p className="mb-3 text-sm text-gray-600">A pausa é global. Novas conversas vão para a equipe. O motivo fica no histórico de auditoria.</p>
      <Campo rotulo="Motivo da pausa" obrigatorio>
        {props => <input {...props} ref={campo} type="text" maxLength={500} value={motivo} disabled={acao.ocupado} onChange={e => setMotivo(e.target.value)} className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm" />}
      </Campo>
      <FeedbackAcao erro={acao.erro} />
      <div className="mt-4 flex justify-end gap-2">
        <Botao variante="fantasma" disabled={acao.ocupado} onClick={() => setAberto(false)}>Cancelar</Botao>
        <Botao ocupado={acao.ocupado} disabled={!motivo.trim() || motivo.trim().length > 500} onClick={() => void executar()}>Pausar a Aria</Botao>
      </div>
    </Modal>}
  </>;
}
