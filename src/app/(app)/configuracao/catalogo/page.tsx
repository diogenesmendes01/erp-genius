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
import { Papel } from "@prisma/client";
import { consultarEntradasOfertas } from "@/server/catalogo/entrada-oferta";
import { EntradasOfertas } from "./EntradasOfertas";
import { exigirSessaoPagina } from "@/server/_shared";

export default async function CatalogoPage() {
  const usuario = await exigirSessaoPagina(Papel.GERENTE_PEDAGOGICO);
  const administrador = usuario.papeis.includes(Papel.ADMINISTRADOR);
  if (!administrador) {
    const idiomas = await listarIdiomas();
    return <div className="flex flex-col gap-10"><IdiomasPainel idiomas={idiomas} /><NiveisPainel idiomas={idiomas} /></div>;
  }
  const [idiomas, modalidades, produtos, precos, paises, ofertas] = await Promise.all([
    listarIdiomas(),
    listarModalidades(),
    listarProdutos(),
    listarPrecos(),
    listarPaises(),
    consultarEntradasOfertas(),
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
      <EntradasOfertas ofertas={ofertas} />
    </div>
  );
}
