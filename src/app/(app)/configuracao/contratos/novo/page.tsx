import { Papel } from "@prisma/client";
import { exigirSessaoPagina } from "@/server/_shared";
import { ModeloFormulario } from "../ModeloFormulario";
export default async function NovoModeloPage() {
  await exigirSessaoPagina(Papel.SECRETARIA_ACADEMICA);
  return <section className="space-y-4"><h2 className="text-xl font-medium">Preparar modelo contratual</h2><ModeloFormulario versaoEsperada={0} /></section>;
}
