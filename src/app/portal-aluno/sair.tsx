"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function SairPortalAluno() {
  const router = useRouter(); const [saindo, setSaindo] = useState(false);
  return <button disabled={saindo} onClick={async () => { setSaindo(true); await fetch("/api/portal-aluno/sair", { method: "POST" }); router.replace("/portal-aluno/entrar"); router.refresh(); }} className="text-sm text-brand-700 underline disabled:opacity-60">{saindo ? "Saindo…" : "Sair"}</button>;
}
