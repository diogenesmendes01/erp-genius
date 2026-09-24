import Link from "next/link";
import { consultarConferenciasParticipantesAditivo } from "@/server/contratos/aditivo-participantes";
import { formatarInstanteExibicao, resolverFusoExibicao } from "@/server/operacao/fuso-exibicao";
import { rotular } from "@/lib/labels";
import { PAPEIS_MODELO } from "@/app/(app)/configuracao/contratos/labels";

export async function ParticipantesHistorico({ matriculaId, propostaId, pagina, preferenciaFusoExibicao = null }: { matriculaId: string; propostaId: string; pagina: number; preferenciaFusoExibicao?: string | null }) {
  const r = await consultarConferenciasParticipantesAditivo({ matriculaId, propostaId, pagina });
  if (!r.ok || !r.dado) return <p role="alert">{r.ok ? "Histórico indisponível." : r.erro}</p>;
  const d = r.dado, href = (p: number) => `/matriculas/${encodeURIComponent(matriculaId)}/contrato/aditivos/${encodeURIComponent(propostaId)}?paginaConferencias=${p}`;
  const fusoExibicao = resolverFusoExibicao(preferenciaFusoExibicao, "UTC");
  const data = (valor: Date | string) => `${formatarInstanteExibicao(valor, fusoExibicao, "UTC").texto} (${fusoExibicao}; origem UTC)`;
  return <section className="space-y-3 rounded border p-4"><h2 className="text-xl">Histórico de conferências dos signatários</h2>
    <p>Identificações e evidências preservadas em cada conferência. As assinaturas serão coletadas em etapa própria.</p>
    {!d.registros.length && <p>Nenhuma conferência nesta página.</p>}
    {d.registros.map(c => <details key={c.id} className="space-y-2 rounded border p-3"><summary>Versão {c.versao} · {c.autor} · {data(c.criadaEm)}</summary>
      <p className="whitespace-pre-wrap">{c.motivo}</p>
      {c.maioridade && <div><p>Maioridade: {c.maioridade.classificacao === "MAIOR" ? "Maior" : "Menor"}</p><p className="whitespace-pre-wrap">Critério: {c.maioridade.criterio}</p><p>Evidência: {c.maioridade.evidencia.nome}</p></div>}
      {c.participantes.map(p => <div key={p.papel} className="border-t pt-2"><h3 className="font-medium">{rotular(PAPEIS_MODELO, p.papel)} · {p.etapa === "CLIENTE" ? "Cliente" : "Escola"}</h3>
        <p>{p.identidade.nome}</p><p>{p.identidade.email}</p><p>Documento: {p.identidade.documento}</p>
        {p.representacao && <><p className="whitespace-pre-wrap">Representação: {p.representacao.descricao}</p><p>Evidência: {p.representacao.evidencia.nome}</p></>}
      </div>)}
    </details>)}
    <nav aria-label="Páginas das conferências" className="flex gap-3">{pagina > 1 && <Link className="underline" href={href(pagina - 1)}>Conferências anteriores</Link>}<span>Página {pagina}</span>{d.maisRegistros && <Link className="underline" href={href(pagina + 1)}>Próximas conferências</Link>}</nav>
  </section>;
}
