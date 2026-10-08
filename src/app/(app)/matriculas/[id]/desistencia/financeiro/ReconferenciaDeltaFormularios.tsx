"use client";

import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { aplicarReconferenciaDeltaDesistencia, decidirAdministrativamenteReconferenciaDeltaDesistencia, decidirReconferenciaDeltaDesistencia, prepararReconferenciaDeltaDesistencia } from "@/server/matricula/desistencia-reconferencia-delta";
import { FeedbackAcao } from "@/components/FeedbackAcao";
import { botaoClasses } from "@/components/Botao";
import { MSG_RESULTADO_INCERTO } from "@/lib/mensagens";
import { CampoTexto } from "@/components/CampoTexto";
import { ConfirmarAcao, type FalhaConfirmacao } from "@/components/ConfirmarAcao";
import { formatarValores, somarPorMoeda, type ValorMoeda } from "@/lib/dinheiro";

type ResultadoAcao = { ok: boolean; erro?: string };
type Tentativa = { acao: () => Promise<ResultadoAcao>; sucesso: string };

const SUCESSO_APLICACAO = "Reconferência aplicada. A Secretaria ainda precisa efetivar a desistência.";

// Erro e sucesso em estados separados (docs/43 §6 item 2): o erro — recusa do servidor ou resultado incerto —
// sai em role="alert" e o sucesso em role="status", pelo <FeedbackAcao> junto dos botões. A tentativa incerta,
// a chave estável e a reconciliação (ReconciliarTentativaDelta) continuam como antes.

function useOperacaoDelta() {
  const router = useRouter();
  const chave = useRef(crypto.randomUUID());
  const tentativa = useRef<Tentativa | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [incerta, setIncerta] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);

  async function executar(novaTentativa?: Tentativa) {
    const atual = tentativa.current ?? novaTentativa;
    if (!atual || ocupado) return;
    tentativa.current = atual;
    setOcupado(true);
    setErro(null);
    setSucesso(null);
    try {
      const resultado = await atual.acao();
      if (!resultado.ok) {
        tentativa.current = null;
        chave.current = crypto.randomUUID();
        setIncerta(false);
        setErro(resultado.erro ?? "Não foi possível concluir a operação.");
        return;
      }
      tentativa.current = null;
      chave.current = crypto.randomUUID();
      setIncerta(false);
      setSucesso(atual.sucesso);
      router.refresh();
    } catch {
      setIncerta(true);
      setErro(MSG_RESULTADO_INCERTO);
    } finally {
      setOcupado(false);
    }
  }

  // Aplicação executada fora daqui (ConfirmarAcao), com as mesmas regras de chave do `executar`: sucesso
  // e erro de negócio trocam a chave; resultado incerto a mantém e trava a tela até reconciliar.
  function concluirAplicacao() {
    tentativa.current = null;
    chave.current = crypto.randomUUID();
    setIncerta(false);
    setErro(null);
    setSucesso(SUCESSO_APLICACAO);
    router.refresh();
  }
  /** Erro de negócio: a mensagem já está no diálogo, que fica aberto. Incerto: fica também aqui, como erro. */
  function registrarFalha(falha: FalhaConfirmacao) {
    tentativa.current = null;
    setSucesso(null);
    if (falha.tipo === "erro") {
      chave.current = crypto.randomUUID();
      setIncerta(false);
      return;
    }
    setIncerta(true);
    setErro(falha.mensagem);
  }

  return { ocupado, incerta, erro, sucesso, chave, iniciar: executar, reconciliar: () => executar(), concluirAplicacao, registrarFalha };
}

/** Reconcilia a tentativa incerta: reenvia a mesma (mesma chave) — ou, na aplicação, reabre a confirmação. */
function ReconciliarTentativaDelta({ op, aoReconciliar }: { op: ReturnType<typeof useOperacaoDelta>; aoReconciliar?: () => void }) {
  return op.incerta && <button type="button" disabled={op.ocupado} className={botaoClasses({ variante: "secundario", tamanho: "lg" })} onClick={async () => { if (aoReconciliar) aoReconciliar(); else await op.reconciliar(); }}>
    {op.ocupado ? "Reconciliando…" : "Reconciliar mesma tentativa"}
  </button>;
}

export function PrepararReconferenciaDeltaFormulario({ aplicacaoBaseId }: { aplicacaoBaseId: string }) {
  const op = useOperacaoDelta();
  return <form className="space-y-3 rounded border p-4" onSubmit={async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const dados = new FormData(event.currentTarget);
    const entrada = { aplicacaoBaseId, motivo: String(dados.get("motivo") ?? ""), chaveIdempotencia: op.chave.current };
    await op.iniciar({ acao: () => prepararReconferenciaDeltaDesistencia(entrada), sucesso: "Reconferência preparada. As decisões financeira e administrativa são independentes." });
  }}>
    <h3 className="font-medium">Reconferir somente a diferença</h3><p>O servidor relê caixa, origens, créditos e saldo disponível. Esta etapa não remove recebimentos nem recria créditos externos.</p>
    <fieldset disabled={op.ocupado || op.incerta}><label className="block">Motivo<CampoTexto name="motivo" required minLength={5} maxLength={3000} className="mt-1 block w-full rounded border p-2" /></label><button className={`${botaoClasses({ variante: "secundario", tamanho: "lg" })} mt-3`}>{op.ocupado ? "Preparando…" : "Preparar reconferência"}</button></fieldset><ReconciliarTentativaDelta op={op} /><FeedbackAcao erro={op.erro} sucesso={op.sucesso} className="mt-3" />
  </form>;
}

export function DecidirReconferenciaDeltaFormulario({ propostaId, fotografiaHash, administrativo }: { propostaId: string; fotografiaHash: string; administrativo: boolean }) {
  const op = useOperacaoDelta();
  const decidir = administrativo ? decidirAdministrativamenteReconferenciaDeltaDesistencia : decidirReconferenciaDeltaDesistencia;
  return <form className="space-y-3" onSubmit={async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const dados = new FormData(event.currentTarget);
    const entrada = { propostaId, fotografiaHash, aprovada: dados.get("decisao") === "aprovar", motivo: String(dados.get("motivo") ?? ""), chaveIdempotencia: op.chave.current };
    await op.iniciar({ acao: () => decidir(entrada), sucesso: "Decisão independente registrada." });
  }}>
    <fieldset disabled={op.ocupado || op.incerta}><label>Decisão<select name="decisao" required className="ml-2 rounded border p-2"><option value="">Selecione</option><option value="aprovar">Aprovar</option><option value="rejeitar">Rejeitar</option></select></label><label className="mt-2 block">Justificativa<CampoTexto name="motivo" required minLength={5} maxLength={3000} className="mt-1 block w-full rounded border p-2" /></label><button className={`${botaoClasses({ variante: "secundario", tamanho: "lg" })} mt-3`}>{op.ocupado ? "Registrando…" : administrativo ? "Registrar decisão administrativa" : "Registrar decisão financeira"}</button></fieldset><ReconciliarTentativaDelta op={op} /><FeedbackAcao erro={op.erro} sucesso={op.sucesso} className="mt-3" />
  </form>;
}

/** Item da memória da reconferência, como a página o recebe (valores em texto decimal). */
export type ItemMemoriaDelta = { cobrancaId: string; moeda: string; ajusteDevido: string; ajusteSaldo: string; creditoDelta: string; reducaoCredito: string };

/** O que a aplicação da reconferência faz, em números: cobranças com ajuste, crédito novo e redução bloqueada. */
export function resumoAplicacaoDelta(itens: ItemMemoriaDelta[]) {
  const comAjuste = itens.filter((i: ItemMemoriaDelta) => Number(i.ajusteDevido) !== 0 || Number(i.ajusteSaldo) !== 0).length;
  const credito = somarPorMoeda(itens.map((i: ItemMemoriaDelta): ValorMoeda => ({ moeda: i.moeda, valor: Number(i.creditoDelta) }))).filter((v: ValorMoeda) => v.valor > 0);
  const reducao = somarPorMoeda(itens.map((i: ItemMemoriaDelta): ValorMoeda => ({ moeda: i.moeda, valor: Number(i.reducaoCredito) }))).filter((v: ValorMoeda) => v.valor > 0);
  return { comAjuste, credito, reducao, semDiferenca: comAjuste === 0 && credito.length === 0 && reducao.length === 0 };
}

export function AplicarReconferenciaDeltaFormulario({ decisaoFinanceiraId, itens }: { decisaoFinanceiraId: string; itens: ItemMemoriaDelta[] }) {
  const op = useOperacaoDelta();
  // Ajusta cobranças e cria crédito com um clique (docs/42 L799): o botão só revela o resumo; a aplicação
  // exige marcar "Confirmo os valores acima". Resultado incerto mantém a chave e a reconciliação reabre a
  // confirmação — o reenvio é a MESMA tentativa.
  const [confirmando, setConfirmando] = useState(false);
  const resumo = resumoAplicacaoDelta(itens);
  return <div className="space-y-2"><p>Aplica somente os ajustes calculados. Uma reconferência sem diferença é concluída sem criar novo crédito.</p><button disabled={op.ocupado || op.incerta} className={botaoClasses({ variante: "secundario", tamanho: "lg" })} onClick={() => setConfirmando(true)}>Aplicar reconferência</button><ReconciliarTentativaDelta op={op} aoReconciliar={() => setConfirmando(true)} /><FeedbackAcao erro={op.erro} sucesso={op.sucesso} />
    {confirmando && <ConfirmarAcao
      titulo="Aplicar a reconferência aprovada?"
      confirmacao="aplicação da reconferência"
      conferencia="Confirmo os valores acima."
      idempotente
      acao={() => aplicarReconferenciaDeltaDesistencia({ decisaoFinanceiraId, chaveIdempotencia: op.chave.current })}
      aoConcluir={() => { setConfirmando(false); op.concluirAplicacao(); }}
      aoFalhar={(falha: FalhaConfirmacao) => op.registrarFalha(falha)}
      aoCancelar={() => setConfirmando(false)}
    >
      {resumo.semDiferenca
        ? <p>Sem diferença a aplicar: a reconferência é concluída sem ajustar cobranças e sem criar crédito.</p>
        : <>
          <p>{resumo.comAjuste === 1 ? "Será ajustada 1 cobrança" : `Serão ajustadas ${resumo.comAjuste} cobranças`} desta matrícula pela diferença aprovada.</p>
          <p>{resumo.credito.length ? `Será criado crédito novo de ${formatarValores(resumo.credito)}.` : "Nenhum crédito novo será criado."}</p>
          {resumo.reducao.length > 0 && <p>Redução de crédito bloqueada: <strong>{formatarValores(resumo.reducao)}</strong>.</p>}
        </>}
      <p>Recebimentos, créditos e origens anteriores ficam preservados. A aplicação não é desfeita por esta tela.</p>
    </ConfirmarAcao>}
  </div>;
}
