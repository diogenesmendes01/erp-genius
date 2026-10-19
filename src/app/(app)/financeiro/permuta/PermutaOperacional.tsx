"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useRef, useState, useTransition } from "react";
import {
  confirmarServicoPermuta,
  decidirCompensacaoPermuta,
  prepararAcordoPermuta,
  proporCompensacaoPermuta,
} from "@/server/financeiro/permuta-servico";
import { formatarInstanteExibicao } from "@/server/operacao/fuso-exibicao";
import { useInicioDoPeriodo } from "@/lib/periodo-form";
import { formatarMoeda, formatarMoedaOuIndefinida, MOEDA_NAO_DEFINIDA } from "@/lib/dinheiro";
import { formatarDataCivil } from "@/lib/data-civil";
import { botaoClasses } from "@/components/Botao";
import { ConfirmarAcao } from "@/components/ConfirmarAcao";
import { MSG_DECISAO_INCERTA, MSG_RESULTADO_INCERTO } from "@/lib/mensagens";
import { UNIDADE_PERMUTA_SERVICO_LABEL, rotular } from "@/lib/labels";

type Opcao = { id: string; codigo: string; matriculaId: string; matricula: string; aluno: string; moeda: string; saldo: string; vencimento: string };
type Destino = { cobrancaId: string; valor: string };
type Proposta = { id: string; valor: string; destinos: Destino[]; decisao: { aprovada: boolean; efetivada?: boolean; motivo: string; aplicacoes?: { id: string; cobrancaId: string; valor: string; aplicadaEm: string }[] } | null };
type Confirmacao = {
  id: string;
  periodoInicio: string;
  periodoFim: string;
  quantidadeComprovada: string;
  referenciaServico: string;
  evidencia: string;
  propostas: Proposta[];
};
type Acordo = {
  id: string;
  matriculaId: string;
  matricula: string;
  moeda: string | null;
  unidade: string;
  quantidadePactuada: string;
  valorPorUnidade: string | null;
  valorTotalPactuado: string | null;
  contrapartida: string;
  formulaDescricao: string | null;
  cobrancas: { id: string; codigo: string; saldo: string | null; valorMaximo: string }[];
  confirmacoes: Confirmacao[];
};

type Resultado = { ok: boolean; erro?: string; podeRevisar?: boolean };
const novaChave = () => crypto.randomUUID();

function Mensagem({ mensagem }: { mensagem: string | null }) {
  return mensagem ? <p role="status" className="text-sm">{mensagem}</p> : null;
}

function Acao({ onSubmit, children, legenda }: { onSubmit: (form: HTMLFormElement) => Promise<Resultado>; children: React.ReactNode; legenda: string }) {
  const router = useRouter();
  const tentativa = useRef<FormData | null>(null);
  const operacao = useRef<typeof onSubmit | null>(null);
  const chave = useRef(novaChave());
  const pendente = useRef(false);
  const [ocupado, iniciar] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);

  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (pendente.current) return;
    pendente.current = true;
    const formulario = evento.currentTarget;
    const dados = tentativa.current ?? new FormData(formulario);
    tentativa.current = dados;
    operacao.current ??= onSubmit;
    dados.set("chaveIdempotencia", chave.current);
    setErro(null);
    iniciar(async () => {
      try {
        const resultado = await operacao.current!(Object.assign(formulario, { __dadosPermuta: dados }));
        if (!resultado.ok) {
          if (resultado.podeRevisar) {
            tentativa.current = null;
            operacao.current = null;
            chave.current = novaChave();
          }
          setErro(resultado.erro ?? "Não foi possível concluir. Repita a mesma operação.");
          return;
        }
        setSucesso("Operação registrada. Confira o estado atualizado abaixo.");
        tentativa.current = null;
        operacao.current = null;
        formulario.reset();
        router.refresh();
        chave.current = novaChave();
      } catch {
        setErro(MSG_RESULTADO_INCERTO);
      } finally {
        pendente.current = false;
      }
    });
  }

  return <form onSubmit={enviar} className="space-y-2 rounded border p-3">
    <fieldset disabled={ocupado} className="space-y-2">
      <legend className="font-medium">{legenda}</legend>
      {children}
      <button type="submit" className={botaoClasses({ variante: "secundario", tamanho: "sm" })}>{ocupado ? "Enviando…" : "Registrar"}</button>
    </fieldset>
    {erro && <p role="alert" className="text-sm">{erro}</p>}
    <Mensagem mensagem={sucesso} />
  </form>;
}

// Estado próprio por formulário: o par de período também aparece uma vez por acordo, dentro de acordos.map.
function CamposPeriodo({ nomeInicio, nomeFim }: { nomeInicio: string; nomeFim: string }) {
  const periodo = useInicioDoPeriodo();
  return <><label>Início <input required type="date" name={nomeInicio} {...periodo.propsInicio} /></label><label>Fim <input required type="date" name={nomeFim} min={periodo.min} /></label></>;
}

function dados(formulario: HTMLFormElement) {
  return (formulario as HTMLFormElement & { __dadosPermuta: FormData }).__dadosPermuta;
}
const campo = (formulario: HTMLFormElement, nome: string) => String(dados(formulario).get(nome) ?? "").trim();

// Decidir a compensação (docs/42 L2142): a decisão nasce vazia e obrigatória (antes vinha em "Aprovar e compensar" e
// enviar sem tocar no campo abatia mensalidades), o botão diz a ação escolhida e aprovar só abre o ConfirmarAcao, que
// diz quanto sai de cada mensalidade. A action roda na confirmação e mostra a falha lá. Rejeitar não abate nada e
// continua direto. Repetir a mesma decisão com o mesmo motivo não grava de novo (servidor), então é idempotente.
export function DecidirCompensacao({ proposta, moeda, cobrancas }: { proposta: Proposta; moeda: string | null; cobrancas: Acordo["cobrancas"] }) {
  const router = useRouter();
  const [decisao, setDecisao] = useState<"" | "APROVAR" | "REJEITAR">("");
  const [motivo, setMotivo] = useState("");
  const [confirmando, setConfirmando] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const aprovar = decisao === "APROVAR", rejeitar = decisao === "REJEITAR";
  const motivoDecisao = motivo.trim();
  const valor = formatarMoedaOuIndefinida(proposta.valor, moeda);
  async function rejeitarDireto() {
    setOcupado(true); setErro(null);
    try {
      const r = await decidirCompensacaoPermuta({ propostaId: proposta.id, aprovar: false, motivo: motivoDecisao });
      if (!r.ok) setErro(r.erro); else router.refresh();
    } catch { setErro(MSG_DECISAO_INCERTA); } finally { setOcupado(false); }
  }
  return <form className="space-y-2 rounded border p-3" onSubmit={e => {
    e.preventDefault();
    if (ocupado || !decisao || !motivoDecisao) return;
    if (aprovar) { setErro(null); setConfirmando(true); return; }
    void rejeitarDireto();
  }}>
    <fieldset disabled={ocupado || confirmando} className="space-y-2">
      <legend className="font-medium">Decidir proposta</legend>
      <label>Decisão <select name="aprovar" required value={decisao} onChange={e => { setErro(null); setDecisao(e.target.value === "APROVAR" || e.target.value === "REJEITAR" ? e.target.value : ""); }}><option value="" disabled>Escolha a decisão</option><option value="APROVAR">Aprovar e compensar</option><option value="REJEITAR">Rejeitar</option></select></label>
      <label>Motivo <input required name="motivo" value={motivo} onChange={e => { setErro(null); setMotivo(e.target.value); }} /></label>
      <button type="submit" disabled={!decisao} className={botaoClasses({ variante: rejeitar ? "perigo" : "secundario", tamanho: "sm" })}>{ocupado ? "Enviando…" : rejeitar ? "Rejeitar" : aprovar ? "Aprovar e compensar" : "Decidir"}</button>
    </fieldset>
    {erro && <p role="alert" className="text-sm">{erro}</p>}
    {confirmando && <ConfirmarAcao titulo={`Aprovar a compensação de ${valor}?`} confirmacao={`compensação de ${valor}`} idempotente
      acao={() => decidirCompensacaoPermuta({ propostaId: proposta.id, aprovar: true, motivo: motivoDecisao })}
      aoConcluir={() => { setConfirmando(false); setDecisao(""); setMotivo(""); router.refresh(); }} aoCancelar={() => setConfirmando(false)}>
      <p>O valor do serviço sai do saldo destas mensalidades:</p>
      <ul className="list-disc pl-5">{proposta.destinos.map(d => <li key={d.cobrancaId}>{cobrancas.find(c => c.id === d.cobrancaId)?.codigo ?? "Mensalidade"}: {formatarMoedaOuIndefinida(d.valor, moeda)}</li>)}</ul>
      <p>Fica registrado como serviço compensado. Não é recebimento em dinheiro.</p>
      <p>Motivo registrado: {motivoDecisao}</p>
      <p>Não há desfazer pela tela.</p>
    </ConfirmarAcao>}
  </form>;
}

export function PermutaOperacional({ acordos, podeFinanceiro, podePedagogico, podeAprovar, opcoes = [], preferenciaFusoExibicao = null }: { opcoes?: Opcao[]; acordos: Acordo[]; podeFinanceiro: boolean; podePedagogico: boolean; podeAprovar: boolean; preferenciaFusoExibicao?: string | null }) {
  const [matriculaSelecionada, selecionarMatricula] = useState("");
  const elegiveis = opcoes.filter(c => c.matriculaId === matriculaSelecionada);
  const matriculas = [...new Map(opcoes.map(c => [c.matriculaId, c])).values()];
  return <div className="space-y-4">
    <p role="status" className="rounded border p-3">A compensação aprovada abate as mensalidades selecionadas com registro do serviço prestado. Não é um recebimento em dinheiro.</p>
    {podeFinanceiro && <Acao legenda="Preparar acordo de permuta" onSubmit={async formulario => prepararAcordoPermuta({
      matriculaId: campo(formulario, "matriculaId"), vigenciaInicio: campo(formulario, "vigenciaInicio"), vigenciaFim: campo(formulario, "vigenciaFim"), moeda: campo(formulario, "moeda"),
      unidade: campo(formulario, "unidade"), quantidadePactuada: campo(formulario, "quantidadePactuada"), valorPorUnidade: campo(formulario, "valorPorUnidade"), contrapartida: campo(formulario, "contrapartida"), formulaDescricao: campo(formulario, "formulaDescricao"),
      cobrancas: elegiveis.filter(c => campo(formulario, `limite:${c.id}`)).map(c => ({ cobrancaId: c.id, valorMaximo: campo(formulario, `limite:${c.id}`) })), chaveIdempotencia: campo(formulario, "chaveIdempotencia"),
    })}>
      <label>Matrícula <select required name="matriculaId" value={matriculaSelecionada} onChange={e => selecionarMatricula(e.target.value)}><option value="">Selecione</option>{matriculas.map(c => <option key={c.matriculaId} value={c.matriculaId}>{c.aluno} · {c.matricula}</option>)}</select></label><CamposPeriodo nomeInicio="vigenciaInicio" nomeFim="vigenciaFim" /><label>Moeda <input required name="moeda" readOnly value={elegiveis[0]?.moeda ?? ""} /></label>
      <label>Unidade <select name="unidade"><option value="HORA">Hora</option><option value="AULA">Aula</option><option value="UNIDADE">Unidade</option></select></label><label>Quantidade <input required name="quantidadePactuada" inputMode="decimal" /></label><label>Valor por unidade <input required name="valorPorUnidade" inputMode="decimal" /></label>
      <label>Contrapartida <input required name="contrapartida" /></label><label>Fórmula objetiva <input required name="formulaDescricao" placeholder="2 horas x R$ 50,00" /></label><fieldset key={matriculaSelecionada}><legend>Mensalidades elegíveis: informe o limite apenas nas escolhidas</legend>{elegiveis.map(c => <label key={c.id} className="block">{c.codigo} · {formatarDataCivil(c.vencimento)} · saldo {formatarMoeda(c.saldo, c.moeda)}<input name={`limite:${c.id}`} inputMode="decimal" aria-label={`Limite ${c.codigo} ${formatarDataCivil(c.vencimento)}`} /></label>)}</fieldset>
    </Acao>}
    {acordos.map(acordo => <article key={acordo.id} className="space-y-3 rounded border p-3">
      <h2 className="font-medium">{acordo.matricula} · {acordo.moeda ?? MOEDA_NAO_DEFINIDA}</h2>
      {/* Acordo sem moeda (issue #167, C20): nenhum valor sai sem símbolo — cada um vira "moeda não definida". */}
      {!acordo.moeda && <p className="text-sm text-amber-700">Moeda não definida neste acordo: os valores não são exibidos para não serem lidos em outra moeda.</p>}
      <p>{acordo.quantidadePactuada} {rotular(UNIDADE_PERMUTA_SERVICO_LABEL, acordo.unidade).toLowerCase()}{podeFinanceiro && <> × {acordo.valorPorUnidade != null ? formatarMoedaOuIndefinida(acordo.valorPorUnidade, acordo.moeda) : "—"} = {acordo.valorTotalPactuado != null ? formatarMoedaOuIndefinida(acordo.valorTotalPactuado, acordo.moeda) : "—"}</>}. {acordo.contrapartida}</p>
      <p className="text-sm">{acordo.formulaDescricao}</p>
      {podePedagogico && <Acao legenda="Confirmar serviço por período" onSubmit={async formulario => confirmarServicoPermuta({ acordoId: acordo.id, periodoInicio: campo(formulario, "periodoInicio"), periodoFim: campo(formulario, "periodoFim"), quantidadeComprovada: campo(formulario, "quantidadeComprovada"), referenciaServico: campo(formulario, "referenciaServico"), evidencia: campo(formulario, "evidencia"), chaveIdempotencia: campo(formulario, "chaveIdempotencia") })}>
        <CamposPeriodo nomeInicio="periodoInicio" nomeFim="periodoFim" /><label>Quantidade efetiva <input required name="quantidadeComprovada" inputMode="decimal" /></label><label>Referência da prestação <input required name="referenciaServico" /></label><label>Evidência <input required name="evidencia" /></label>
      </Acao>}
      {acordo.confirmacoes.map(confirmacao => <section key={confirmacao.id} className="space-y-2 border-l pl-3">
        <p>{confirmacao.periodoInicio}–{confirmacao.periodoFim}: {confirmacao.quantidadeComprovada} ({confirmacao.referenciaServico})</p>
        {podeFinanceiro && <Acao legenda="Propor destinação da compensação" onSubmit={async formulario => proporCompensacaoPermuta({ confirmacaoId: confirmacao.id, destinos: acordo.cobrancas.filter(c => campo(formulario, `destino:${c.id}`)).map(c => ({ cobrancaId: c.id, valor: campo(formulario, `destino:${c.id}`) })), chaveIdempotencia: campo(formulario, "chaveIdempotencia") })}>
          <p>Distribua o valor comprovado; deixe vazias as cobranças que não participam.</p>
          {acordo.cobrancas.map(c => <label key={c.id} className="block">{c.codigo} · saldo {c.saldo != null ? formatarMoedaOuIndefinida(c.saldo, acordo.moeda) : "—"} · limite {formatarMoedaOuIndefinida(c.valorMaximo, acordo.moeda)}<input name={`destino:${c.id}`} inputMode="decimal" aria-label={`Valor para ${c.codigo}`} /></label>)}
        </Acao>}
        {confirmacao.propostas.map(proposta => <div key={proposta.id} className="rounded border p-2">
          <p>Proposta de {formatarMoedaOuIndefinida(proposta.valor, acordo.moeda)}: {proposta.decisao ? (proposta.decisao.aprovada ? (proposta.decisao.efetivada ? "compensação aplicada" : "aprovada, aguardando conferência de aplicação") : "rejeitada") : "aguarda decisão independente"}</p>
          {proposta.decisao && <p className="text-sm">Motivo da decisão: {proposta.decisao.motivo}</p>}
          {!!proposta.decisao?.aplicacoes?.length && <details>
            <summary>Compensações aplicadas</summary>
            <ul>{proposta.decisao.aplicacoes.map(aplicacao => <li key={aplicacao.id}>
              {(() => { const exibicao = formatarInstanteExibicao(aplicacao.aplicadaEm, preferenciaFusoExibicao, "UTC"); return <>{acordo.cobrancas.find(c => c.id === aplicacao.cobrancaId)?.codigo ?? "Mensalidade"}: {formatarMoedaOuIndefinida(aplicacao.valor, acordo.moeda)} · {exibicao.texto} (horário exibido em {exibicao.fuso}; origem UTC) · serviço compensado</>; })()}
            </li>)}</ul>
          </details>}
          {podeAprovar && !proposta.decisao && <DecidirCompensacao proposta={proposta} moeda={acordo.moeda} cobrancas={acordo.cobrancas} />}
        </div>)}
      </section>)}
    </article>)}
  </div>;
}
