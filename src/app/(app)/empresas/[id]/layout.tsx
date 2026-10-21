import type { Metadata } from "next";
import { tituloEmpresa } from "@/server/titulos-registro";

// Título de aba da ficha (E2): o nome do registro, com o mesmo escopo da página (ver titulos-registro).
// As seções filhas sem título próprio herdam este.
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  return { title: await tituloEmpresa(id) };
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
