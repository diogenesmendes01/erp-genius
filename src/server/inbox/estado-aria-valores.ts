export const ESTADOS_ARIA = ["ia", "aprovacao", "handoff", "humano"] as const;
export type EstadoAria = (typeof ESTADOS_ARIA)[number];
