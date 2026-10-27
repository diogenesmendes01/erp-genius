import { useEffect } from "react";

export function pedirConfirmacaoDeSaida(evento: BeforeUnloadEvent) {
  evento.preventDefault();
  evento.returnValue = "";
}

export function useAvisoAoSair(sujo: boolean) {
  useEffect(() => {
    if (!sujo || typeof window === "undefined") return;
    window.addEventListener("beforeunload", pedirConfirmacaoDeSaida);
    return () => window.removeEventListener("beforeunload", pedirConfirmacaoDeSaida);
  }, [sujo]);
}
