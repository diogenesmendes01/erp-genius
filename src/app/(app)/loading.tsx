"use client";

import { usePathname } from "next/navigation";
import { EsqueletoArea } from "@/components/Esqueleto";
import { areaDoEsqueleto } from "./esqueleto-area";

export default function LoadingApp() {
  const formato = areaDoEsqueleto(usePathname() ?? "");
  if (formato) return <EsqueletoArea rotulo={formato.rotulo} area={formato.area} />;
  return (
    <div className="space-y-4" aria-busy="true">
      <p className="sr-only" role="status">
        Carregando
      </p>
      <div data-esqueleto="titulo" className="h-7 w-48 rounded-md bg-gray-100" />
      <div className="h-24 rounded-lg bg-gray-100" />
      <div className="h-24 rounded-lg bg-gray-100" />
      <div className="h-24 rounded-lg bg-gray-100" />
    </div>
  );
}
