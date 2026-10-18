import { Papel } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { exigirSessaoPagina } from "@/server/_shared";
import { TagsCamposPainel } from "./TagsCamposPainel";

export default async function Pagina() {
  await exigirSessaoPagina(Papel.ADMINISTRADOR, Papel.GERENTE_COMERCIAL);
  const [tags, campos] = await Promise.all([
    prisma.tag.findMany({ where: { ativo: true }, orderBy: [{ grupo: "asc" }, { nome: "asc" }], select: { id: true, nome: true, grupo: true, cor: true } }),
    prisma.campoPersonalizado.findMany({ where: { arquivadoEm: null }, orderBy: [{ alvo: "asc" }, { nome: "asc" }], select: { id: true, nome: true, tipo: true, alvo: true, opcoes: true, obrigatorio: true } }),
  ]);
  return (
    <section aria-labelledby="titulo-secao">
      <h2 id="titulo-secao" className="text-lg font-semibold">Tags e campos</h2>
      <p className="mt-1 text-sm text-gray-600">Tags para classificar contatos e empresas e campos extras do cadastro. Arquivar tira das listas de seleção, mas mantém o que já foi preenchido.</p>
      <TagsCamposPainel tags={tags} campos={campos} />
    </section>
  );
}
