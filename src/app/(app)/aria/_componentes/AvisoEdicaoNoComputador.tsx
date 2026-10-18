import { Aviso } from "@/components/Aviso";

/** No celular a configuração só se lê: editar é no computador. */
export function AvisoEdicaoNoComputador() {
  return (
    <div className="md:hidden">
      <Aviso tom="info">Edite a configuração da Aria no computador. No celular ficam disponíveis a pausa, a visão geral e o histórico.</Aviso>
    </div>
  );
}
