import { listarPaises, listarProdutosCatalogo } from "@/server/paises/consultas";
import { PaisesPainel, type PaisRow } from "./PaisesPainel";

export default async function PaisesPage() {
  const [paises, produtos] = await Promise.all([listarPaises(), listarProdutosCatalogo()]);
  const rows: PaisRow[] = paises.map((p) => ({
    id: p.id,
    nome: p.nome,
    codigoISO: p.codigoISO,
    moedaLocal: p.moedaLocal,
    ddi: p.ddi,
    fuso: p.fuso,
    idioma: p.idioma,
    status: p.status,
    tiposDocumento: p.tiposDocumento.map((d) => ({ id: d.id, nome: d.nome, validador: d.validador })),
    produtosOferecidos: p.produtosPais.filter((pp) => pp.oferecido).map((pp) => pp.produtoId),
    _count: p._count,
  }));
  return <PaisesPainel paises={rows} produtos={produtos} />;
}
