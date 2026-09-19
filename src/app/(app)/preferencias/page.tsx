import Link from "next/link";
import { exigirSessaoPagina } from "@/server/_shared";
import { consultarPreferenciaFusoEquipe } from "@/server/preferencias/fuso-exibicao";
import { FusoExibicaoFormulario } from "./FusoExibicaoFormulario";

export default async function PreferenciasPage() {
  await exigirSessaoPagina();
  const r = await consultarPreferenciaFusoEquipe();
  return <section className="mx-auto max-w-xl space-y-5"><Link href="/" className="text-sm text-brand-700 underline">Voltar</Link><h1 className="text-2xl font-medium">Preferências pessoais</h1>{!r.ok ? <p role="alert">{r.erro}</p> : <FusoExibicaoFormulario atual={r.dado?.fusoExibicao ?? null} />}</section>;
}
