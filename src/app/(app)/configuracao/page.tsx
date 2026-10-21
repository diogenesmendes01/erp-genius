import { redirect } from "next/navigation";
import { Papel } from "@prisma/client";
import { exigirSessaoPagina } from "@/server/_shared";
import { tabsParaPapeis } from "./_componentes/tabs";

// Redireciona para a primeira aba permitida pelos papéis atuais do banco.
export default async function ConfiguracaoIndex() {
  const { papeis } = await exigirSessaoPagina(Papel.GERENTE_PEDAGOGICO, Papel.GERENTE_COMERCIAL, Papel.SECRETARIA_ACADEMICA);
  const tabs = tabsParaPapeis(papeis);
  redirect(tabs[0]?.href ?? "/home");
}
