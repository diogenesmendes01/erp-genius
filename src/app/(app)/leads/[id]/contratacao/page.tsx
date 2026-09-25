import Link from "next/link";
import { Papel } from "@prisma/client";
import { exigirSessaoPagina } from "@/server/_shared";
import { consultarCadastrosPreparacao, consultarOfertasPreparacao } from "@/server/matricula/preparacao-comercial";
import { PreparacaoFormulario } from "./PreparacaoFormulario";
import { VoltarPara } from "@/components/VoltarPara";
export default async function PreparacaoPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ofertaId?: string; ofertas?: string; cadastros?: string; turmas?: string }> }) {
  await exigirSessaoPagina(Papel.VENDEDOR, Papel.GERENTE_COMERCIAL, Papel.SECRETARIA_ACADEMICA);
  const { id } = await params, f = await searchParams;
  const [identidades, ofertas] = await Promise.all([consultarCadastrosPreparacao({ leadId: id, pagina: Number(f.cadastros ?? 1) }), consultarOfertasPreparacao({ leadId: id, ofertaId: f.ofertaId, pagina: Number(f.ofertas ?? 1), paginaTurmas: Number(f.turmas ?? 1) })]);
  if (!identidades.ok || !identidades.dado) return <p role="alert">{identidades.ok ? "Consulta indisponível." : identidades.erro}</p>;
  if (!ofertas.ok || !ofertas.dado) return <p role="alert">{ofertas.ok ? "Ofertas indisponíveis." : ofertas.erro}</p>;
  const c = identidades.dado, o = ofertas.dado;
  const url = (chave: string, valor: string) => { const p = new URLSearchParams(); for (const [k, v] of Object.entries(f)) if (v) p.set(k, v); p.set(chave, valor); if (chave === "ofertaId") p.delete("turmas"); return `?${p}`; };
  if (c.matriculaId) return <div className="space-y-3"><p>Esta negociação já possui contratação.</p><Link className="underline" href={`/matriculas/${c.matriculaId}/preparacao`}>Consultar contratação e reserva</Link></div>;
  return <div className="space-y-4"><VoltarPara href={`/leads/${id}`} para="Negociação" /><h1 className="text-2xl font-medium">Preparar contratação · {c.lead.nome}</h1>
    <p>Confira a identidade antes de selecionar. Um telefone compartilhado pode corresponder a mais de uma pessoa.</p>
    {!c.contatoConferivel && <p role="alert">Confira o contato com a Secretaria antes de continuar.</p>}
    {!c.candidatos.length && <p>{c.podeCadastrarNovo ? "Não há cadastro com o contato da negociação. Você poderá preencher os dados básicos de pessoa nova após conferir a identidade." : "Nenhum cadastro nesta página. Consulte as demais páginas ou confira a identidade com a Secretaria."}</p>}
    <nav className="flex gap-4" aria-label="Páginas dos cadastros">{c.pagina > 1 && <Link href={url("cadastros", String(c.pagina - 1))}>Cadastros anteriores</Link>}{c.possuiMais && <Link href={url("cadastros", String(c.pagina + 1))}>Mais cadastros</Link>}</nav>
    <h2 className="text-xl">Escolha a oferta</h2><div className="space-y-2">{o.ofertas.map((v) => <div key={v.id}><Link className="underline" href={url("ofertaId", v.id)}>{v.nome} · {v.moeda}</Link></div>)}</div>
    <nav className="flex gap-4" aria-label="Páginas das ofertas">{o.pagina > 1 && <Link href={url("ofertas", String(o.pagina - 1))}>Ofertas anteriores</Link>}{o.possuiMais && <Link href={url("ofertas", String(o.pagina + 1))}>Mais ofertas</Link>}</nav>
    {o.selecionada && <><h2 className="text-xl">Oferta selecionada: {o.selecionada.nome}</h2>{!o.selecionada.moedaCoerente && <p role="alert">A Administração precisa conferir a moeda desta oferta.</p>}
      {!o.prazoMinutos && <p role="alert">A Administração precisa configurar o prazo inicial da reserva.</p>}
      <p>Prazo inicial de reserva: {o.prazoMinutos ?? "Não configurado"} minutos. A disponibilidade será conferida novamente no envio.</p>
      {!o.selecionada.formaAgenda?.startsWith("PARTICULAR_") && <><h3 className="font-medium">Turmas compatíveis nesta página</h3>{o.turmas.map((t) => <p key={t.id}>{t.nome} · {t.vagas ?? "A conferir"} vaga(s) · {t.elegivel ? "Disponível para conferência final" : "Indisponível: conferir janela, agenda e capacidade com a Secretaria"}</p>)}
      <nav className="flex gap-4" aria-label="Páginas das turmas">{o.paginaTurmas > 1 && <Link href={url("turmas", String(o.paginaTurmas - 1))}>Turmas anteriores</Link>}{o.possuiMaisTurmas && <Link href={url("turmas", String(o.paginaTurmas + 1))}>Mais turmas</Link>}</nav></>}
      {!!o.prazoMinutos && o.selecionada.moedaCoerente && <PreparacaoFormulario key={`${o.selecionada.id}:${o.selecionada.versaoEntrada}:${c.pagina}:${o.paginaTurmas}`} leadId={id} novaPessoa={c.podeCadastrarNovo} paises={c.paisesCadastro} oferta={o.selecionada} candidatos={c.candidatos} turmas={o.turmas.filter((t) => t.elegivel)} />}
    </>}
  </div>;
}
