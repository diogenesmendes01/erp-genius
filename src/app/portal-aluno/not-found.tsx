import { IconFileUnknown } from "@tabler/icons-react";
import { EstadoRota } from "@/components/EstadoRota";

// Cobre notFound() no portal — em particular, reposição/registro que não pertence ao
// aluno autenticado (ErroPermissao em reposicoes/[id]/page.tsx). Mensagem neutra de
// propósito: não confirma nem nega que o registro existe para outra conta (mesmo
// padrão fail-closed do resto do portal).
export default function NaoEncontradoPortalAluno() {
  return (
    <EstadoRota
      icone={IconFileUnknown}
      titulo="Não encontramos essa página"
      texto="O endereço pode estar incorreto ou o link pode ter expirado."
      acao={{ href: "/portal-aluno", rotulo: "Voltar à área do aluno" }}
    />
  );
}
