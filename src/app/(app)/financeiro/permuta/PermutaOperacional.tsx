"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useRef, useState, useTransition } from "react";
import {
  confirmarServicoPermuta,
  decidirCompensacaoPermuta,
  prepararAcordoPermuta,
  proporCompensacaoPermuta,
} from "@/server/financeiro/permuta-servico";

type Opcao = { id: string; codigo: string; matriculaId: string; matricula: string; aluno: string; moeda: string; saldo: string; vencimento: string };
type Destino = { cobrancaId: string; valor: string };
type Proposta = { id: string; valor: string; destinos: Destino[]; decisao: { aprovada: boolean; efetivada?: boolean; motivo: string } | null };
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

type Resultado = { ok: boolean; erro?: string };
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
        setErro("Não foi possível confirmar o resultado. Repita a mesma operação com os mesmos dados.");
      } finally {
        pendente.current = false;
      }
    });
  }

  return <form onSubmit={enviar} className="space-y-2 rounded border p-3">
    <fieldset disabled={ocupado} className="space-y-2">
      <legend className="font-medium">{legenda}</legend>
      {children}
      <button type="submit" className="rounded border px-3 py-1">{ocupado ? "Enviando…" : "Registrar"}</button>
    </fieldset>
    {erro && <p role="alert" className="text-sm">{erro}</p>}
    <Mensagem mensagem={sucesso} />
  </form>;
}

function dados(formulario: HTMLFormElement) {
  return (formulario as HTMLFormElement & { __dadosPermuta: FormData }).__dadosPermuta;
}
const campo = (formulario: HTMLFormElement, nome: string) => String(dados(formulario).get(nome) ?? "").trim();

export function PermutaOperacional({ acordos, podeFinanceiro, podePedagogico, podeAprovar, opcoes = [] }: { opcoes?: Opcao[]; acordos: Acordo[]; podeFinanceiro: boolean; podePedagogico: boolean; podeAprovar: boolean }) {
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
      <label>Matrícula <select required name="matriculaId" value={matriculaSelecionada} onChange={e => selecionarMatricula(e.target.value)}><option value="">Selecione</option>{matriculas.map(c => <option key={c.matriculaId} value={c.matriculaId}>{c.aluno} · {c.matricula}</option>)}</select></label><label>Início <input required type="date" name="vigenciaInicio" /></label><label>Fim <input required type="date" name="vigenciaFim" /></label><label>Moeda <input required name="moeda" readOnly value={elegiveis[0]?.moeda ?? ""} /></label>
      <label>Unidade <select name="unidade"><option value="HORA">Hora</option><option value="AULA">Aula</option><option value="UNIDADE">Unidade</option></select></label><label>Quantidade <input required name="quantidadePactuada" inputMode="decimal" /></label><label>Valor por unidade <input required name="valorPorUnidade" inputMode="decimal" /></label>
      <label>Contrapartida <input required name="contrapartida" /></label><label>Fórmula objetiva <input required name="formulaDescricao" placeholder="2 horas x R$ 50,00" /></label><fieldset key={matriculaSelecionada}><legend>Mensalidades elegíveis: informe o limite apenas nas escolhidas</legend>{elegiveis.map(c => <label key={c.id} className="block">{c.codigo} · {c.vencimento} · saldo {c.moeda} {c.saldo}<input name={`limite:${c.id}`} inputMode="decimal" aria-label={`Limite ${c.codigo} ${c.vencimento}`} /></label>)}</fieldset>
    </Acao>}
    {acordos.map(acordo => <article key={acordo.id} className="space-y-3 rounded border p-3">
      <h2 className="font-medium">{acordo.matricula} · {acordo.moeda}</h2>
      <p>{acordo.quantidadePactuada} {acordo.unidade.toLowerCase()}{podeFinanceiro && <> × {acordo.valorPorUnidade} = {acordo.valorTotalPactuado}</>}. {acordo.contrapartida}</p>
      <p className="text-sm">{acordo.formulaDescricao}</p>
      {podePedagogico && <Acao legenda="Confirmar serviço por período" onSubmit={async formulario => confirmarServicoPermuta({ acordoId: acordo.id, periodoInicio: campo(formulario, "periodoInicio"), periodoFim: campo(formulario, "periodoFim"), quantidadeComprovada: campo(formulario, "quantidadeComprovada"), referenciaServico: campo(formulario, "referenciaServico"), evidencia: campo(formulario, "evidencia"), chaveIdempotencia: campo(formulario, "chaveIdempotencia") })}>
        <label>Início <input required type="date" name="periodoInicio" /></label><label>Fim <input required type="date" name="periodoFim" /></label><label>Quantidade efetiva <input required name="quantidadeComprovada" inputMode="decimal" /></label><label>Referência da prestação <input required name="referenciaServico" /></label><label>Evidência <input required name="evidencia" /></label>
      </Acao>}
      {acordo.confirmacoes.map(confirmacao => <section key={confirmacao.id} className="space-y-2 border-l pl-3">
        <p>{confirmacao.periodoInicio}–{confirmacao.periodoFim}: {confirmacao.quantidadeComprovada} ({confirmacao.referenciaServico})</p>
        {podeFinanceiro && <Acao legenda="Propor destinação da compensação" onSubmit={async formulario => proporCompensacaoPermuta({ confirmacaoId: confirmacao.id, destinos: acordo.cobrancas.filter(c => campo(formulario, `destino:${c.id}`)).map(c => ({ cobrancaId: c.id, valor: campo(formulario, `destino:${c.id}`) })), chaveIdempotencia: campo(formulario, "chaveIdempotencia") })}>
          <p>Distribua o valor comprovado; deixe vazias as cobranças que não participam.</p>
          {acordo.cobrancas.map(c => <label key={c.id} className="block">{c.codigo} · saldo {c.saldo ?? "—"} · limite {c.valorMaximo}<input name={`destino:${c.id}`} inputMode="decimal" aria-label={`Valor para ${c.codigo}`} /></label>)}
        </Acao>}
        {confirmacao.propostas.map(proposta => <div key={proposta.id} className="rounded border p-2">
          <p>Proposta de {proposta.valor}: {proposta.decisao ? (proposta.decisao.aprovada ? (proposta.decisao.efetivada ? "compensação aplicada" : "aprovada, aguardando conferência de aplicação") : "rejeitada") : "aguarda decisão independente"}</p>
          {podeAprovar && !proposta.decisao && <Acao legenda="Decidir proposta" onSubmit={async formulario => decidirCompensacaoPermuta({ propostaId: proposta.id, aprovar: campo(formulario, "aprovar") === "sim", motivo: campo(formulario, "motivo") })}>
            <label>Decisão <select name="aprovar"><option value="sim">Aprovar e compensar</option><option value="nao">Rejeitar</option></select></label><label>Motivo <input required name="motivo" /></label>
          </Acao>}
        </div>)}
      </section>)}
    </article>)}
  </div>;
}