/** Dreno serializado da tabela de entrada: implementação em `receber.ts`. */
export { drenarEventosMotor } from "./receber";
// Registra os processadores de cada tipo de evento em PROCESSADORES.
import "./processar-mensagem";
import "./processar-status";
import "./processar-alteracoes";
