import { autorizarVideoAulaInstitucional } from "@/server/gravacoes/aula-institucional";
import { VoltarPara } from "@/components/VoltarPara";

export default async function GravacaoAulaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let autorizada = false;
  try { await autorizarVideoAulaInstitucional(id); autorizada = true; } catch { /* Mesma resposta para fonte ausente ou sem permissão. */ }
  return <div className="space-y-4">
    <VoltarPara href="/diario" />
    <h1 className="text-2xl font-medium">Gravação da aula</h1>
    {autorizada ? <video className="w-full rounded bg-black" controls controlsList="nodownload" disablePictureInPicture preload="none"
      src={`/api/diario/encontros/${encodeURIComponent(id)}/video`} aria-label="Gravação institucional da aula">Seu navegador não suporta reprodução de vídeo.</video>
      : <p role="alert">Gravação indisponível para este acesso.</p>}
  </div>;
}
