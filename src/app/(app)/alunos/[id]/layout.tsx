import type { Metadata } from "next";
import { tituloAluno } from "@/server/titulos-registro";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  return { title: await tituloAluno(id) };
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
