import { IconFileUnknown } from "@tabler/icons-react";
import { EstadoRota } from "@/components/EstadoRota";

export default function NaoEncontradoApp() {
  return (
    <EstadoRota
      icone={IconFileUnknown}
      titulo="Registro não encontrado"
      texto="Este endereço não existe, o registro foi apagado ou está fora do seu escopo. Volte à lista e abra de novo."
      acao={{ href: "/home", rotulo: "Voltar ao início" }}
    />
  );
}
