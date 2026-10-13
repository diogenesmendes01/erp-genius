"use client";

import { IconAlertTriangle } from "@tabler/icons-react";
import { EstadoRota } from "@/components/EstadoRota";

// Erro da página pública de pagamento (docs/43 §6 item 10). Sem este arquivo, uma falha ao consultar a
// cobrança caía no global-error, que troca a página inteira e manda "falar com um administrador" — texto
// de equipe, não de quem recebeu o link. Aqui: o formato da página pública (cartão no centro), "Tentar de
// novo" e a saída que a própria página dá (a Secretaria, pelo canal do link). Sem error.message nem digest.
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
