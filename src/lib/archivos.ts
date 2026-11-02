// Nombre de archivo sin tildes ni símbolos raros (evita problemas en el header HTTP)
export function nombreArchivo(s: string) {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/°/g, "")
    .replace(/[^\w\- ]+/g, "")
    .replace(/\s+/g, "_");
}
