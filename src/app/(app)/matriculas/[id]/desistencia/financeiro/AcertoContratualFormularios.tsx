"use client";

import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { prepararAcertoDesistenciaContratual, decidirAcertoDesistenciaContratual } from "@/server/matricula/desistencia-acerto-contratual";
import { aplicarAcertoDesistenciaContratual } from "@/server/matricula/desistencia-acerto-aplicacao";
import { FeedbackAcao } from "@/components/FeedbackAcao";
import { botaoClasses } from "@/components/Botao";
import { useAcaoCliente } from "@/lib/acao-cliente";
import { CampoTexto } from "@/components/CampoTexto";
import { ConfirmarAcao, type FalhaConfirmacao } from "@/components/ConfirmarAcao";
import { formatarValores, somarPorMoeda, type ValorMoeda } from "@/lib/dinheiro";

function useChaveEstavel() {
  const router = useRouter();
  const chave = useRef(crypto.randomUUID());
  function depoisDoSucesso() {
    chave.current = crypto.randomUUID();
    router.refresh();
  }
  return { chave, depoisDoSucesso };
}

export type ItemMemoriaAcerto = { cobrancaId: string; moeda: string; devido: string; saldoDevido: string; creditoApurado: string };

export function resumoAplicacaoAcerto(itens: ItemMemoriaAcerto[]) {
  const credito = somarPorMoeda(itens.map((i: ItemMemoriaAcerto): ValorMoeda => ({ moeda: i.moeda, valor: Number(i.creditoApurado) }))).filter((v: ValorMoeda) => v.valor > 0);
  return { cobrancas: itens.length, credito };
}

export function PrepararAcertoContratualFormulario({ pedidoId, condicoesId, reapresentacao }: { pedidoId: string; condicoesId: string; reapresentacao?: { id: string; versao: number; aprovada: boolean } | null }) {
  const acao = useAcaoCliente({ idempotente: true });
  const tentativa = useChaveEstavel();
  async function preparar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const d = await acao.executar(() => prepararAcertoDesistenciaContratual({ pedidoId, condicoesId, motivo: String(f.get("motivo") ?? ""), ...(reapresentacao ? { anteriorId: reapresentacao.id, motivoReapresentacao: String(f.get("motivoReapresentacao") ?? "") } : {}), chaveIdempotencia: tentativa.chave.current }), "Memória contratual preparada. Outra pessoa autorizada deve decidir.");
    if (d?.tipo === "ok") tentativa.depoisDoSucesso();
  }
  return <form className="space-y-3 rounded border p-4" onSubmit={preparar}>
    <h2 className="text-lg font-medium">Preparar acerto pela regra contratual</h2><p>A memória reúne todas as cobranças, recebimentos, créditos já apurados e a versão contratual vigente. Não altera valores nesta etapa.</p>
    {reapresentacao && <p role="status">Reapresentação da versão {reapresentacao.versao}, antes {reapresentacao.aprovada ? "aprovada" : "rejeitada"}. Versões rejeitadas podem ser reapresentadas; após aprovação, uma mudança exige novo pedido da Secretaria e nova decisão sobre a desistência antes da ativação.</p>}
    <fieldset disabled={acao.ocupado}><label className="block">Motivo<CampoTexto name="motivo" required minLength={5} maxLength={3000} className="mt-1 block w-full rounded border p-2" /></label>{reapresentacao && <label className="mt-2 block">Motivo da reapresentação<CampoTexto name="motivoReapresentacao" required minLength={5} maxLength={3000} className="mt-1 block w-full rounded border p-2" /></label>}<button className={`${botaoClasses({ variante: "secundario", tamanho: "lg" })} mt-3`}>{acao.ocupado ? "Preparando…" : reapresentacao ? "Reapresentar memória contratual" : "Preparar memória contratual"}</button></fieldset><FeedbackAcao erro={acao.erro} sucesso={acao.sucesso} className="mt-3" />
  </form>;
}

export function DecidirAcertoContratualFormulario({ propostaId, fotografiaHash }: { propostaId: string; fotografiaHash: string }) {
  const acao = useAcaoCliente({ idempotente: true });
  const tentativa = useChaveEstavel();
  async function decidir(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const d = await acao.executar(() => decidirAcertoDesistenciaContratual({ propostaId, fotografiaHash, aprovada: f.get("decisao") === "aprovar", motivo: String(f.get("motivo") ?? ""), chaveIdempotencia: tentativa.chave.current }), "Decisão independente registrada.");
    if (d?.tipo === "ok") tentativa.depoisDoSucesso();
  }
  return <form className="space-y-3" onSubmit={decidir}>
    <fieldset disabled={acao.ocupado}><label>Decisão<select name="decisao" required className="ml-2 rounded border p-2"><option value="">Selecione</option><option value="aprovar">Aprovar acerto</option><option value="rejeitar">Rejeitar acerto</option></select></label><label className="mt-2 block">Justificativa<CampoTexto name="motivo" required minLength={5} maxLength={3000} className="mt-1 block w-full rounded border p-2" /></label><button className={`${botaoClasses({ variante: "secundario", tamanho: "lg" })} mt-3`}>{acao.ocupado ? "Registrando…" : "Registrar decisão independente"}</button></fieldset><FeedbackAcao erro={acao.erro} sucesso={acao.sucesso} className="mt-3" />
  </form>;
}

export function AplicarAcertoContratualFormulario({ decisaoId, itens }: { decisaoId: string; itens: ItemMemoriaAcerto[] }) {
  const acao = useAcaoCliente({ idempotente: true });
  const tentativa = useChaveEstavel();
  const [confirmando, setConfirmando] = useState(false);
  const resumo = resumoAplicacaoAcerto(itens);
  function avisarIncerto(falha: FalhaConfirmacao) {
    if (falha.tipo === "incerto") acao.setErro(falha.mensagem);
  }
  return <div className="space-y-2"><p>A aplicação ajusta os valores aprovados e cria crédito somente para excedente comprovado. A Secretaria ainda efetiva a desistência.</p><button disabled={acao.ocupado} className={botaoClasses({ variante: "secundario", tamanho: "lg" })} onClick={() => { acao.limpar(); setConfirmando(true); }}>Aplicar acerto aprovado</button><FeedbackAcao erro={acao.erro} sucesso={acao.sucesso} />
    {confirmando && <ConfirmarAcao
      titulo="Aplicar o acerto contratual aprovado?"
      confirmacao="aplicação do acerto"
      conferencia="Confirmo os valores acima."
      idempotente
      acao={() => aplicarAcertoDesistenciaContratual({ decisaoId, chaveIdempotencia: tentativa.chave.current })}
      aoConcluir={() => { setConfirmando(false); acao.setErro(null); acao.setSucesso("Acerto aplicado. A Secretaria pode efetivar a desistência."); tentativa.depoisDoSucesso(); }}
      aoFalhar={avisarIncerto}
      aoCancelar={() => setConfirmando(false)}
    >
      <p>{resumo.cobrancas === 1 ? "Será ajustada 1 cobrança" : `Serão ajustadas ${resumo.cobrancas} cobranças`} desta matrícula pelos valores da memória aprovada.</p>
      <p>{resumo.credito.length ? `Será criado crédito de ${formatarValores(resumo.credito)} (excedente comprovado).` : "Nenhum crédito será criado."}</p>
      <p>Os valores aplicados não são desfeitos por esta tela; uma mudança posterior exige reconferência.</p>
    </ConfirmarAcao>}
  </div>;
}
