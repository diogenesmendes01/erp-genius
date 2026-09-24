import Link from "next/link";
import { Papel } from "@prisma/client";
import { exigirSessaoPagina } from "@/server/_shared";
import { consultarConferenciaAssinatura } from "@/server/contratos/assinatura-conferencia";
import { ConferirAssinatura } from "../../ConferirAssinatura";
import { consultarConclusaoContratual } from "@/server/contratos/conclusao-consulta";
import { consultarAceiteOriginal } from "@/server/contratos/aceite";
import { ConferirAceite } from "../../ConferirAceite";
import { consultarPreferenciaFusoEquipe } from "@/server/preferencias/fuso-exibicao";
import { formatarInstanteExibicao } from "@/server/operacao/fuso-exibicao";
import { formatarMoeda } from "@/lib/dinheiro";

const textoInstanteAdministrativo = (valor: Date | string, preferenciaFusoExibicao: string | null) => {
  const exibicao = formatarInstanteExibicao(valor, preferenciaFusoExibicao, "UTC");
  return `${exibicao.texto} (horário exibido em ${exibicao.fuso}; origem UTC)`;
};

export default async function ConferenciaAssinaturaPage({ params, searchParams }: {
  params: Promise<{ id: string; artefatoId: string }>; searchParams: Promise<{ pagina?: string }>;
}) {
  await exigirSessaoPagina(Papel.SECRETARIA_ACADEMICA);
  const { id, artefatoId } = await params, pagina = Number((await searchParams).pagina ?? "1");
  const [r, preferencia] = await Promise.all([
    consultarConferenciaAssinatura({ matriculaId: id, artefatoId, pagina }),
    consultarPreferenciaFusoEquipe(),
  ]);
  if (!r.ok || !r.dado) return <p role="alert">{r.ok ? "Consulta indisponível." : r.erro}</p>;
  const d = r.dado, atual = d.revisao;
  const preferenciaFusoExibicao = (preferencia.ok ? preferencia.dado?.fusoExibicao : null) ?? null;
  const resultadoConclusao = await consultarConclusaoContratual({ matriculaId: id, artefatoId });
  const processo = resultadoConclusao.ok ? resultadoConclusao.dado : null;
  const consultaAceite = processo?.conclusao ? await consultarAceiteOriginal({ matriculaId: id, conclusaoId: processo.conclusao.id }) : null;
  const aceite = consultaAceite?.ok ? consultaAceite.dado : null;
  return <div className="space-y-4">
    <Link className="underline" href={`/matriculas/${id}/contrato`}>Voltar aos documentos da matrícula</Link>
    <h1 className="text-2xl">Conferência para assinatura</h1>
    <a className="underline" href={`/api/matriculas/${id}/originais/${artefatoId}/pdf`} target="_blank" rel="noopener noreferrer">Abrir original preservado</a>
    <p>O envio ao serviço de assinatura ainda não está disponível. Esta conferência registra a revisão; não comprova envio, assinatura ou aceite.</p>
    {!resultadoConclusao.ok && <p role="alert">{resultadoConclusao.erro}</p>}
    {processo && <section className="space-y-3 rounded border p-4"><h2 className="text-xl">Evidências do processo de assinatura</h2>
      <p>Serviço: {processo.fornecedor}. Ambiente: {processo.ambiente === "SANDBOX" ? "Teste — não comprova assinatura em produção" : "Produção"}.</p>
      <p>Estado do envio: {processo.estadoEnvio}. A evidência preservada não substitui a conferência final da Secretaria.</p>
      {processo.conclusao ? <><p>Conclusão registrada em {textoInstanteAdministrativo(processo.conclusao.concluidaEm, preferenciaFusoExibicao)}.</p>
        <ul>{processo.conclusao.assinaturas.map(a => <li key={a.papel}>{a.nome} — {a.papel.replaceAll("_", " ")} — {textoInstanteAdministrativo(a.assinadaEm, preferenciaFusoExibicao)}</li>)}</ul>
        <nav className="flex gap-4"><a className="underline" target="_blank" rel="noopener noreferrer" href={`/api/matriculas/${encodeURIComponent(id)}/assinaturas/${encodeURIComponent(processo.conclusao.id)}/pdf`}>Abrir PDF assinado</a>
          <a className="underline" href={`/api/matriculas/${encodeURIComponent(id)}/assinaturas/${encodeURIComponent(processo.conclusao.id)}/auditoria`}>Baixar auditoria preservada</a></nav>
      </> : <p>Ainda não há evidência de conclusão de todas as assinaturas exigidas.</p>}
    </section>}
    {d.pendencia && !aceite?.aceite && <p role="alert" className="rounded border p-3">{d.pendencia}</p>}
    {consultaAceite && !consultaAceite.ok && <p role="alert">{consultaAceite.erro}</p>}
    {aceite && <section className="space-y-3 rounded border p-4"><h2 className="text-xl">Conferência final do aceite</h2>
      {aceite.aceite && <><p>Aceite confirmado por {aceite.aceite.autor.nome}, em {textoInstanteAdministrativo(aceite.aceite.criadaEm, preferenciaFusoExibicao)}.</p><p>{aceite.aceite.motivo}</p></>}
      {aceite.pendencia && <p role="alert">{aceite.pendencia}</p>}
      {aceite.revisao && <><p>Condições da matrícula: versão {aceite.revisao.versaoCondicoes}. Conferir o aceite não ativa a matrícula.</p>
        <ul>{aceite.revisao.entrada.itens.map(i => <li key={i.id}>{i.tipo.replaceAll("_", " ")}: {formatarMoeda(i.valor, i.moeda)}. {i.confirmada ? "Recebimento confirmado." : "Recebimento ainda não confirmado."}</li>)}</ul>
        {!!aceite.revisao.entrada.emitirNaAtivacao.length && <p>Existe cobrança prevista para emissão na ativação, conforme as condições do contrato.</p>}
        <ConferirAceite key={aceite.revisao.hash} matriculaId={id} conclusaoId={aceite.revisao.conclusaoId} revisaoHash={aceite.revisao.hash} />
      </>}
    </section>}
    {atual && <section className="space-y-3">
      <h2 className="text-xl">Condições verificadas agora</h2>
      <p>{atual.dados.regraTaxa === "CONFIRMACAO_PREVIA_EXIGIDA" ? "Taxa confirmada exigida antes da assinatura." : "A oferta permite assinatura antes do pagamento da taxa."}</p>
      <p>Taxa: {formatarMoeda(atual.dados.taxa.valor, atual.dados.taxa.moeda)}. {atual.dados.taxa.confirmada ? "Recebimento confirmado." : "Recebimento ainda não confirmado."}</p>
      <p>Reserva {atual.dados.reserva.status === "MANTIDA_PENDENCIA" ? "mantida por pendência" : "ativa"}, com {atual.dados.agenda.length} encontro(s) futuros conferidos. Prazo registrado: {textoInstanteAdministrativo(atual.dados.reserva.expiraEm, preferenciaFusoExibicao)}.</p>
      {atual.dados.agendaParticular && <p className="whitespace-pre-line">{atual.dados.agendaParticular}</p>}
      <h3 className="text-lg">Participantes</h3>
      <ul>{atual.dados.participantes.map((p) => <li key={p.papel}>{p.nome} — {p.email}. {p.etapa === "CLIENTE" ? "Primeira etapa: cliente/responsáveis." : "Etapa posterior: escola."}</li>)}</ul>
      <ConferirAssinatura key={atual.hash} matriculaId={id} artefatoId={artefatoId} revisaoHash={atual.hash} />
    </section>}
    <section className="space-y-3"><h2 className="text-xl">Histórico de conferências</h2>
      {!d.historico.length && <p>Nenhuma conferência registrada.</p>}
      {d.historico.map((h) => <article className="rounded border p-3" key={h.id}>
        <p>{h.autor.nome}, {textoInstanteAdministrativo(h.criadaEm, preferenciaFusoExibicao)}.</p><p>{h.motivo}</p>
        <p>{atual?.hash === h.revisaoHash ? "Corresponde à revisão atual." : "Registro histórico; exige nova conferência antes de avançar."}</p>
      </article>)}
      {pagina > 1 && <Link className="underline mr-4" href={`?pagina=${pagina - 1}`}>Anteriores</Link>}
      {d.temProxima && <Link className="underline" href={`?pagina=${pagina + 1}`}>Próximos</Link>}
    </section>
  </div>;
}
