import { redirect } from "next/navigation";

/** Endereço legado: a identidade do aluno permanece no portal de convites. */
export default function PortalLegado() { redirect("/portal-aluno"); }
