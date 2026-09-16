import Link from "next/link";
import { Papel } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { exigirSessaoPagina } from "@/server/_shared";
import { escopoComercialAtual } from "@/server/_shared/escopo-comercial";
import { SecretariaPainel } from "./SecretariaPainel";
import { CondicoesEncerramentoLista } from "./CondicoesEncerramentoLista";

export default async function SecretariaPage({ searchParams }: { searchParams: Promise<{ matriculaId?: string }> }) {
  const autor = await exigirSessaoPagina(Papel.SECRETARIA_ACADEMICA, Papel.VENDEDOR, Papel.GERENTE_COMERCIAL);
  const secretaria = autor.papeis.some((p) => p === Papel.ADMINISTRADOR || p === Papel.SECRETARIA_ACADEMICA);
  const { matriculaId } = await searchParams;
  const matriculas = await prisma.matricula.findMany({
    where: { ...(matriculaId ? { id: matriculaId } : {}), ...(!secretaria ? { lead: { is: await escopoComercialAtual(autor) } } : {}) },
    select: { id: true, codigo: true, leadId: true, alunoId: true, status: true, secretariaAssumiuEm: true, confirmacaoContratoEm: true,
      referenciaCobertura: true, preparacaoComercial: { select: { id: true } },
      cobrancas: { where: { tipo: "MENSALIDADE" }, orderBy: { vencimento: "asc" }, select: { id: true, versao: true, valorNegociado: true, moeda: true, coberturaInicio: true, coberturaFim: true, vencimento: true } },
      aluno: { select: { primeiroNome: true, sobrenome: true } },
      documentos: { where: { arquivado: false, categoria: { in: ["CONTRATO", "PROPOSTA", "COMPROVANTE"] } }, select: { id: true, nome: true, categoria: true, matriculaId: true, url: true } },
      lead: { select: { documentos: { where: { arquivado: false, categoria: { in: ["CONTRATO", "PROPOSTA", "COMPROVANTE"] } }, select: { id: true, nome: true, categoria: true, matriculaId: true, url: true } } } },
      solicitacoesCorrecao: { where: secretaria ? {} : { autorId: autor.id }, orderBy: { criadoEm: "desc" }, select: { id: true, campo: true, valorProposto: true, motivo: true, status: true, motivoResolucao: true } },
    }, orderBy: { criadoEm: "desc" }, take: 40,
  });
  return <div className="space-y-5">{secretaria && <nav className="flex flex-wrap gap-4"><Link href="/secretaria/reservas" className="underline">Reservas de matrícula</Link><Link href="/secretaria/desistencias" className="underline">Desistências pendentes</Link><Link href="/secretaria/envios-portal" className="underline">Envios de acesso ao portal</Link></nav>}<h1 className="text-2xl font-medium">Matrículas e correções</h1><p className="text-sm text-gray-500">A secretaria assume o cadastro e confirma a evidência contratual. O comercial acompanha a matrícula e solicita correções. Exibindo até 40 matrículas recentes.</p><SecretariaPainel secretaria={secretaria} matriculas={matriculas.map((m) => ({ exigeAssinaturaIntegrada: !!m.preparacaoComercial, id: m.id, codigo: m.codigo, leadId: m.leadId, alunoId: secretaria ? m.alunoId : null, nome: `${m.aluno.primeiroNome} ${m.aluno.sobrenome ?? ""}`.trim(), status: m.status, mensalidadesExibidas: secretaria ? m.cobrancas.map((c) => ({ id: c.id, versao: c.versao, valor: c.valorNegociado.toString(), moeda: c.moeda, inicio: c.coberturaInicio?.toISOString().slice(0, 10) ?? null, fim: c.coberturaFim?.toISOString().slice(0, 10) ?? null, vencimento: c.vencimento.toISOString().slice(0, 10) })) : [], cobertura: { cobrancaId: m.cobrancas[0]?.id ?? null, versao: m.cobrancas[0]?.versao ?? null, vencimento: m.cobrancas[0]?.vencimento?.toISOString().slice(0, 10) ?? null, referencia: m.referenciaCobertura, inicio: m.cobrancas[0]?.coberturaInicio?.toISOString().slice(0, 10) ?? null, fim: m.cobrancas[0]?.coberturaFim?.toISOString().slice(0, 10) ?? null }, assumida: !!m.secretariaAssumiuEm, contratoConfirmado: !!m.confirmacaoContratoEm, documentos: secretaria ? [...m.documentos, ...m.lead?.documentos ?? []] : [], correcoes: m.solicitacoesCorrecao }))} />{secretaria && <CondicoesEncerramentoLista ids={matriculas.map((m) => m.id)} autorId={autor.id} administrador={autor.papeis.includes(Papel.ADMINISTRADOR)} />}</div>;
}
