import { EsqueletoCartoes } from "@/components/Esqueleto";

// Seções da matrícula (docs/43 §6 item 10): fica dentro do layout de [id], que já desenha o cabeçalho
// (código · aluno · estado) e as abas das seções — aqui só o título da seção e os blocos dela. Ao ir da
// matrícula A para a B, o layout de B também é novo e quem cobre a espera é o (app)/loading.tsx.
export default function LoadingMatricula() {
  return <EsqueletoCartoes rotulo="seção da matrícula" />;
}
