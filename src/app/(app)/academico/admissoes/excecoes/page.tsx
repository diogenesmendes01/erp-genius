import Link from "next/link";
import { Papel } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { exigirSessaoPagina } from "@/server/_shared";
import { VoltarPara } from "@/components/VoltarPara";
import { EstadoVazio } from "@/components/EstadoVazio";
export default async function ExcecoesPage({ searchParams }: { searchParams: Promise<{ pagina?: string }> }) {
  await exigirSessaoPagina(Papel.SECRETARIA_ACADEMICA, Papel.GERENTE_PEDAGOGICO);
  const n = Number((await searchParams).pagina ?? "1"), pagina = Number.isInteger(n) && n > 0 && n <= 100000 ? n : 1;
  const reservas = await prisma.reservaVagaMatricula.findMany({ where: { OR: [{ status: { in: ["ATIVA", "MANTIDA_PENDENCIA"] } }, { excecoesAdmissao: { some: {} } }] },
    orderBy: [{ criadaEm: "desc" }, { id: "desc" }], skip: (pagina - 1) * 30, take: 31,
    select: { id: true, turma: { select: { codigo: true, nome: true } }, matricula: { select: { codigo: true, aluno: { select: { primeiroNome: true, sobrenome: true } } } } } });
  return <div className="space-y-4"><VoltarPara href="/academico/admissoes" /><h1 className="text-2xl">Exceções de ingresso por reserva</h1>
    <p>Selecione a reserva para revisar a necessidade de exceção ou consultar decisões anteriores.</p>
    {!reservas.length && <EstadoVazio bloco>Nenhuma reserva encontrada.</EstadoVazio>}
    <ul>{reservas.slice(0, 30).map((r) => <li className="rounded border p-3" key={r.id}><Link className="underline" href={`/academico/admissoes/excecoes/${r.id}`}>{[r.matricula.aluno.primeiroNome, r.matricula.aluno.sobrenome].filter(Boolean).join(" ")} · {r.matricula.codigo ?? "Matrícula em preparação"} · {r.turma.codigo ?? r.turma.nome ?? "Turma"}</Link></li>)}</ul>
    {pagina > 1 && <Link className="underline mr-4" href={`?pagina=${pagina - 1}`}>Anteriores</Link>}{reservas.length > 30 && <Link className="underline" href={`?pagina=${pagina + 1}`}>Próximos</Link>}
  </div>;
}
