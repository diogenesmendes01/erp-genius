import { IconFileUnknown } from "@tabler/icons-react";
import { EstadoRota } from "@/components/EstadoRota";

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
