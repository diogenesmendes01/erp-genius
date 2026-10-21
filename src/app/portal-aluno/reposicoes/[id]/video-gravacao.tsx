"use client";

import { useState } from "react";

/** A fonte contém só o ID da reposição. A rota revalida a sessão e o estado
 * acadêmico a cada requisição Range; nenhum identificador do Drive chega aqui. */
export function VideoGravacaoPortalAluno({ reposicaoId }: { reposicaoId: string }) {
  const [erro, setErro] = useState(false);
  const fonte = `/api/portal-aluno/reposicoes/${encodeURIComponent(reposicaoId)}/video`;
  return <section className="mt-5 space-y-3 rounded border bg-surface p-5" aria-label="Gravação da reposição">
    <h2 className="font-medium">Assistir à gravação</h2>
    <video
      className="w-full rounded bg-black"
      controls
      controlsList="nodownload noremoteplayback"
      disablePictureInPicture
      preload="none"
      onError={() => setErro(true)}
    >
      <source src={fonte} />
      Seu navegador não oferece suporte à reprodução de vídeo.
    </video>
    <p className="text-sm text-gray-600">Após assistir, envie o resumo e a atividade para avaliação do professor. Assistir ao vídeo não conclui a reposição.</p>
    {erro && <p role="alert" className="text-sm text-red-700">Não foi possível reproduzir a gravação agora. Atualize a página ou tente novamente mais tarde.</p>}
  </section>;
}
