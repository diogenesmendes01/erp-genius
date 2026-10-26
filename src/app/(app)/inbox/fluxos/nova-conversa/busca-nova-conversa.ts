import type { ItemListaInbox } from "@/server/inbox/consultas-pagina";
import type { OpcoesAtendimento } from "@/server/whatsapp/operacoes-atendimento";
const comparar = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR").trim();
export function buscarNovaConversa(q: string, itens: ItemListaInbox[], destinos: OpcoesAtendimento["destinos"]) {
 const termo = comparar(q), digitos = q.replace(/\D/g, "");
 const conversas = itens.filter(c => !termo || comparar(c.contatoNome).includes(termo) || (digitos.length >= 3 && c.contatoTelefone.replace(/\D/g, "").includes(digitos)))
  .slice().sort((a, b) => (b.ultimaMensagemEm ?? "").localeCompare(a.ultimaMensagemEm ?? "")).slice(0, 8);
 const encontrados = destinos.filter(d => !termo || comparar(d.nome).includes(termo)).slice(0, 12);
 return { conversas, destinos: encontrados, numeroSemContato: digitos.length >= 10 && !conversas.length && !encontrados.length };
}
export function canaisDoDestino(destino: OpcoesAtendimento["destinos"][number] | undefined, numeros: OpcoesAtendimento["numeros"]) {
 return !destino ? [] : destino.finalidade === "COMERCIAL" ? numeros.filter(n => n.comercial) : numeros;
}
