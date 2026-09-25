import Link from "next/link";
import { Papel } from "@prisma/client";
import { exigirSessaoPagina } from "@/server/_shared";
import { consultarDesistenciaPreparacao } from "@/server/matricula/desistencia-preparacao";
import { consultarPreferenciaFusoEquipe } from "@/server/preferencias/fuso-exibicao";
import { formatarInstanteExibicao } from "@/server/operacao/fuso-exibicao";
import { EfetivacaoFormulario } from "./EfetivacaoFormulario";
import { PedidoFormulario } from "./PedidoFormulario";
import { VoltarPara } from "@/components/VoltarPara";

function textoInstanteAdministrativo(iso: string, preferenciaFusoExibicao: string | null) {
  const exibicao = formatarInstanteExibicao(iso, preferenciaFusoExibicao, "UTC");
  return `${exibicao.texto} (horário exibido em ${exibicao.fuso}; origem UTC)`;
}

export default async function DesistenciaPage({ params }: { params: Promise<{ id: string }> }) {
  await exigirSessaoPagina(Papel.SECRETARIA_ACADEMICA, Papel.ADMINISTRADOR);
  const preferencia = await consultarPreferenciaFusoEquipe();
  const fusoExibicao = (preferencia.ok ? preferencia.dado?.fusoExibicao : null) ?? null;
  const { id } = await params;
  const resultado = await consultarDesistenciaPreparacao({ matriculaId: id });
  if (!resultado.ok || !resultado.dado) return <p role="alert">{resultado.ok ? "Consulta indisponível." : resultado.erro}</p>;
  const { conferencia, estadoHash, pedidos, podeEfetivar, efetivacao, decisaoFinanceiraId } = resultado.dado;
  return <section className="space-y-5">
    <VoltarPara href={`/matriculas/${encodeURIComponent(id)}/preparacao`} para="Preparação" />
    <p><Link className="underline" href={`/matriculas/${encodeURIComponent(id)}/desistencia/documentos`}>Conferir documentos e assinaturas</Link></p>
    <p><Link className="underline" href={`/matriculas/${encodeURIComponent(id)}/desistencia/administracao`}>Consultar decisão administrativa</Link></p>
    <h1 className="text-2xl font-medium">Pedido de desistência · {conferencia.codigo ?? "Matrícula em preparação"}</h1>
    <p>Confira esta contratação e registre a solicitação do cliente. O pedido não comprova a efetivação da desistência nem a devolução de valores.</p>
    {!efetivacao && <section className="space-y-2 rounded border p-4"><h2 className="text-lg font-medium">Conferências necessárias</h2>
      {conferencia.pendencias.length ? <ul className="list-disc pl-5">{conferencia.pendencias.map(item => <li key={item}>{item}</li>)}</ul> : <p>Nenhum avanço formal identificado nos registros consultados. A equipe ainda deve conferir os requisitos antes da efetivação.</p>}
      <p>{conferencia.reservas.length} reserva(s) registrada(s) · {conferencia.quantidadeProcessosAssinatura} processo(s) de assinatura.</p>
      <p>{conferencia.financeiro.quantidadeCobrancas} cobrança(s) · {conferencia.financeiro.informesAConferir} comprovante(s) a conferir · {conferencia.financeiro.quantidadeCreditos} crédito(s) para conferência.</p>
    </section>}
    {efetivacao && <section role="status" className="space-y-2 rounded border p-4">
      <h2 className="text-lg font-medium">Desistência efetivada</h2>
      <p>Executada por {efetivacao.executorNome} em {textoInstanteAdministrativo(efetivacao.aplicadaEmISO, fusoExibicao)}.</p>
      <p className="whitespace-pre-wrap">{efetivacao.motivo}</p>
      {(conferencia.quantidadeDocumentos > 0 || conferencia.quantidadeProcessosAssinatura > 0 || (!efetivacao.tratamentoFinanceiro && conferencia.financeiro.exigeConferenciaFinanceira)) && <p role="alert">Existem registros posteriores que exigem conferência da equipe. A desistência registrada permanece no histórico.</p>}
    </section>}
    {podeEfetivar && pedidos[0] && <EfetivacaoFormulario pedidoId={pedidos[0].id} estadoHash={estadoHash} decisaoFinanceiraId={decisaoFinanceiraId ?? undefined} />}
    {!efetivacao && !podeEfetivar && pedidos.length > 0 && conferencia.podeRegistrar && <p>Este caso permanece em conferência. Cobranças sem pagamento podem seguir para a conferência financeira. Casos com pagamento ou assinatura ainda precisam do fluxo de acerto específico.</p>}
    {conferencia.podeRegistrar && <PedidoFormulario key={estadoHash} matriculaId={id} estadoHash={estadoHash} />}
    <section className="space-y-3"><h2 className="text-lg font-medium">Últimos pedidos registrados</h2>
      {!pedidos.length && <p>Nenhum pedido registrado.</p>}
      {pedidos.map(p => <article key={p.id} className="space-y-1 rounded border p-3">
        <h3 className="font-medium">Versão {p.versao} · {p.registradorNome}</h3>
        <p>{textoInstanteAdministrativo(p.criadaEmISO, fusoExibicao)}</p>
        <p className="whitespace-pre-wrap">{p.motivo}</p><p className="whitespace-pre-wrap">{p.evidenciaPedido}</p>
        {!p.atual && efetivacao?.pedidoId !== p.id && <p className="text-sm text-amber-800">As condições mudaram desde este registro; refaça a conferência antes de prosseguir.</p>}
      </article>)}
      {pedidos.length === 20 && <p className="text-sm">Esta tela apresenta os vinte pedidos mais recentes.</p>}
    </section>
  </section>;
}
