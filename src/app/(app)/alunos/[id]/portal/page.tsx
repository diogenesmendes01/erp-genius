import { notFound } from "next/navigation";
import { Papel } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { exigirSessaoPagina } from "@/server/_shared";
import { consultarPreferenciaFusoEquipe } from "@/server/preferencias/fuso-exibicao";
import { PainelAcessoPortalAluno } from "./painel";
import { VoltarPara } from "@/components/VoltarPara";

export default async function PortalAlunoEquipePage({ params }: { params: Promise<{ id: string }> }) {
  const usuario = await exigirSessaoPagina(Papel.SECRETARIA_ACADEMICA, Papel.ADMINISTRADOR);
  const { id } = await params;
  const [aluno, conta, preferencia] = await Promise.all([
    prisma.aluno.findUnique({ where: { id }, select: { id: true, primeiroNome: true, sobrenome: true, email: true } }),
    prisma.contaPortalAluno.findUnique({ where: { alunoId: id }, select: {
      id: true, emailVerificado: true, senhaHash: true, ativa: true,
      trocasEmail: { orderBy: { criadaEm: "desc" }, select: { id: true, novoEmail: true, situacao: true, preparadorId: true, criadaEm: true, novoEmailVerificadoEm: true, decisao: { select: { aprovada: true, motivo: true, criadaEm: true } } } },
    } }),
    consultarPreferenciaFusoEquipe(),
  ]);
  if (!aluno) notFound();
  const nome = [aluno.primeiroNome, aluno.sobrenome].filter(Boolean).join(" ");
  return <section className="space-y-5"><header><VoltarPara href={`/alunos/${id}`} para="Ficha" /><h1 className="mt-2 text-2xl font-medium">Acesso ao portal · {nome}</h1><p className="mt-1 text-sm text-gray-600">A equipe prepara solicitações; não visualiza senha, token ou link de uso único.</p></header>
    <PainelAcessoPortalAluno alunoId={aluno.id} emailCadastro={aluno.email} conta={conta ? { emailVerificado: conta.emailVerificado, temSenha: Boolean(conta.senhaHash), ativa: conta.ativa } : null} trocas={conta?.trocasEmail.map((troca) => ({ ...troca, criadaEm: troca.criadaEm.toISOString(), novoEmailVerificadoEm: troca.novoEmailVerificadoEm?.toISOString() ?? null, decisao: troca.decisao ? { ...troca.decisao, criadaEm: troca.decisao.criadaEm.toISOString() } : null })) ?? []} podeDecidir={usuario.papeis.includes(Papel.ADMINISTRADOR)} preferenciaFusoExibicao={(preferencia.ok ? preferencia.dado?.fusoExibicao : null) ?? null} />
  </section>;
}
