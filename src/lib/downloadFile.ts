import saveAs from 'file-saver'

/** Dispara download de um Blob no navegador (file-saver). */
export function downloadBlob(data: Blob, filename: string) {
  saveAs(data, filename)
}

/** Dispara download de arquivo texto no navegador. */
export function downloadTextFile(content: string, filename: string, mimeType = 'text/csv;charset=utf-8') {
  downloadBlob(new Blob([content], { type: mimeType }), filename)
}

export function downloadPdfBlob(data: Blob, filename: string) {
  downloadBlob(data, filename)
}
