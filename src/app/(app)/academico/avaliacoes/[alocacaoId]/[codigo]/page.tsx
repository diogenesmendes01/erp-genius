import Link from "next/link";
import { Papel } from "@prisma/client";
import { exigirSessaoPagina } from "@/server/_shared";
import { consultarLancamentosAvaliacao } from "@/server/avaliacoes/lancamentos";
import { LancarNotas, ConferirNotas } from "./Formularios";
import { FusoInstitucionalSchema } from "@/server/operacao/fuso";
import { dataHoraAvaliacaoLocal } from "@/server/avaliacoes/tempo";
import { IdentificacaoAvaliacao } from "../../Identificacao";

const nomes = { FALA: "Fala", COMPREENSAO_ORAL: "Compreensão oral", LEITURA: "Leitura", ESCRITA: "Escrita" };
export default async function LancamentoPage({ params, searchParams }: {
  params: Promise<{ alocacaoId: string; codigo: string }>; searchParams: Promise<{ pagina?: string; fuso?: string }>;
}) {
  await exigirSessaoPagina(Papel.PROFESSOR, Papel.GERENTE_PEDAGOGICO);
  const { alocacaoId, codigo } = await params, busca = await searchParams, p = Number(busca.pagina ?? 1);
  const validacaoFuso = FusoInstitucionalSchema.safeParse(busca.fuso ?? "UTC");
  if (!validacaoFuso.success) return <div role="alert">Fuso inválido. <Link className="underline" href="?fuso=UTC">Voltar para UTC</Link></div>;
  const fuso = validacaoFuso.data, data = (d: Date) => `${d.toLocaleString("pt-BR", { timeZone: fuso })} (${fuso})`;
  const r = await consultarLancamentosAvaliacao({ alocacaoId, codigoAvaliacao: codigo, pagina: Number.isInteger(p) && p > 0 && p <= 100000 ? p : 1 });
  if (!r.ok || !r.dado) return <p role="alert">{r.ok ? "Consulta indisponível." : r.erro}</p>;
  const d = r.dado, c = d.contexto, anterior = d.versoes[0];
  return <section className="space-y-5">
    <Link className="underline" href={`/academico/avaliacoes/${encodeURIComponent(alocacaoId)}`}>Avaliações deste vínculo</Link>
    <h1 className="text-2xl font-medium">{c.avaliacao?.titulo ?? codigo} — {c.turma}</h1>
    <IdentificacaoAvaliacao dados={d.identificacao} />
    {d.podeGerirDesignacao && <Link className="block underline" href={`/academico/avaliacoes/${encodeURIComponent(alocacaoId)}/${encodeURIComponent(codigo)}/designacao`}>Gerenciar avaliador designado</Link>}
    <form method="get" className="space-y-2 rounded border p-3"><label className="block">Fuso para informar e visualizar horários<input name="fuso" list="fusos-avaliacao" required maxLength={100} defaultValue={fuso} className="block rounded border p-2" /></label>
      <datalist id="fusos-avaliacao"><option value="America/Sao_Paulo" /><option value="America/Costa_Rica" /><option value="UTC" /></datalist>
      <p>Use uma referência de região, como America/Sao_Paulo. A mudança de visualização preserva as datas já registradas. Salve o rascunho antes de trocar o fuso.</p>
      <button className="rounded border px-3 py-2">Aplicar fuso</button>
    </form>
    <p>Regra {c.regraVersao ?? "não vinculada"}. Oficializar uma avaliação não fecha o nível nem autoriza a progressão.</p>
    {!c.avaliacao && <p role="alert">Avaliação não encontrada na regra vinculada. Confira a configuração antes de lançar.</p>}
    {d.oficial && <p role="status">Esta avaliação possui notas oficiais. Alterações exigem o fluxo de correção com aprovação independente.</p>}
    {d.podeLancar && d.pagina === 1 && c.avaliacao && c.escala && <LancarNotas key={`${d.versaoEsperada}:${fuso}`} fuso={fuso} alocacaoId={alocacaoId} codigoAvaliacao={codigo} versaoEsperada={d.versaoEsperada} habilidades={c.avaliacao.habilidades} escala={c.escala}
      realizadores={d.realizadores} registradorId={d.registradorId}
      anterior={anterior ? { realizadaEm: dataHoraAvaliacaoLocal(anterior.realizadaEm, fuso), notas: anterior.notas } : null} />}
    <h2 className="text-xl font-medium">Histórico de lançamentos</h2>
    {!d.versoes.length && <p>Nenhuma nota registrada.</p>}
    {d.versoes.map(v => <article key={v.id} className="space-y-3 rounded border p-4">
      <h3 className="font-medium">Versão {v.versao} — {v.decisao ? v.decisao.aprovada ? "Oficializada" : "Devolvida" : v.submetida ? "Aguardando conferência" : "Rascunho"}</h3>
      <p>Realizada em {data(v.realizadaEm)}. Registrada por {v.autor.nome} em {data(v.criadaEm)}.</p>
      {v.realizadaPor && <p>Avaliação realizada por {v.realizadaPor.nome}.</p>}
      {v.motivoRegularizacao && <p className="whitespace-pre-wrap">Motivo da regularização: {v.motivoRegularizacao}</p>}
      {v.evidenciasRegularizacao && <p className="whitespace-pre-wrap">Evidências da regularização: {v.evidenciasRegularizacao}</p>}
      {v.notas.map(n => <div key={n.habilidade}><p><strong>{nomes[n.habilidade]}:</strong> {n.nota ?? "Nota pendente"}</p>{n.comentarioAluno && <p className="whitespace-pre-wrap">Comentário para o aluno: {n.comentarioAluno}</p>}</div>)}
      {v.vigente?.correcaoId && <section className="space-y-2 rounded border p-3"><h4 className="font-medium">Valores vigentes após correção aprovada</h4><p>Os valores acima permanecem como registro original.</p>{v.vigente.notas.map(n => <div key={n.habilidade}><p>{nomes[n.habilidade]}: {n.nota}</p>{n.comentarioAluno && <p className="whitespace-pre-wrap">{n.comentarioAluno}</p>}</div>)}</section>}
      {v.decisao && <p className="whitespace-pre-wrap">Decisão de {v.decisao.decisor.nome} em {data(v.decisao.criadaEm)}: {v.decisao.motivo}</p>}
      {v.vigente && <Link className="block underline" href={`/academico/correcoes/${encodeURIComponent(v.id)}`}>Propor correção ou consultar correções</Link>}
      {v.podeDecidir && <ConferirNotas lancamentoId={v.id} conteudoHash={v.conteudoHash} podeAprovar={v.podeAprovar} />}
    </article>)}
    <nav aria-label="Páginas do histórico" className="flex gap-4">{d.pagina > 1 && <Link href={`?fuso=${encodeURIComponent(fuso)}&pagina=${d.pagina - 1}`}>Anterior</Link>}<span>Página {d.pagina}</span>{d.temProxima && <Link href={`?fuso=${encodeURIComponent(fuso)}&pagina=${d.pagina + 1}`}>Próxima</Link>}</nav>
  </section>;
}
