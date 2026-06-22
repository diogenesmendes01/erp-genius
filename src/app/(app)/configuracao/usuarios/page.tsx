import { listarUsuarios } from "@/server/acesso/consultas";
import { UsuariosPainel, type UsuarioRow } from "./UsuariosPainel";

export default async function UsuariosPage() {
  const usuarios = await listarUsuarios();
  const rows: UsuarioRow[] = usuarios.map((u) => ({
    id: u.id,
    nome: u.nome,
    email: u.email,
    papeis: u.papeis,
    ativo: u.ativo,
    limiteDescontoPct: u.limiteDescontoPct,
    ultimoAcesso: u.ultimoAcesso ? u.ultimoAcesso.toISOString() : null,
  }));
  return <UsuariosPainel usuarios={rows} />;
}
