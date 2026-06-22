import { redirect } from "next/navigation";
import { Papel } from "@prisma/client";
import { auth } from "@/lib/auth";
import { tabsParaPapeis } from "./_componentes/tabs";

// Redireciona para a primeira aba permitida ao papel (ADM → Países; Gerente Pedagógico → Turmas).
export default async function ConfiguracaoIndex() {
  const session = await auth();
  const papeis = (session?.user?.papeis ?? []) as Papel[];
  const tabs = tabsParaPapeis(papeis);
  redirect(tabs[0]?.href ?? "/home");
}
