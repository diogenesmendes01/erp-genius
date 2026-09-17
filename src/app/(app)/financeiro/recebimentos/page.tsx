import Link from "next/link";
import { AcessoNegado } from "@/components/AcessoNegado";
import { exigirPapelLeitura } from "@/lib/guards";
import { listarContextosRecebimentoDestinado } from "@/server/financeiro/consultas";
import { RecebimentoDestinadoForm } from "./RecebimentoDestinadoForm";

export default async function RecebimentosPage() {
  const papeis = await exigirPapelLeitura("FINANCEIRO");
  if (!papeis) return <AcessoNegado recurso="o caixa" />;
  const contextos = await listarContextosRecebimentoDestinado();
  return <section className="mx-auto max-w-4xl space-y-5"><Link href="/financeiro" className="text-sm text-brand-700 underline">Voltar ao Financeiro</Link><div><h1 className="text-2xl font-medium">Registrar recebimento com destinações</h1><p className="mt-1 text-sm text-gray-600">Registre um fato de caixa e divida-o entre cobranças do mesmo contrato ou deixe o saldo como crédito explícito.</p></div><RecebimentoDestinadoForm contextos={contextos} /></section>;
}
