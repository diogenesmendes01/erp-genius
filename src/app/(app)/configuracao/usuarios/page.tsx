import { Papel } from "@prisma/client";
import { exigirPapelLeitura } from "@/lib/guards";
import { AcessoNegado } from "@/components/AcessoNegado";
import { listarUsuarios } from "@/server/acesso/consultas";
import { consultarPreferenciaFusoEquipe } from "@/server/preferencias/fuso-exibicao";
import { UsuariosPainel, type UsuarioRow } from "./UsuariosPainel";

export default async function UsuariosPage() {
  const papeis = await exigirPapelLeitura(Papel.ADMINISTRADOR);
  if (!papeis) return <AcessoNegado recurso="a gestão de usuários" />;

  const [usuarios, preferencia] = await Promise.all([listarUsuarios(), consultarPreferenciaFusoEquipe()]);
  const rows: UsuarioRow[] = usuarios.map((u) => ({
    id: u.id,
    nome: u.nome,
    email: u.email,
    papeis: u.papeis,
    ativo: u.ativo,
    limiteDescontoPct: u.limiteDescontoPct,
    limiteDescontoTaxaPct: u.limiteDescontoTaxaPct,
    limiteDescontoMensalidadePct: u.limiteDescontoMensalidadePct,
    permissoes: u.permissoes,
    gerenteComercialId: u.gerenteComercialId,
    ultimoAcesso: u.ultimoAcesso ? u.ultimoAcesso.toISOString() : null,
  }));
  return <UsuariosPainel usuarios={rows} preferenciaFusoExibicao={(preferencia.ok ? preferencia.dado?.fusoExibicao : null) ?? null} />;
}
