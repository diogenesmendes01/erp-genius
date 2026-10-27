import { IconFileUnknown } from "@tabler/icons-react";
import { EstadoRota } from "@/components/EstadoRota";

export default function NaoEncontradoRaiz() {
  return (
    <EstadoRota
      icone={IconFileUnknown}
      titulo="Página não encontrada"
      texto="Este endereço não existe ou foi removido."
      acao={{ href: "/login", rotulo: "Ir para o início" }}
    />
  );
}
