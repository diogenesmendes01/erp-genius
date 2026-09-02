import { Papel } from "@prisma/client";
import { exigirPapelLeitura } from "@/lib/guards";
import { AcessoNegado } from "@/components/AcessoNegado";
import { listarEmpresas } from "@/server/empresas/consultas";
import { listarPaisesSimples } from "@/server/paises/consultas";
import { EmpresasCliente } from "./EmpresasCliente";

// B2B — Fase 2 (doc 03): lista de empresas (contrato corporativo). Guard server-side
// ANTES de buscar dados; papéis alinhados ao nav.

const PAPEIS: Papel[] = [Papel.GERENTE_COMERCIAL, Papel.FINANCEIRO, Papel.SECRETARIA_ACADEMICA];

export default async function EmpresasPage() {
  const papeis = await exigirPapelLeitura(...PAPEIS);
  if (!papeis) return <AcessoNegado recurso="as empresas (B2B)" />;

  const [empresas, paises] = await Promise.all([listarEmpresas(), listarPaisesSimples()]);
  return (
    <EmpresasCliente
      empresas={empresas}
      paises={paises}
    />
  );
}
