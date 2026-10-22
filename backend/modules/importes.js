import { comprobar } from "./restaurante.js";

// Los cálculos de dinero usan centavos enteros; SQL conserva DECIMAL(12,2).
export function centavos(valor) {
  const texto = String(valor);
  comprobar(
    /^\d{1,10}(?:\.\d{1,2})?$/.test(texto),
    "Importe inválido: usá como máximo dos decimales.",
  );
  const [entera, decimal = ""] = texto.split(".");
  const total = Number(entera) * 100 + Number(decimal.padEnd(2, "0"));
  comprobar(Number.isSafeInteger(total), "Importe fuera de rango.");
  return total;
}
export const decimal = (valor) => (valor / 100).toFixed(2);
