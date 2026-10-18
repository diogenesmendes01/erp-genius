import { Papel } from "@prisma/client";
import { exigirSessaoPagina } from "@/server/_shared";

// Distribuição e SLA: o conteúdo entra na Task 39; o guard já vale desde a fundação.
export default async function Pagina() {
  await exigirSessaoPagina(Papel.ADMINISTRADOR, Papel.GERENTE_COMERCIAL);
  return (
    <section aria-labelledby="titulo-secao">
      <h2 id="titulo-secao" className="text-lg font-semibold">Distribuição e SLA</h2>
      <p className="mt-2 text-sm text-gray-600">Em construção.</p>
    </section>
  );
}
