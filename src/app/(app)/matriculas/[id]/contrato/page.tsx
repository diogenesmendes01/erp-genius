import Link from "next/link";
import { Papel } from "@prisma/client";
import { exigirSessaoPagina } from "@/server/_shared";
import { consultarPainelPrevias, consultarPreenchimentoContratual } from "@/server/contratos/previas";
import { TextoPreviaSchema } from "@/server/contratos/previa-projecao";
import { TextoPrevia } from "./TextoPrevia";
import { RegistrarPrevia } from "./RegistrarPrevia";
import { consultarPreferenciaFusoEquipe } from "@/server/preferencias/fuso-exibicao";
import { formatarInstanteExibicao } from "@/server/operacao/fuso-exibicao";
import { VoltarPara } from "@/components/VoltarPara";
const pagina = (v?: string) => { const n = Number(v ?? 1); return Number.isInteger(n) && n > 0 && n <= 100000 ? n : 1; };
const textoInstanteAdministrativo = (valor: Date | string, preferenciaFusoExibicao: string | null) => {
  const exibicao = formatarInstanteExibicao(valor, preferenciaFusoExibicao, "UTC");
  return `${exibicao.texto} (horário exibido em ${exibicao.fuso}; origem UTC)`;
};

export default async function ContratoPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ modelo?: string; modelos?: string; historico?: string }> }) {
  await exigirSessaoPagina(Papel.SECRETARIA_ACADEMICA);
  const { id } = await params, s = await searchParams;
  const [r, preferencia] = await Promise.all([
    consultarPainelPrevias({ matriculaId: id, paginaModelos: pagina(s.modelos), paginaHistorico: pagina(s.historico) }),
    consultarPreferenciaFusoEquipe(),
  ]);
  if (!r.ok || !r.dado) return <p role="alert">{r.ok ? "Consulta indisponível." : r.erro}</p>;
  const d = r.dado, base = `/matriculas/${id}/contrato`;
  const preferenciaFusoExibicao = (preferencia.ok ? preferencia.dado?.fusoExibicao : null) ?? null;
  const revisao = d.podePreparar && s.modelo ? await consultarPreenchimentoContratual({ matriculaId: id, modeloId: s.modelo }) : null;
  const texto = revisao?.ok && revisao.dado ? TextoPreviaSchema.safeParse(revisao.dado.snapshot) : null;
  return <div className="space-y-5">
    <VoltarPara href="/secretaria" />
    <h1 className="text-2xl">Prévia contratual · {d.matricula.aluno}</h1>
    <Link className="underline" href={`${base}/substituicoes`}>Revisar substituição de contrato enviado</Link>
    <Link className="underline" href={`${base}/aditivos`}>Preparar aditivo após assinatura completa</Link>
    <p>Matrícula {d.matricula.codigo ?? "em preparação"}. Revise o conteúdo preenchido e preserve uma prévia. O PDF pode ser aberto na prévia preservada; o encaminhamento para assinatura ainda não está disponível.</p>
    <nav className="flex flex-wrap gap-4"><Link className="underline" href={`/matriculas/${id}/pagador`}>Conferir pagador</Link><Link className="underline" href={`/matriculas/${id}/condicoes`}>Conferir condições</Link></nav>
    {d.podePreparar ? <section className="space-y-3"><h2 className="text-xl">Escolher versão publicada</h2>
      <p>Confira a aplicação do modelo. A lista filtra o regime de cobrança; as demais condições precisam ser conferidas pela equipe.</p>
      {d.modelos.length ? <ul className="space-y-2">{d.modelos.map((m) => <li key={m.id} className="rounded border p-3"><Link className="underline" href={`${base}?modelo=${m.id}&modelos=${d.paginaModelos}&historico=${d.paginaHistorico}`}>{m.codigo} · versão {m.versao} · {m.titulo}</Link><p className="whitespace-pre-wrap">{m.aplicacao}</p></li>)}</ul> : <p>Nenhum modelo publicado disponível nesta página para o regime da matrícula.</p>}
      <nav className="flex gap-4" aria-label="Páginas dos modelos publicados">{d.paginaModelos > 1 && <Link href={`${base}?modelos=${d.paginaModelos - 1}&historico=${d.paginaHistorico}`}>Modelos anteriores</Link>}<span>Página {d.paginaModelos}</span>{d.maisModelos && <Link href={`${base}?modelos=${d.paginaModelos + 1}&historico=${d.paginaHistorico}`}>Mais modelos</Link>}</nav>
    </section> : <p role="status">Novas prévias exigem matrícula em preparação assumida pela Secretaria e ainda sem aceite confirmado. O histórico permanece disponível.</p>}
    {revisao && !revisao.ok && <p role="alert">{revisao.erro}</p>}
    {texto && !texto.success && <p role="alert">Conteúdo de prévia inválido. Encaminhe para conferência.</p>}
    {texto?.success && revisao?.ok && revisao.dado && s.modelo && <section className="space-y-4 rounded border p-4"><h2 className="text-xl">Revisão antes do registro</h2><TextoPrevia dados={texto.data} /><RegistrarPrevia key={`${s.modelo}:${revisao.dado.revisaoHash}`} matriculaId={id} modeloId={s.modelo} revisaoHash={revisao.dado.revisaoHash} /></section>}
    <section className="space-y-3"><h2 className="text-xl">Prévias preservadas</h2>
      {d.historico.length ? <ul className="space-y-2">{d.historico.map((p) => <li key={p.id} className="rounded border p-3"><Link className="underline" href={`${base}/previas/${p.id}`}>{p.modelo.codigo} · versão {p.modelo.versao} · {textoInstanteAdministrativo(p.criadaEm, preferenciaFusoExibicao)}</Link><p>{p.autor.nome} · {p.motivo}</p></li>)}</ul> : <p>Nenhuma prévia registrada nesta página.</p>}
      <nav className="flex gap-4" aria-label="Páginas das prévias">{d.paginaHistorico > 1 && <Link href={`${base}?historico=${d.paginaHistorico - 1}&modelos=${d.paginaModelos}`}>Prévias mais recentes</Link>}<span>Página {d.paginaHistorico}</span>{d.maisHistorico && <Link href={`${base}?historico=${d.paginaHistorico + 1}&modelos=${d.paginaModelos}`}>Prévias anteriores</Link>}</nav>
    </section>
  </div>;
}
