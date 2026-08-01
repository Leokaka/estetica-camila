/** Gera e baixa um CSV a partir de linhas de dados — separador ";" e BOM UTF-8
 * pra abrir certinho (acentos, decimal com vírgula) no Excel em pt-BR. */
export function exportarCSV(nomeArquivo: string, linhas: (string | number)[][]) {
  const csv = linhas
    .map(linha => linha.map(celula => {
      const texto = String(celula ?? '')
      return /[",;\n]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto
    }).join(';'))
    .join('\n')

  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = nomeArquivo
  link.click()
  URL.revokeObjectURL(url)
}
