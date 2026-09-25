import Link from "next/link";
import { Papel } from "@prisma/client";
import { exigirSessaoPagina } from "@/server/_shared";
import { consultarConciliacaoFinanceiraMigracao } from "@/server/migracao/consultas-financeiras";
import { ConferenciaFinanceiraMigracao } from "./ConferenciaFinanceiraMigracao";
import { EntradaFinanceiraHistorica } from "./EntradaFinanceiraHistorica";
import { consultarEntradasFinanceirasHistoricasMigracao, listarPaisesEntradaFinanceiraHistoricaMigracao } from "@/server/migracao/entrada-financeira-historica";
import { consultarPreferenciaFusoEquipe } from "@/server/preferencias/fuso-exibicao";
import { VoltarPara } from "@/components/VoltarPara";

type Busca = { cursor?: string; cursorRecebimentos?: string; cursorPagadores?: string; cursorPropostas?: string };
export default async function ConciliacaoFinanceiraPage({ params, searchParams }: { params: Promise<{ linhaId: string }>; searchParams: Promise<Busca> }) {
  await exigirSessaoPagina(Papel.ADMINISTRADOR, Papel.FINANCEIRO);
  const [{ linhaId }, busca] = await Promise.all([params, searchParams]);
  const [resultado, preferencia] = await Promise.all([
    consultarConciliacaoFinanceiraMigracao({ linhaId, ...busca }),
    consultarPreferenciaFusoEquipe(),
  ]);
  const inicio = "/financeiro/migracao/" + encodeURIComponent(linhaId);
  if (!resultado.ok || !resultado.dado) return <section className="space-y-3"><VoltarPara href="/financeiro" /><p role="alert">{resultado.ok ? "Linha financeira não encontrada ou sem identidade de origem." : resultado.erro}</p><Link href={inicio}>Reiniciar consulta</Link></section>;
  const dados = resultado.dado;
  const [entradas, paises] = await Promise.all([consultarEntradasFinanceirasHistoricasMigracao(dados.linha.id), listarPaisesEntradaFinanceiraHistoricaMigracao()]);
  const paginas = [
    ["cursor", dados.proximoCursor, "Próximas cobranças"],
    ["cursorRecebimentos", dados.proximoCursorRecebimentos, "Próximos recebimentos"],
    ["cursorPagadores", dados.proximoCursorPagadores, "Próximos pagadores"],
    ["cursorPropostas", dados.proximoCursorPropostas, "Propostas anteriores"],
  ] as const;
  const href = (campo: keyof Busca, valor: string) => {
    const consulta = new URLSearchParams();
    for (const chave of ["cursor", "cursorRecebimentos", "cursorPagadores", "cursorPropostas"] as const) {
      const item = chave === campo ? valor : busca[chave];
      if (item) consulta.set(chave, item);
    }
    return inicio + "?" + consulta.toString();
  };
  return <section className="max-w-5xl space-y-4"><VoltarPara href="/financeiro" /><EntradaFinanceiraHistorica linhaId={dados.linha.id} temMapa={!!dados.linha.mapa} moeda={dados.linha.mapa?.moeda ?? ""} paises={paises.ok && paises.dado ? paises.dado : []} propostas={entradas.ok && entradas.dado ? entradas.dado : []} /><ConferenciaFinanceiraMigracao dados={dados} preferenciaFusoExibicao={(preferencia.ok ? preferencia.dado?.fusoExibicao : null) ?? null} /><nav aria-label="Páginas da conciliação" className="flex flex-wrap gap-4">{paginas.map(([campo, cursor, rotulo]) => cursor && <Link key={campo} href={href(campo, cursor)}>{rotulo}</Link>)}<Link href={inicio}>Primeiras páginas</Link></nav></section>;
}
