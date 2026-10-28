import Link from "next/link";
import { redirect } from "next/navigation";
import { Papel, type Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { exigirSessaoPagina } from "@/server/_shared";
import { SecretariaPainel } from "./SecretariaPainel";
import { CondicoesEncerramentoLista } from "./CondicoesEncerramentoLista";
import { Paginacao } from "@/components/Paginacao";
import { faixaDaPagina, hrefLista, lerPagina, lerTexto, paginaAlemDoFim, type ParametrosUrl } from "@/lib/pagina-url";
import { MATRICULAS_POR_PAGINA, whereBuscaMatriculas } from "@/server/secretaria/busca-matriculas";
import { botaoClasses } from "@/components/Botao";
import { Input } from "@/components/ui/input";

const CHIP = "rounded-md bg-surface-muted px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-highlight";

export default async function SecretariaPage({ searchParams }: { searchParams: Promise<ParametrosUrl> }) {
  const autor = await exigirSessaoPagina(Papel.SECRETARIA_ACADEMICA);
  const secretaria = autor.papeis.some((p) => p === Papel.ADMINISTRADOR || p === Papel.SECRETARIA_ACADEMICA);
  const parametros = await searchParams;
  const matriculaId = lerTexto(parametros, "matriculaId", 64) || undefined;
  const busca = lerTexto(parametros, "busca");
  const pagina = lerPagina(parametros);
  const where: Prisma.MatriculaWhereInput = {
    AND: [
      matriculaId ? { id: matriculaId } : {},
      whereBuscaMatriculas(busca),
    ],
  };
  const total = await prisma.matricula.count({ where });
  const ultima = paginaAlemDoFim(pagina, MATRICULAS_POR_PAGINA, total);
  if (ultima) redirect(hrefLista("/secretaria", { busca, matriculaId, pagina: ultima }));
  const matriculas = await prisma.matricula.findMany({
    where,
    select: {
      id: true, codigo: true, leadId: true, alunoId: true, status: true, secretariaAssumiuEm: true, confirmacaoContratoEm: true,
      referenciaCobertura: true, preparacaoComercial: { select: { id: true } },
      cobrancas: { where: { tipo: "MENSALIDADE" }, orderBy: { vencimento: "asc" }, select: { id: true, versao: true, valorNegociado: true, moeda: true, coberturaInicio: true, coberturaFim: true, vencimento: true } },
      aluno: { select: { primeiroNome: true, sobrenome: true } },
      documentos: { where: { arquivado: false, categoria: { in: ["CONTRATO", "PROPOSTA", "COMPROVANTE"] } }, select: { id: true, nome: true, categoria: true, matriculaId: true, url: true } },
      lead: { select: { documentos: { where: { arquivado: false, categoria: { in: ["CONTRATO", "PROPOSTA", "COMPROVANTE"] } }, select: { id: true, nome: true, categoria: true, matriculaId: true, url: true } } } },
      solicitacoesCorrecao: { where: secretaria ? {} : { autorId: autor.id }, orderBy: { criadoEm: "desc" }, select: { id: true, campo: true, valorProposto: true, motivo: true, status: true, motivoResolucao: true } },
    },
    orderBy: [{ criadoEm: "desc" }, { id: "desc" }],
    skip: (pagina - 1) * MATRICULAS_POR_PAGINA,
    take: MATRICULAS_POR_PAGINA,
  });
  const { inicio, fim, temProxima } = faixaDaPagina(pagina, MATRICULAS_POR_PAGINA, matriculas.length, total);
  return (
    <div className="space-y-5">
      {secretaria && (
        <nav className="flex flex-wrap gap-2" aria-label="Filas da secretaria">
          <Link href="/secretaria/reservas" className={CHIP}>Reservas de matrícula</Link>
          <Link href="/secretaria/desistencias" className={CHIP}>Desistências pendentes</Link>
          <Link href="/secretaria/envios-portal" className={CHIP}>Envios de acesso ao portal</Link>
          <Link href="/secretaria/avisos-agenda" className={CHIP}>Avisos de agenda</Link>
        </nav>
      )}
      <h1 className="text-2xl font-medium">Matrículas e correções</h1>
      <p className="text-sm text-gray-500">A secretaria assume o cadastro, confere a cobertura e confirma a evidência contratual.</p>
      <form method="get" action="/secretaria" role="search" aria-label="Buscar matrículas" className="flex flex-wrap items-center gap-2">
        <Input name="busca" defaultValue={busca} maxLength={100} aria-label="Buscar matrícula por aluno ou código" placeholder="Buscar por aluno ou código…" className="w-64" />
        <button type="submit" className={botaoClasses({ variante: "secundario" })}>Buscar</button>
        {(busca || matriculaId) && <Link href="/secretaria" className="text-sm text-brand-700">Limpar</Link>}
      </form>
      {matriculaId && <p className="text-sm text-gray-600">Mostrando a matrícula do link direto. <Link href="/secretaria" className="text-brand-700">Ver todas</Link></p>}
      <p className="text-xs text-gray-500" aria-live="polite">{total ? `${inicio}–${fim} de ${total} ${total === 1 ? "matrícula" : "matrículas"}${busca ? ` para “${busca}”` : ""}` : busca ? `Nenhuma matrícula para “${busca}”.` : "Nenhuma matrícula."}</p>
      <SecretariaPainel secretaria={secretaria} matriculas={matriculas.map((m) => ({
        exigeAssinaturaIntegrada: !!m.preparacaoComercial,
        id: m.id,
        codigo: m.codigo,
        leadId: m.leadId,
        alunoId: secretaria ? m.alunoId : null,
        nome: `${m.aluno.primeiroNome} ${m.aluno.sobrenome ?? ""}`.trim(),
        status: m.status,
        mensalidadesExibidas: secretaria ? m.cobrancas.map((c) => ({ id: c.id, versao: c.versao, valor: c.valorNegociado.toString(), moeda: c.moeda, inicio: c.coberturaInicio?.toISOString().slice(0, 10) ?? null, fim: c.coberturaFim?.toISOString().slice(0, 10) ?? null, vencimento: c.vencimento.toISOString().slice(0, 10) })) : [],
        cobertura: { cobrancaId: m.cobrancas[0]?.id ?? null, versao: m.cobrancas[0]?.versao ?? null, vencimento: m.cobrancas[0]?.vencimento?.toISOString().slice(0, 10) ?? null, referencia: m.referenciaCobertura, inicio: m.cobrancas[0]?.coberturaInicio?.toISOString().slice(0, 10) ?? null, fim: m.cobrancas[0]?.coberturaFim?.toISOString().slice(0, 10) ?? null },
        assumida: !!m.secretariaAssumiuEm,
        contratoConfirmado: !!m.confirmacaoContratoEm,
        documentos: secretaria ? [...m.documentos, ...m.lead?.documentos ?? []] : [],
        correcoes: m.solicitacoesCorrecao,
      }))} />
      {secretaria && <CondicoesEncerramentoLista ids={matriculas.map((m) => m.id)} autorId={autor.id} administrador={autor.papeis.includes(Papel.ADMINISTRADOR)} />}
      <Paginacao pagina={pagina} temProxima={temProxima} href={(p) => hrefLista("/secretaria", { busca, matriculaId, pagina: p })} rotulo="Páginas de matrículas" />
    </div>
  );
}
