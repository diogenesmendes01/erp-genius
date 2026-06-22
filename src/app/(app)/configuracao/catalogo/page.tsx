import {
  listarIdiomas,
  listarModalidades,
  listarProdutos,
  listarPrecos,
} from "@/server/catalogo/consultas";
import { listarPaises } from "@/server/paises/consultas";
import { IdiomasPainel } from "./IdiomasPainel";
import { ModalidadesPainel } from "./ModalidadesPainel";
import { NiveisPainel } from "./NiveisPainel";
import { ProdutosPainel } from "./ProdutosPainel";
import { PrecosPainel } from "./PrecosPainel";

export default async function CatalogoPage() {
  const [idiomas, modalidades, produtos, precos, paises] = await Promise.all([
    listarIdiomas(),
    listarModalidades(),
    listarProdutos(),
    listarPrecos(),
    listarPaises(),
  ]);

  const produtosOpcoes = produtos.map((p) => ({
    id: p.id,
    label: `${p.idioma.nome} · ${p.modalidade.nome}`,
  }));

  return (
    <div className="flex flex-col gap-10">
      <IdiomasPainel idiomas={idiomas} />
      <ModalidadesPainel modalidades={modalidades} />
      <NiveisPainel idiomas={idiomas} />
      <ProdutosPainel
        produtos={produtos}
        idiomas={idiomas.map((i) => ({ id: i.id, nome: i.nome }))}
        modalidades={modalidades.map((m) => ({ id: m.id, nome: m.nome }))}
      />
      <PrecosPainel
        precos={precos}
        paises={paises.map((p) => ({ id: p.id, nome: p.nome, moedaLocal: p.moedaLocal }))}
        produtos={produtosOpcoes}
      />
    </div>
  );
}
