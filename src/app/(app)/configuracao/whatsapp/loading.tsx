import { EsqueletoTabela } from "@/components/Esqueleto";

// Seções do WhatsApp (#174): fica dentro do layout do WhatsApp, que desenha as abas das seções, e do layout da
// Configuração, que desenha o h1. Na troca de aba (números, templates, política, avisos) as duas barras
// continuam montadas — aqui só o conteúdo da seção.
export default function LoadingWhatsApp() {
  return <EsqueletoTabela rotulo="WhatsApp" />;
}
