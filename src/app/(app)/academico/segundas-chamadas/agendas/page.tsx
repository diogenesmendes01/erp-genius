import Link from "next/link";
import { Papel } from "@prisma/client";
import { exigirSessaoPagina } from "@/server/_shared";
import { listarAgendasSegundaChamada } from "@/server/avaliacoes/segunda-chamada-agendas";
import { consultarPreferenciaFusoEquipe } from "@/server/preferencias/fuso-exibicao";
import { resolverFusoExibicao } from "@/server/operacao/fuso-exibicao";
import { VoltarPara } from "@/components/VoltarPara";
import { STATUS_ENCONTRO_LABEL, STATUS_RESERVA_SEGUNDA_CHAMADA_LABEL, rotular } from "@/lib/labels";
import { EstadoVazio } from "@/components/EstadoVazio";
import { Paginacao } from "@/components/Paginacao";
import { hrefLista, lerPagina, type ParametrosUrl } from "@/lib/pagina-url";

const rotulosReserva = STATUS_RESERVA_SEGUNDA_CHAMADA_LABEL;
const rotulosEncontro = STATUS_ENCONTRO_LABEL;

function dataHora(valor: string, fuso: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: fuso,
  }).format(new Date(valor));
}

export default async function AgendasSegundaChamadaPage({
  searchParams,
}: {
  searchParams: Promise<ParametrosUrl>;
}) {
  await exigirSessaoPagina(
    Papel.SECRETARIA_ACADEMICA,
    Papel.GERENTE_PEDAGOGICO,
    Papel.ADMINISTRADOR,
  );
  const pagina = lerPagina(await searchParams);
  const [resultado, preferencia] = await Promise.all([listarAgendasSegundaChamada({ pagina }), consultarPreferenciaFusoEquipe()]);
  if (!resultado.ok || !resultado.dado) {
    return <section className="space-y-3"><VoltarPara href="/academico" /><p role="alert">{resultado.ok ? "Consulta indisponível." : resultado.erro}</p></section>;
  }
  const d = resultado.dado;

  return <section className="space-y-4">
    <VoltarPara href="/academico" />
    <header><h1 className="text-2xl font-medium">Agendas de segunda chamada</h1><p>Consulte as reservas agendadas e abra a remarcação da oportunidade correspondente.</p></header>
    {!d.itens.length && <EstadoVazio bloco>Nenhuma agenda de segunda chamada foi encontrada.</EstadoVazio>}
    {d.itens.map((item) => <article key={item.reservaId} className="space-y-2 rounded border p-4">
      <h2 className="font-medium">{item.aluno} · avaliação {item.codigoAvaliacao}</h2>
      <p>Matrícula {item.matricula.codigo ?? "sem código"} · Turma {item.turma.codigo ?? item.turma.nome ?? "sem identificação"}.</p>
      {item.agenda && (() => { const fuso=resolverFusoExibicao(preferencia.ok ? preferencia.dado?.fusoExibicao : null,item.agenda.fusoOrigem); return <p>Horário: {dataHora(item.agenda.inicio,fuso)} até {dataHora(item.agenda.fim,fuso)} ({fuso}; origem {item.agenda.fusoOrigem}).</p>; })()}
      <p>Situação da reserva: {rotular(rotulosReserva, item.statusReserva)}. Situação do encontro: {item.agenda ? rotular(rotulosEncontro, item.agenda.status) : "Sem agenda"}.</p>
      <div className="flex gap-4"><Link className="underline" href={`/academico/segundas-chamadas/reservas/${encodeURIComponent(item.reservaId)}/remarcacao`}>Abrir remarcação</Link><Link className="underline" href={`/academico/segundas-chamadas/reservas/${encodeURIComponent(item.reservaId)}/substituicao`}>Substituir professor</Link></div>
    </article>)}
    <Paginacao pagina={pagina} temProxima={d.temProxima} href={(p) => hrefLista("/academico/segundas-chamadas/agendas", { pagina: p })} rotulo="Páginas de agendas de segunda chamada" />
  </section>;
}
