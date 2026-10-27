"use client";

import { IconAlertTriangle } from "@tabler/icons-react";
import { EstadoRota } from "@/components/EstadoRota";

export default function ErroPagar({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-10">
      <EstadoRota
        icone={IconAlertTriangle}
        titulo="Não foi possível abrir o pagamento"
        texto="Pode ter sido uma instabilidade passageira. Tente de novo em instantes. Se continuar, fale com a Secretaria da escola pelo canal em que recebeu este link."
        acao={{ onClick: reset, rotulo: "Tentar de novo" }}
      />
    </main>
  );
}
