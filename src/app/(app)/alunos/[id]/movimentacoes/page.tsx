import { notFound } from "next/navigation";
import Link from "next/link";
import { exigirSessaoPagina } from "@/server/_shared";
import { PAPEIS_PAUSA } from "@/server/matricula/pausa-estado";
import { obterAluno } from "@/server/alunos/consultas";
import { MovimentacoesPainel } from "./MovimentacoesPainel";
import { NovaPausa } from "./NovaPausa";
import { NovaRetomada } from "./NovaRetomada";
import { NovoEncerramento } from "./NovoEncerramento";
import { AcertoEncerramento } from "./AcertoEncerramento";
import { CompensacoesPainel } from "./CompensacoesPainel";
import { ComprasHorasPainel } from "./ComprasHorasPainel";
import { VinculosLegados } from "./VinculosLegados";
import { prisma } from "@/lib/prisma";
import { dataCivilInstitucional, FusoInstitucionalSchema } from "@/server/operacao/fuso";
import { identificacaoContrato } from "./identificacaoContrato";
import { consultarPreferenciaFusoEquipe } from "@/server/preferencias/fuso-exibicao";

export default async function MovimentacoesPage({ params }: { params: Promise<{ id: string }> }) {
  const usuario = await exigirSessaoPagina(...PAPEIS_PAUSA);
  const { id } = await params;
  if (!await obterAluno(id, usuario)) notFound();
  const [contratos, config, preferencia] = await Promise.all([
    prisma.matricula.findMany({ where: { alunoId: id, status: { in: ["ATIVA", "PAUSADA"] } }, select: { id: true, codigo: true, status: true, produto: { select: { idioma: { select: { nome: true } }, modalidade: { select: { nome: true } } } } }, orderBy: { criadoEm: "asc" } }),
    prisma.configuracaoOperacional.findUnique({ where: { id: "escola" }, select: { fusoInstitucional: true } }),
    consultarPreferenciaFusoEquipe(),
  ]);
  const preferenciaFusoExibicao = (preferencia.ok ? preferencia.dado?.fusoExibicao : null) ?? null;
  const fuso = FusoInstitucionalSchema.safeParse(config?.fusoInstitucional);
  const financeiro = usuario.papeis.some((p) => p === "FINANCEIRO" || p === "ADMINISTRADOR");
  const permissoes = financeiro ? await prisma.usuario.findUnique({ where: { id: usuario.id }, select: { permissoes: true } }) : null;
  const pedidos = await prisma.solicitacaoEncerramentoMatriculas.findMany({ where: { alunoId: id }, orderBy: [{ criadoEm: "desc" }, { id: "desc" }], take: 50,
    select: { id: true, status: true, dataPedido: true, dataSolicitada: true, motivo: true, evidenciaPedido: true, motivoRetroatividade: true, evidenciaRetroatividade: true,
      registrador: { select: { nome: true } }, itens: { select: { matricula: { select: { id: true, codigo: true } } } } } });
  return <section className="space-y-5">
    <Link className="text-brand-700 hover:underline" href={`/alunos/${id}`}>Voltar à ficha do aluno</Link>
    <h1 className="text-2xl font-medium">Pausa, retomada e encerramento</h1>
    <p className="text-sm text-gray-600">Confira os contratos e os impactos registrados em cada proposta. Aprovação e aplicação são etapas distintas.</p>
    <NovaPausa alunoId={id} contratos={contratos.filter((m) => m.status === "ATIVA").map((m) => ({ id: m.id, identificacao: identificacaoContrato(m.codigo, m.id), produto: { nome: `${m.produto.idioma.nome} · ${m.produto.modalidade.nome}` } }))} hoje={fuso.success ? dataCivilInstitucional(new Date(), fuso.data) : null} />
    <NovaRetomada alunoId={id} contratos={contratos.filter((m) => m.status === "PAUSADA").map((m) => ({ id: m.id, identificacao: identificacaoContrato(m.codigo, m.id), nome: `${m.produto.idioma.nome} · ${m.produto.modalidade.nome}` }))} hoje={fuso.success ? dataCivilInstitucional(new Date(), fuso.data) : null} />
    <MovimentacoesPainel alunoId={id} preferenciaFusoExibicao={preferenciaFusoExibicao} />
    {financeiro && contratos.length > 0 && <ComprasHorasPainel alunoId={id} contratos={contratos} preferenciaFusoExibicao={preferenciaFusoExibicao} />}
    {financeiro && contratos.length > 0 && <CompensacoesPainel alunoId={id} contratos={contratos} usuarioId={usuario.id} podeAprovar={usuario.papeis.includes("ADMINISTRADOR") || !!permissoes?.permissoes.includes("financeiro.aprovar_acertos")} preferenciaFusoExibicao={preferenciaFusoExibicao} />}
    {usuario.papeis.some((p) => p === "SECRETARIA_ACADEMICA" || p === "ADMINISTRADOR") && <NovoEncerramento alunoId={id} hoje={fuso.success ? dataCivilInstitucional(new Date(), fuso.data) : null} contratos={contratos.map((m) => ({ id: m.id, nome: `${identificacaoContrato(m.codigo, m.id)} · ${m.produto.idioma.nome} · ${m.produto.modalidade.nome}` }))} />}
    <section className="space-y-3" aria-label="Pedidos de encerramento">
      <h2 className="text-lg font-medium">Pedidos de encerramento — até 50 mais recentes</h2>
      {!pedidos.length && <p>Nenhum pedido registrado.</p>}
      {pedidos.map((p) => <article key={p.id} className="space-y-1 rounded border p-3 text-sm">
        <p>{p.itens.map((i) => identificacaoContrato(i.matricula.codigo, i.matricula.id)).join(", ")} · {({ ABERTA: "Aguardando acerto", EM_ACERTO: "Acerto em preparação", CONCLUIDA: "Concluído", CANCELADA: "Cancelado" })[p.status]}</p>
        <p>Registrado por {p.registrador.nome} em {p.dataPedido.toISOString().slice(0, 10)}. Encerramento solicitado para {p.dataSolicitada.toISOString().slice(0, 10)}.</p>
        <p>{p.motivo}</p><p>Evidência do pedido: {p.evidenciaPedido}</p>
        {p.motivoRetroatividade && <p>Retroatividade solicitada: {p.motivoRetroatividade}. Evidência: {p.evidenciaRetroatividade}</p>}
        {["ABERTA", "EM_ACERTO", "CONCLUIDA"].includes(p.status) && usuario.papeis.some((papel) => papel === "FINANCEIRO" || papel === "ADMINISTRADOR") && <AcertoEncerramento alunoId={id} solicitacaoId={p.id} matriculas={p.itens.map((i) => i.matricula)} preferenciaFusoExibicao={preferenciaFusoExibicao} />}
      </article>)}
    </section>
    {usuario.papeis.some((p) => p === "SECRETARIA_ACADEMICA" || p === "ADMINISTRADOR") && <VinculosLegados alunoId={id} />}
  </section>;
}

