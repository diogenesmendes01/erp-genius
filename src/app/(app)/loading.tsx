"use client";

import { usePathname } from "next/navigation";
import { EsqueletoArea } from "@/components/Esqueleto";
import { areaDoEsqueleto } from "./esqueleto-area";

// Esqueleto do shell da equipe: troca de rota deixa de congelar a tela anterior (ver
// docs/42-auditoria-frontend-ux.md, ganho rápido 2). Rotas com loading.tsx próprio (ex.:
// financeiro/continuidade) continuam usando o deles — este só cobre quem não tem e, na primeira
// entrada numa área com layout próprio, a espera do próprio layout da área (#174). Nesse caso o
// formato é o da área de destino (título, cabeçalho do registro e abas), lido do caminho.
export default function LoadingApp() {
  const formato = areaDoEsqueleto(usePathname() ?? "");
  if (formato) return <EsqueletoArea rotulo={formato.rotulo} area={formato.area} />;
  return (
    <div className="space-y-4" aria-busy="true">
      <p className="sr-only" role="status">
        Carregando
      </p>
      <div data-esqueleto="titulo" className="h-7 w-48 rounded-md bg-surface-muted" />
      <div className="h-24 rounded-lg bg-surface-muted" />
      <div className="h-24 rounded-lg bg-surface-muted" />
      <div className="h-24 rounded-lg bg-surface-muted" />
    </div>
  );
}
