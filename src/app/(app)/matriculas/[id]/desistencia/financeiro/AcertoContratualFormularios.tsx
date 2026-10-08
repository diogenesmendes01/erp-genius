"use client";

import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { prepararAcertoDesistenciaContratual, decidirAcertoDesistenciaContratual } from "@/server/matricula/desistencia-acerto-contratual";
import { aplicarAcertoDesistenciaContratual } from "@/server/matricula/desistencia-acerto-aplicacao";
import { MensagemStatus } from "@/components/MensagemStatus";
import { botaoClasses } from "@/components/Botao";
import { MSG_RESULTADO_INCERTO } from "@/lib/mensagens";
import { CampoTexto } from "@/components/CampoTexto";
import { ConfirmarAcao, type FalhaConfirmacao } from "@/components/ConfirmarAcao";
import { formatarValores, somarPorMoeda, type ValorMoeda } from "@/lib/dinheiro";

function useOperacao() {
  const router = useRouter(), chave = useRef(crypto.randomUUID());
  const [ocupado, setOcupado] = useState(false), [mensagem, setMensagem] = useState("");
  return { ocupado, mensagem, async executar(acao: () => Promise<{ ok: boolean; erro?: string }>, sucesso: string) {
    setOcupado(true); setMensagem("");
    try { const r = await acao(); if (!r.ok) setMensagem(r.erro ?? "Não foi possível concluir a operação."); else { setMensagem(sucesso); chave.current = crypto.randomUUID(); router.refresh(); } }
    catch { setMensagem(MSG_RESULTADO_INCERTO); }
    finally { setOcupado(false); }
  },
  /** Sucesso de uma ação executada fora daqui (ConfirmarAcao): mesma saída do `executar`. */
  concluir(sucesso: string) { setMensagem(sucesso); chave.current = crypto.randomUUID(); router.refresh(); },
  /** Resultado incerto vindo do ConfirmarAcao: a chave fica (o reenvio confere a mesma tentativa). */
  informar(texto: string) { setMensagem(texto); },
  chave };
}

/** Item da memória contratual, como a página o recebe (valores em texto decimal). */
export type ItemMemoriaAcerto = { cobrancaId: string; moeda: string; devido: string; saldoDevido: string; creditoApurado: string };

/** O que a aplicação do acerto faz, em números: cobranças ajustadas e crédito criado, por moeda. */
export function resumoAplicacaoAcerto(itens: ItemMemoriaAcerto[]) {
  const credito = somarPorMoeda(itens.map((i: ItemMemoriaAcerto): ValorMoeda => ({ moeda: i.moeda, valor: Number(i.creditoApurado) }))).filter((v: ValorMoeda) => v.valor > 0);
  return { cobrancas: itens.length, credito };
}

export function PrepararAcertoContratualFormulario({ pedidoId, condicoesId, reapresentacao }: { pedidoId: string; condicoesId: string; reapresentacao?: { id: string; versao: number; aprovada: boolean } | null }) {
  const op = useOperacao();
  return <form className="space-y-3 rounded border p-4" onSubmit={(e: FormEvent<HTMLFormElement>) => { e.preventDefault(); const f = new FormData(e.currentTarget); void op.executar(() => prepararAcertoDesistenciaContratual({ pedidoId, condicoesId, motivo: String(f.get("motivo") ?? ""), ...(reapresentacao ? { anteriorId: reapresentacao.id, motivoReapresentacao: String(f.get("motivoReapresentacao") ?? "") } : {}), chaveIdempotencia: op.chave.current }), "Memória contratual preparada. Outra pessoa autorizada deve decidir."); }}>
    <h2 className="text-lg font-medium">Preparar acerto pela regra contratual</h2><p>A memória reúne todas as cobranças, recebimentos, créditos já apurados e a versão contratual vigente. Não altera valores nesta etapa.</p>
    {reapresentacao && <p role="status">Reapresentação da versão {reapresentacao.versao}, antes {reapresentacao.aprovada ? "aprovada" : "rejeitada"}. Versões rejeitadas podem ser reapresentadas; após aprovação, uma mudança exige novo pedido da Secretaria e nova decisão sobre a desistência antes da ativação.</p>}
    <fieldset disabled={op.ocupado}><label className="block">Motivo<CampoTexto name="motivo" required minLength={5} maxLength={3000} className="mt-1 block w-full rounded border p-2" /></label>{reapresentacao && <label className="mt-2 block">Motivo da reapresentação<CampoTexto name="motivoReapresentacao" required minLength={5} maxLength={3000} className="mt-1 block w-full rounded border p-2" /></label>}<button className={`${botaoClasses({ variante: "secundario", tamanho: "lg" })} mt-3`}>{op.ocupado ? "Preparando…" : reapresentacao ? "Reapresentar memória contratual" : "Preparar memória contratual"}</button></fieldset><MensagemStatus texto={op.mensagem} />
  </form>;
}

export function DecidirAcertoContratualFormulario({ propostaId, fotografiaHash }: { propostaId: string; fotografiaHash: string }) {
  const op = useOperacao();
  return <form className="space-y-3" onSubmit={(e: FormEvent<HTMLFormElement>) => { e.preventDefault(); const f = new FormData(e.currentTarget); void op.executar(() => decidirAcertoDesistenciaContratual({ propostaId, fotografiaHash, aprovada: f.get("decisao") === "aprovar", motivo: String(f.get("motivo") ?? ""), chaveIdempotencia: op.chave.current }), "Decisão independente registrada."); }}>
    <fieldset disabled={op.ocupado}><label>Decisão<select name="decisao" required className="ml-2 rounded border p-2"><option value="">Selecione</option><option value="aprovar">Aprovar acerto</option><option value="rejeitar">Rejeitar acerto</option></select></label><label className="mt-2 block">Justificativa<CampoTexto name="motivo" required minLength={5} maxLength={3000} className="mt-1 block w-full rounded border p-2" /></label><button className={`${botaoClasses({ variante: "secundario", tamanho: "lg" })} mt-3`}>{op.ocupado ? "Registrando…" : "Registrar decisão independente"}</button></fieldset><MensagemStatus texto={op.mensagem} />
  </form>;
}

export function AplicarAcertoContratualFormulario({ decisaoId, itens }: { decisaoId: string; itens: ItemMemoriaAcerto[] }) {
  const op = useOperacao();
  // Ajusta valores de cobrança e cria crédito — a ação mais irreversível da área (docs/42 L799). O botão
  // só revela o resumo; a aplicação exige marcar "Confirmo os valores acima" no diálogo.
  const [confirmando, setConfirmando] = useState(false);
  const resumo = resumoAplicacaoAcerto(itens);
  return <div className="space-y-2"><p>A aplicação ajusta os valores aprovados e cria crédito somente para excedente comprovado. A Secretaria ainda efetiva a desistência.</p><button disabled={op.ocupado} className={botaoClasses({ variante: "secundario", tamanho: "lg" })} onClick={() => setConfirmando(true)}>Aplicar acerto aprovado</button><MensagemStatus texto={op.mensagem} />
    {confirmando && <ConfirmarAcao
      titulo="Aplicar o acerto contratual aprovado?"
      confirmacao="aplicação do acerto"
      conferencia="Confirmo os valores acima."
      idempotente
      acao={() => aplicarAcertoDesistenciaContratual({ decisaoId, chaveIdempotencia: op.chave.current })}
      aoConcluir={() => { setConfirmando(false); op.concluir("Acerto aplicado. A Secretaria pode efetivar a desistência."); }}
      aoFalhar={(falha: FalhaConfirmacao) => { if (falha.tipo === "incerto") op.informar(falha.mensagem); }}
      aoCancelar={() => setConfirmando(false)}
    >
      <p>{resumo.cobrancas === 1 ? "Será ajustada 1 cobrança" : `Serão ajustadas ${resumo.cobrancas} cobranças`} desta matrícula pelos valores da memória aprovada.</p>
      <p>{resumo.credito.length ? `Será criado crédito de ${formatarValores(resumo.credito)} (excedente comprovado).` : "Nenhum crédito será criado."}</p>
      <p>Os valores aplicados não são desfeitos por esta tela; uma mudança posterior exige reconferência.</p>
    </ConfirmarAcao>}
  </div>;
}
