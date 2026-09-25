"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatarMoeda } from "@/lib/dinheiro";
import { solicitarRetomada, decidirRetomada } from "@/server/retomada/acoes";
import type { listarContextoRetomada, listarPropostasRetomada } from "@/server/retomada/consultas";
import { formatarInstanteExibicao } from "@/server/operacao/fuso-exibicao";
import { FeedbackAcao } from "@/components/FeedbackAcao";
import { useAcaoCliente } from "@/lib/acao-cliente";
import { formatarCompetencia } from "@/lib/data-civil";

type Contexto = NonNullable<Extract<Awaited<ReturnType<typeof listarContextoRetomada>>, { ok: true }>["dado"]>;
type Propostas = NonNullable<Extract<Awaited<ReturnType<typeof listarPropostasRetomada>>, { ok: true }>["dado"]>;
type Parcela = Contexto["parcelas"][number];
type Opcao = "MANTER_VENCIMENTOS" | "REPROGRAMAR_PARCELAS";
const campo = "w-full rounded-md border border-gray-300 bg-surface px-3 py-2 text-sm";
const botao = "rounded-md border border-gray-300 px-3 py-2 text-sm disabled:opacity-50";
const principal = "rounded-md bg-brand-solid px-3 py-2 text-sm font-medium text-white hover:brightness-95 disabled:opacity-50";
const rotuloOpcao = (opcao: Opcao) => opcao === "MANTER_VENCIMENTOS" ? "Manter vencimentos originais" : "Reprogramar parcelas restantes";
const data = (iso: string) => iso.slice(0, 10).split("-").reverse().join("/");

export function RetomadasPainel({ contexto, propostas, erroConsulta, preferenciaFusoExibicao = null }: { contexto?: Contexto | null; propostas: Propostas; erroConsulta?: string | null; preferenciaFusoExibicao?: string | null }) {
  const router = useRouter();
  const [opcao, setOpcao] = useState<Opcao | "">("");
  const [motivo, setMotivo] = useState("");
  const [datas, setDatas] = useState<Record<string, string>>({});
  const [motivosDecisao, setMotivosDecisao] = useState<Record<string, string>>({});
  // Proposta e decisão não recebem chave de idempotência (server/retomada/acoes.ts:29 e :63); o servidor
  // só reconhece a repetição idêntica pelo conteúdo (acoes.ts:47 e :75). Conferir antes de repetir.
  const acao = useAcaoCliente({ idempotente: false });
  // O resultado aparece junto da proposta nova ("proposta") ou da proposta decidida (id).
  const [alvo, setAlvo] = useState<string | null>(null);
  const ocupado = acao.ocupado;
  const hoje = contexto?.dataMinimaReprogramacao;
  const podePropor = contexto?.status === "PAUSADO" && !contexto.impedimento && !contexto.propostaPendenteId && !erroConsulta;
  const instanteAdministrativo = (valor: string) => {
    const exibicao = formatarInstanteExibicao(valor, preferenciaFusoExibicao, "UTC");
    return `${exibicao.texto} (horário exibido em ${exibicao.fuso}; origem UTC)`;
  };

  async function propor(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (!contexto || !opcao) return;
    setAlvo("proposta");
    const d = await acao.executar(() => solicitarRetomada(contexto.alunoId, {
      opcao, motivo,
      novosVencimentos: opcao === "REPROGRAMAR_PARCELAS" ? contexto.parcelas.map((p) => ({ cobrancaId: p.cobrancaId, vencimento: datas[p.cobrancaId] ?? p.vencimento.slice(0, 10) })) : [],
    }), "Proposta enviada. A retomada e os vencimentos aguardam aprovação de outra pessoa do Financeiro ou da Administração.");
    if (d?.tipo !== "ok") return;
    setOpcao(""); setMotivo(""); setDatas({});
    router.refresh();
  }

  async function decidir(id: string, aprovar: boolean) {
    setAlvo(id);
    const d = await acao.executar(() => decidirRetomada(id, { aprovar, motivo: motivosDecisao[id] ?? "" }), aprovar ? "Proposta aprovada. A retomada e o calendário foram aplicados." : "Proposta rejeitada. A situação dos contratos e os vencimentos foram preservados.");
    if (d?.tipo !== "ok") return;
    window.dispatchEvent(new Event("acesso-aulas-atualizado"));
    router.refresh();
  }

  return <section id="retomada" aria-label="Retomada após pausa" className="space-y-4 rounded-lg border border-gray-200 bg-surface p-4">
    <div>
      <h2 className="text-lg font-medium">Retomada após pausa</h2>
      <p className="mt-1 text-sm text-gray-500">A proposta precisa ser aprovada por outra pessoa do Financeiro ou da Administração antes de retomar o aluno e aplicar os vencimentos.</p>
    </div>
    {erroConsulta && <p role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-700">{erroConsulta}</p>}
    {contexto?.status === "PAUSADO" && contexto.impedimento && <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-800">{contexto.impedimento}</p>}
    {contexto?.propostaPendenteId && <p className="text-sm text-gray-600">Já existe uma proposta aguardando decisão. Confira os detalhes abaixo.</p>}

    {podePropor && contexto && <form onSubmit={propor} className="space-y-4 border-t border-gray-200 pt-4">
      {contexto.pausa && <p className="text-xs text-gray-500">Pausa em {instanteAdministrativo(contexto.pausa.criadoEm)}{contexto.pausa.motivo ? ` · ${contexto.pausa.motivo}` : ""}</p>}
      <fieldset disabled={ocupado} className="space-y-2">
        <legend className="mb-2 text-sm font-medium">Como devem ficar as parcelas restantes?</legend>
        {(["MANTER_VENCIMENTOS", "REPROGRAMAR_PARCELAS"] as const).map((valor) => <label key={valor} className="flex items-center gap-2 text-sm">
          <input type="radio" name="opcaoRetomada" value={valor} required checked={opcao === valor} onChange={() => setOpcao(valor)} />{rotuloOpcao(valor)}
        </label>)}
      </fieldset>
      {opcao === "MANTER_VENCIMENTOS" && <p className="text-sm text-gray-500">Manter os vencimentos pode conservar parcelas em atraso e a restrição automática após 30 dias.</p>}
      {opcao === "REPROGRAMAR_PARCELAS" && <p className="text-sm text-gray-500">Defina o novo vencimento de cada parcela. Os valores contratados e os pagamentos já registrados serão preservados.</p>}
      {contexto.parcelas.length > 0 ? <TabelaParcelas parcelas={contexto.parcelas} novaData={(p) => opcao === "REPROGRAMAR_PARCELAS" ? <input
        aria-label={`Novo vencimento ${p.codigo ?? formatarCompetencia(p.competencia, "da parcela")}`}
        type="date" className={campo} required min={hoje} disabled={ocupado}
        value={datas[p.cobrancaId] ?? p.vencimento.slice(0, 10)}
        onChange={(e) => setDatas((atual) => ({ ...atual, [p.cobrancaId]: e.target.value }))}
      /> : data(p.vencimento)} /> : <p className="text-sm text-gray-500">Não há mensalidades remanescentes para alterar. A retomada ainda exige aprovação.</p>}
      <label className="block text-sm font-medium">Motivo da proposta
        <textarea className={`${campo} mt-1 font-normal`} rows={3} required minLength={5} maxLength={2000} disabled={ocupado} value={motivo} onChange={(e) => setMotivo(e.target.value)} />
      </label>
      <button className={principal} type="submit" disabled={ocupado || !opcao || motivo.trim().length < 5}>Enviar proposta para aprovação</button>
    </form>}
    {/* Fora do formulário: no sucesso ele some (proposta pendente), e a confirmação continua visível. */}
    <FeedbackAcao erro={alvo === "proposta" ? acao.erro : null} sucesso={alvo === "proposta" ? acao.sucesso : undefined} />

    {propostas.length === 0 && !podePropor && !erroConsulta && <p className="text-sm text-gray-500">Nenhuma proposta de retomada.</p>}
    {propostas.map((p) => <article key={p.id} className="space-y-3 border-t border-gray-200 pt-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="font-medium"><Link className="text-brand-700 hover:underline" href={`/alunos/${p.alunoId}/financeiro#retomada`}>{p.alunoNome}</Link> · {rotuloOpcao(p.opcao)}</h3>
          <p className="text-xs text-gray-500">Proposta de {p.solicitante.nome} em {instanteAdministrativo(p.criadoEm)}</p>
        </div>
        <span className={`rounded-full px-2 py-1 text-xs ${p.status === "PENDENTE" ? "bg-amber-50 text-amber-800" : p.status === "APROVADA" ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-600"}`}>{p.status === "PENDENTE" ? "Aguardando aprovação" : p.status === "APROVADA" ? "Aprovada" : "Rejeitada"}</span>
      </div>
      <p className="whitespace-pre-wrap text-sm">{p.motivo}</p>
      {p.parcelas.length > 0 && <TabelaParcelas parcelas={p.parcelas} novaData={(parcela) => data(parcela.novoVencimento)} />}
      {p.aprovador && <p className="text-sm text-gray-600">Decisão de {p.aprovador.nome}{p.decididoEm ? ` em ${instanteAdministrativo(p.decididoEm)}` : ""}: {p.motivoDecisao}</p>}
      {p.podeDecidir && <div className="space-y-2">
        <label className="block text-sm">Motivo da decisão<textarea className={`${campo} mt-1`} rows={2} minLength={5} maxLength={2000} disabled={ocupado} value={motivosDecisao[p.id] ?? ""} onChange={(e) => setMotivosDecisao((atual) => ({ ...atual, [p.id]: e.target.value }))} /></label>
        <div className="flex gap-2">
          {!p.impedimentoAprovacao && <button className={principal} disabled={ocupado || (motivosDecisao[p.id] ?? "").trim().length < 5} onClick={() => decidir(p.id, true)}>Aprovar proposta e retomar</button>}
          <button className={botao} disabled={ocupado || (motivosDecisao[p.id] ?? "").trim().length < 5} onClick={() => decidir(p.id, false)}>Rejeitar proposta</button>
        </div>
      </div>}
      <FeedbackAcao erro={alvo === p.id ? acao.erro : null} sucesso={alvo === p.id ? acao.sucesso : undefined} />
      {p.status === "PENDENTE" && p.impedimentoAprovacao && <p className="text-sm text-amber-800">{p.impedimentoAprovacao} <Link className="underline" href={`/alunos/${p.alunoId}/movimentacoes`}>Consultar movimentações por matrícula</Link></p>}
      {p.status === "PENDENTE" && !p.podeDecidir && <p className="text-xs text-gray-500">Aguardando aprovação de outra pessoa do Financeiro ou da Administração.</p>}
    </article>)}
  </section>;
}

function TabelaParcelas<T extends Parcela>({ parcelas, novaData }: { parcelas: T[]; novaData: (parcela: T) => ReactNode }) {
  return <div className="overflow-x-auto rounded-md border border-gray-200">
    <table className="w-full text-left text-sm">
      <caption className="sr-only">Comparação do calendário atual com o calendário proposto</caption>
      <thead className="bg-gray-50 text-xs text-gray-600"><tr>{["Parcela", "Contratado", "Recebido", "Saldo restante", "Vencimento atual", "Vencimento proposto"].map((nome) => <th key={nome} className="whitespace-nowrap px-3 py-2 font-medium" scope="col">{nome}</th>)}</tr></thead>
      <tbody>{parcelas.map((p) => <tr key={p.cobrancaId} className="border-t border-gray-100">
        <th scope="row" className="px-3 py-2 font-normal"><span className="block">{p.codigo ?? `Mensalidade ${formatarCompetencia(p.competencia, "")}`}</span><span className="block text-xs text-gray-500">{p.matriculaCodigo ?? "Matrícula"}{p.restaurar ? " · suspensa pela pausa" : ""}</span></th>
        <td className="whitespace-nowrap px-3 py-2">{formatarMoeda(p.valorNegociado, p.moeda)}</td>
        <td className="whitespace-nowrap px-3 py-2">{formatarMoeda(p.valorRecebido, p.moeda)}</td>
        <td className="whitespace-nowrap px-3 py-2 font-medium">{formatarMoeda(p.saldo, p.moeda)}</td>
        <td className="whitespace-nowrap px-3 py-2">{data(p.vencimento)}</td>
        <td className="min-w-44 whitespace-nowrap px-3 py-2">{novaData(p)}</td>
      </tr>)}</tbody>
    </table>
  </div>;
}
