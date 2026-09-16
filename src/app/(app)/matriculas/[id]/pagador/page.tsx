import Link from "next/link";
import { Papel } from "@prisma/client";
import { exigirSessaoPagina } from "@/server/_shared";
import { consultarTelaPagador, consultarHistoricoPagador } from "@/server/secretaria/pagador-preparacao";
import { PagadorFormulario } from "./PagadorFormulario";
export default async function PagadorPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ pagina?: string }> }) {
  await exigirSessaoPagina(Papel.SECRETARIA_ACADEMICA, Papel.FINANCEIRO);
  const { id } = await params, busca = await searchParams;
  const pagina = busca.pagina ? Number(busca.pagina) : 1;
  const [r, h] = await Promise.all([consultarTelaPagador(id), consultarHistoricoPagador({ matriculaId: id, pagina })]);
  if (!r.ok || !r.dado) return <p role="alert">{r.ok ? "Consulta indisponível." : r.erro}</p>;
  const d = r.dado, p = d.registro;
  return <div className="space-y-4"><Link href="/secretaria" className="underline">Voltar à Secretaria</Link>
    <h1 className="text-2xl">Pagador da contratação · {d.matricula.codigo ?? "Em preparação"}</h1>
    <p>Aluno: {d.matricula.aluno.primeiroNome} {d.matricula.aluno.sobrenome}</p>
    <p>Este cadastro pertence somente a esta matrícula. Ser pagador não concede acesso acadêmico nem define quem deve assinar o contrato.</p>
    {p ? <section className="space-y-2 rounded border p-4"><h2>Registro atual · versão {p.versao}</h2><p>{p.tipo === "ALUNO" ? "Próprio aluno" : p.tipo === "EMPRESA" ? "Empresa" : "Responsável"} · {p.dados.nome}</p>
      <p>Documento: {p.dados.documento || "Pendente"}</p><p>E-mail: {p.dados.email || "Não informado"}</p><p>Telefone: {p.dados.telefoneE164 || "Não informado"}</p><p>Endereço: {p.dados.endereco || "Pendente"}</p>
      <p>Registrado por {p.preparador.nome}. Motivo: {p.motivo}</p></section> : <p>Nenhum pagador registrado nesta preparação.</p>}
    <p>O registro não comprova conferência suficiente para emitir cobranças ou liberar assinatura.</p>
    {d.impedimento && <p role="status">{d.impedimento}</p>}
    {d.podeEditar && <PagadorFormulario key={p?.id ?? "novo"} matriculaId={id} versao={p?.versao ?? 0} paises={d.paises} atual={p} />}
    <section className="space-y-3"><h2 className="text-xl">Histórico do pagador</h2>
      {!h.ok || !h.dado ? <p role="alert">{h.ok ? "Histórico indisponível." : h.erro}</p> : <>
        {h.dado.registros.map((v) => <details key={v.id} className="rounded border p-3"><summary>Versão {v.versao} · {v.dados.nome} · {v.preparador.nome}</summary>
          <p>Registrada em {v.criadaEm.toISOString()} (UTC). Tipo: {v.tipo}.</p>
          <p>Documento: {v.dados.documento || "Não informado"}</p><p>E-mail: {v.dados.email || "Não informado"}</p><p>Telefone: {v.dados.telefoneE164 || "Não informado"}</p><p>Endereço: {v.dados.endereco || "Não informado"}</p><p>Motivo: {v.motivo}</p>
        </details>)}
        {!h.dado.registros.length && <p>Nenhum registro nesta página.</p>}
        <nav aria-label="Páginas do histórico" className="flex gap-4">{pagina > 1 && <Link className="underline" href={`?pagina=${pagina - 1}`}>Anterior</Link>}<span>Página {pagina}</span>{h.dado.temProxima && <Link className="underline" href={`?pagina=${pagina + 1}`}>Próxima</Link>}</nav>
      </>}
    </section>
  </div>;
}
