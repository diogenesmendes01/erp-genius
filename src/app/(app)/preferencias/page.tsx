import { exigirSessaoPagina } from "@/server/_shared";
import { consultarPreferenciaFusoEquipe } from "@/server/preferencias/fuso-exibicao";
import { FusoExibicaoFormulario } from "./FusoExibicaoFormulario";
import { VoltarPara } from "@/components/VoltarPara";

export default async function PreferenciasPage() {
  await exigirSessaoPagina();
  const r = await consultarPreferenciaFusoEquipe();
  return <section className="mx-auto max-w-xl space-y-5"><VoltarPara href="/" para="Voltar" /><h1 className="text-2xl font-medium">Preferências pessoais</h1>{!r.ok ? <p role="alert">{r.erro}</p> : <FusoExibicaoFormulario atual={r.dado?.fusoExibicao ?? null} />}</section>;
}
