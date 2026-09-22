import { ConferirReserva } from "@/app/(app)/secretaria/reservas/ConferirReserva";
import { consultarPendenciasPreparacao } from "@/server/secretaria/prontidao-preparacao";
import { DecidirPreco } from "./DecidirPreco";
import Link from "next/link";
import { Papel } from "@prisma/client";
import { exigirSessaoPagina } from "@/server/_shared";
import { consultarPreparacaoContratacao } from "@/server/matricula/preparacao-consulta";
import { formatarMoeda } from "@/lib/dinheiro";
import { consultarPreferenciaFusoEquipe } from "@/server/preferencias/fuso-exibicao";
import { formatarInstanteExibicao } from "@/server/operacao/fuso-exibicao";
export default async function PreparacaoDetalhePage({ params }: { params: Promise<{ id: string }> }) {
  const usuario = await exigirSessaoPagina(Papel.VENDEDOR, Papel.GERENTE_COMERCIAL, Papel.SECRETARIA_ACADEMICA);
  const preferencia = await consultarPreferenciaFusoEquipe();
  const fusoExibicao = (preferencia.ok ? preferencia.dado?.fusoExibicao : null) ?? null;
  const { id } = await params, resultado = await consultarPreparacaoContratacao({ matriculaId: id });
  if (!resultado.ok || !resultado.dado) return <p role="alert">{resultado.ok ? "Consulta indisponível." : resultado.erro}</p>;
  const { matricula: m, preparacao: p } = resultado.dado;
  const prontidao = usuario.papeis.some((p) => p === Papel.SECRETARIA_ACADEMICA || p === Papel.ADMINISTRADOR) ? await consultarPendenciasPreparacao(id) : null;
  const tipos: Record<string, string> = { MATRICULA: "Taxa de matrícula", MENSALIDADE: "Mensalidade", HORA_PARTICULAR: "Hora particular (60 minutos)" };
  const estados = { ATIVA: "Ativa", MANTIDA_PENDENCIA: "Mantida por pendência", EXPIRADA: "Expirada", UTILIZADA: "Utilizada", LIBERADA: "Liberada" };
  const fusoOrigem = p?.reserva?.janela.fusoAdmissao ?? p?.reservaParticular?.horarios[0]?.fusoOrigem ?? "UTC";
  const data = (d: Date, origem = fusoOrigem) => formatarInstanteExibicao(d, fusoExibicao, origem).texto;
  return <div className="space-y-4"><Link className="underline" href={`/secretaria?matriculaId=${id}`}>Voltar à contratação</Link><h1 className="text-2xl font-medium">Proposta da contratação · {m.codigo ?? "Em preparação"}</h1>
    <p>{m.aluno.primeiroNome} {m.aluno.sobrenome} · {m.produto.idioma.nome} · {m.produto.modalidade.nome} · {m.pais.nome}</p>
    {prontidao && <Link className="block underline" href={`/matriculas/${encodeURIComponent(id)}/desistencia`}>Pedido de desistência da preparação</Link>}
    {prontidao && <section className="space-y-2 rounded border p-4"><h2 className="text-xl">Pendências para conferência da Secretaria</h2>
      {!prontidao.ok || !prontidao.dado ? <p role="alert">{prontidao.ok ? "Diagnóstico indisponível." : prontidao.erro}</p> : <>
        {prontidao.dado.pendencias.length ? <ul className="list-disc pl-5">{prontidao.dado.pendencias.map((p) => <li key={p.codigo}>{p.descricao}</li>)}</ul> : <p>Conferências básicas atendidas; prossiga com a conferência contratual completa.</p>}
        <p>{prontidao.dado.proximasEtapas}</p>
      </>}
    </section>}
    {!p ? <p>Esta matrícula não possui o registro de preparação comercial. Consulte os documentos e o histórico da contratação.</p> : <>
      <p role="status">Condições propostas: conferência e aprovações pendentes.</p><p>Preparada por {p.preparador.nome} em {data(p.criadaEm)} · {formatarInstanteExibicao(p.criadaEm, fusoExibicao, fusoOrigem).fuso}</p>
      <dl className="space-y-2"><div><dt>Regime proposto</dt><dd>{tipos[p.regime]}</dd></div><div><dt>Taxa proposta</dt><dd>{formatarMoeda(Number(p.taxaProposta), p.moeda)}</dd></div><div><dt>Valor proposto por mensalidade ou hora</dt><dd>{formatarMoeda(Number(p.valorServicoProposto), p.moeda)}</dd></div></dl>
      <p className="whitespace-pre-wrap">{p.motivo}</p>
      <h2 className="text-xl">Regras de entrada registradas</h2>
      <p>Agenda registrada na preparação: {p.politicaEntrada?.formaAgenda === "TURMA" ? "Turma" : p.politicaEntrada?.formaAgenda === "PARTICULAR_GRADE_FIXA" ? "Particular com grade fixa" : p.politicaEntrada?.formaAgenda === "PARTICULAR_FLEXIVEL" ? "Particular com agenda flexível" : "Pendente de conferência"}.</p>
      <p>Taxa antes da assinatura: {p.politicaEntrada?.taxaPreviaAssinatura == null ? "Pendente de definição" : p.politicaEntrada.taxaPreviaAssinatura ? "Exigida" : "Não exigida antes da assinatura"}.</p>
      {p.regime === "MENSALIDADE" && <p>Primeira mensalidade paga para ativar: {p.politicaEntrada?.exigirPrimeiraMensalidade == null ? "Pendente de definição" : p.politicaEntrada.exigirPrimeiraMensalidade ? "Exigida" : "Não exigida"}.</p>}
      {p.regime === "HORA_PARTICULAR" && <p>Adiantamento inicial: {p.politicaEntrada?.adiantamentoHoraExigido == null ? "Pendente de definição" : p.politicaEntrada.adiantamentoHoraExigido ? "Exigido; valor e horas ainda devem ser conferidos" : "Dispensado"}.</p>}
      {p.adiantamentoProposto && <p>Adiantamento proposto: {p.adiantamentoProposto.minutos} minutos × {formatarMoeda(Number(p.adiantamentoProposto.valorHora), p.moeda)} por 60 minutos = {formatarMoeda(Number(p.adiantamentoProposto.valor), p.moeda)}. Valor sujeito à conferência; não comprova recebimento.</p>}
      <p>A regra exibida é a da preparação. Não comprova liberação de assinatura, cobrança ou pagamento.</p>
      <h2 className="text-xl">Referências de preço registradas na preparação</h2>
      {!p.referenciasConferiveis || !p.precosReferencia.length ? <p>Referências pendentes de conferência.</p> : <ul>{p.precosReferencia.map((v, i) => <li key={i}>{tipos[v.tipoCobranca]}: {formatarMoeda(Number(v.valor), v.moeda)}</li>)}</ul>}
      <p>Esses valores preservam a referência da proposta; não comprovam aprovação comercial ou recebimento.</p>
      <h2 className="text-xl">Conferência de desconto na preparação</h2>
      {!p.alcada ? <p>Esta preparação ainda não possui conferência de alçada registrada.</p> : <ul>{p.alcada.componentes.map((c) => <li key={c.tipo}>{tipos[c.tipo]} · {c.resultado === "DENTRO_ALCADA" ? "Dentro da alçada registrada" : c.resultado === "EXIGE_APROVACAO" ? "Exige aprovação comercial" : "Referência insuficiente: exige conferência"}{c.descontoPct !== null ? ` · Desconto acumulado: ${c.descontoPct}%` : ""} · {c.limitePct === null ? "Sem alçada de desconto configurada" : `Limite: ${c.limitePct}%`}</li>)}</ul>}
      {p.decisaoPreco && <section className="rounded border p-3"><h3>Decisão da exceção de preço: {p.decisaoPreco.aprovada ? "Aprovada" : "Rejeitada"}</h3><p>{p.decisaoPreco.decisor.nome} · {data(p.decisaoPreco.decididaEm)}</p><p className="whitespace-pre-wrap">{p.decisaoPreco.motivo}</p></section>}
      {p.decisaoDisponivel.impedimento && <p>{p.decisaoDisponivel.impedimento}</p>}
      {p.decisaoDisponivel.podeRejeitar && <DecidirPreco preparacaoId={p.id} podeAprovar={p.decisaoDisponivel.podeAprovar} />}
      <p>A análise preserva os limites da preparação e não substitui as demais conferências ou aprovações da contratação.</p>
      <h2 className="text-xl">Reserva vinculada à preparação</h2>
      {p.reserva && <p>{p.reserva.turma.codigo ?? p.reserva.turma.nome} · {estados[p.reserva.status]} · Prazo: {data(p.reserva.expiraEm)}</p>}
      {prontidao && p.reservaParticular?.status === "ATIVA" && p.reservaParticular.expiraEm <= new Date() && <ConferirReserva reservaId={p.reservaParticular.id} particular />}
      {p.reservaParticularOriginal && p.reservaParticularOriginal.id !== p.reservaParticular?.id && <p>Uma nova reserva substituiu a original. A reserva de origem permanece no histórico como {estados[p.reservaParticularOriginal.status]}.</p>}
      {prontidao && p.reservaParticular && ["EXPIRADA", "LIBERADA"].includes(p.reservaParticular.status) && <Link className="underline" href={`/matriculas/${id}/nova-reserva`}>Retomar com nova reserva particular</Link>}
      {p.reservaParticular && <><p>Particular · {estados[p.reservaParticular.status]} · Prazo: {data(p.reservaParticular.expiraEm)}</p><ul>{p.reservaParticular.horarios.map((h) => <li key={h.id}>{h.professor.nome} · {data(h.inicio, h.fusoOrigem)} — {data(h.fim, h.fusoOrigem)} · {formatarInstanteExibicao(h.inicio, fusoExibicao, h.fusoOrigem).fuso}</li>)}</ul><p>Confira o contrato e a emissão inicial com os horários reservados. O envio ao serviço de assinatura e a ativação desta particular ainda dependem da conclusão das integrações.</p></>}
      <p>{m.secretariaAssumiuEm ? "A Secretaria já assumiu a matrícula." : "Aguardando a Secretaria assumir a matrícula."}</p>
      <Link className="underline" href={`/matriculas/${id}/reserva`}>Consultar reserva atual da contratação</Link>
    </>}
  </div>;
}
