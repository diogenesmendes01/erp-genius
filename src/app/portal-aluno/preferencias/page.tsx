import Link from "next/link";
import { exigirSessaoPortalAlunoPagina } from "@/server/portal-aluno/sessao";
import { consultarPreferenciaFusoPortalAluno } from "@/server/portal-aluno/preferencia-fuso";
import { PreferenciasFusoPortalFormulario } from "../preferencias-formulario";

export default async function PreferenciasPortalAlunoPage() {
  await exigirSessaoPortalAlunoPagina();
  const preferencia = await consultarPreferenciaFusoPortalAluno();
  return <section className="mx-auto max-w-3xl p-6 sm:p-10"><Link href="/portal-aluno" className="text-sm text-brand-700 underline">Voltar</Link><h1 className="mt-4 text-2xl font-medium">Preferências de horário</h1><PreferenciasFusoPortalFormulario atual={preferencia.fusoExibicao} /></section>;
}
