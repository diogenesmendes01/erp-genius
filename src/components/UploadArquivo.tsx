"use client";

import { useState } from "react";
import { IconUpload } from "@tabler/icons-react";

// Restrições espelham a validação do servidor (POST /api/upload).
const TIPOS_OK = ["application/pdf", "image/jpeg", "image/png"];
const MAX_BYTES = 10 * 1024 * 1024; // 10MB
const RESTRICOES = "PDF, JPG ou PNG · até 10MB";

// Upload de arquivo (PDF/JPG/PNG) → POST /api/upload → devolve { url, nome }.
// A url aponta para a rota autenticada /api/files (storage privado).
export function UploadArquivo({
  onUpload,
  label = "Anexar arquivo",
}: {
  onUpload: (r: { url: string; nome: string }) => void;
  label?: string;
}) {
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function handle(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setErro(null);
    // Validação local (UX) antes de enviar — o servidor revalida.
    if (!TIPOS_OK.includes(file.type)) {
      setErro("Tipo inválido (use PDF, JPG ou PNG).");
      e.target.value = "";
      return;
    }
    if (file.size > MAX_BYTES) {
      setErro("Arquivo acima de 10MB.");
      e.target.value = "";
      return;
    }
    setEnviando(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) {
        setErro(data.erro ?? "Falha no upload.");
        return;
      }
      onUpload({ url: data.url, nome: data.nome });
    } catch {
      setErro("Falha no upload.");
    } finally {
      setEnviando(false);
      e.target.value = "";
    }
  }

  return (
    <div>
      <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50">
        <IconUpload className="h-4 w-4" />
        {enviando ? "Enviando…" : label}
        <input type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" onChange={handle} disabled={enviando} />
      </label>
      <p className="mt-1 text-xs text-gray-400">{RESTRICOES}</p>
      {erro && <p className="mt-1 text-xs text-red-600">{erro}</p>}
    </div>
  );
}
