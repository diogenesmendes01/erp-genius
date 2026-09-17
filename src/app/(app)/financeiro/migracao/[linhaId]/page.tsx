import Link from "next/link";
import { Papel } from "@prisma/client";
import { exigirSessaoPagina } from "@/server/_shared";
import { consultarConciliacaoFinanceiraMigracao } from "@/server/migracao/consultas-financeiras";
import { ConferenciaFinanceiraMigracao } from "./ConferenciaFinanceiraMigracao";
import { EntradaFinanceiraHistorica } from "./EntradaFinanceiraHistorica";
import { consultarEntradasFinanceirasHistoricasMigracao } from "@/server/migracao/entrada-financeira-historica";

type Busca = { cursor?: string; cursorRecebimentos?: string; cursorPagadores?: string; cursorPropostas?: string };
export default async function ConciliacaoFinanceiraPage({ params, searchParams }: { params: Promise<{ linhaId: string }>; searchParams: Promise<Busca> }) {
  await exigirSessaoPagina(Papel.ADMINISTRADOR, Papel.FINANCEIRO);
  const [{ linhaId }, busca] = await Promise.all([params, searchParams]);
  const resultado = await consultarConciliacaoFinanceiraMigracao({ linhaId, ...busca });
  const inicio = "/financeiro/migracao/" + encodeURIComponent(linhaId);
  if (!resultado.ok || !resultado.dado) return <section className="space-y-3"><Link href="/financeiro">Voltar ao financeiro</Link><p role="alert">{resultado.ok ? "Linha financeira não encontrada ou sem identidade de origem." : resultado.erro}</p><Link href={inicio}>Reiniciar consulta</Link></section>;
  const dados = resultado.dado;
  const entradas = await consultarEntradasFinanceirasHistoricasMigracao(dados.linha.id);
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
  return <section className="max-w-5xl space-y-4"><Link href="/financeiro">Voltar ao financeiro</Link><EntradaFinanceiraHistorica linhaId={dados.linha.id} temMapa={!!dados.linha.mapa} propostas={entradas.ok && entradas.dado ? entradas.dado : []} /><ConferenciaFinanceiraMigracao dados={dados} /><nav aria-label="Páginas da conciliação" className="flex flex-wrap gap-4">{paginas.map(([campo, cursor, rotulo]) => cursor && <Link key={campo} href={href(campo, cursor)}>{rotulo}</Link>)}<Link href={inicio}>Primeiras páginas</Link></nav></section>;
}
