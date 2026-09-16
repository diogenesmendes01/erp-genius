"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { UploadArquivo } from "@/components/UploadArquivo";
import { anexarDocumentoMatricula } from "@/server/secretaria/acoes";
export function EvidenciaParticipantes({ matriculaId }: { matriculaId: string }) {
  const router = useRouter(), [erro, setErro] = useState("");
  return <div className="space-y-2 rounded border p-3"><p>Anexe as evidências antes de preencher a conferência. O arquivo ficará disponível para seleção nesta contratação.</p>
    <UploadArquivo matriculaId={matriculaId} categoriaDocumento="COMPROVANTE" label="Anexar evidência documental" onUpload={(arquivo) => {
      setErro(""); void anexarDocumentoMatricula(matriculaId, { ...arquivo, categoria: "COMPROVANTE" }).then((r) => { if (!r.ok) setErro(r.erro); else router.refresh(); }).catch(() => setErro("Não foi possível confirmar o vínculo do anexo. Consulte os documentos da matrícula antes de reenviar."));
    }} />{erro && <p role="alert">{erro}</p>}
  </div>;
}
