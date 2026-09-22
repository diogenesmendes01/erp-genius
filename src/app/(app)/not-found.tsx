import { IconFileUnknown } from "@tabler/icons-react";
import { EstadoRota } from "@/components/EstadoRota";

// Cobre os notFound() das páginas dentro de (app) — o operador continua com a Sidebar,
// em vez de cair na tela em inglês do Next (ver docs/42-auditoria-frontend-ux.md,
// ganho rápido 1). Mensagem genérica de propósito: personalizar por domínio
// ("Turma não encontrada…") fica para outra PR.
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
