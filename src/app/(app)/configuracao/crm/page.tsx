import { redirect } from "next/navigation";
import { Papel } from "@prisma/client";
import { exigirSessaoPagina } from "@/server/_shared";
import { hrefSecaoCrm, secoesCrmParaPapeis } from "./secoes";

// Redireciona para a primeira seção permitida pelos papéis atuais do banco.
export default async function CrmIndex() {
  const { papeis } = await exigirSessaoPagina(Papel.ADMINISTRADOR, Papel.GERENTE_COMERCIAL);
  const primeira = secoesCrmParaPapeis(papeis)[0];
  redirect(primeira ? hrefSecaoCrm(primeira.id) : "/home");
}
