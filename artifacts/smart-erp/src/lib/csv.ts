// Minimal CSV utilities (UTF-8 with BOM for Excel Arabic support)

export function downloadCSV(filename: string, headers: string[], rows: (string | number | null | undefined)[][]) {
  const escape = (v: string | number | null | undefined) => {
    const s = v === null || v === undefined ? "" : String(v)
    if (s.includes(",") || s.includes("\"") || s.includes("\n")) {
      return `"${s.replace(/"/g, '""')}"`
    }
    return s
  }
  const lines = [headers.map(escape).join(","), ...rows.map(r => r.map(escape).join(","))]
  // BOM so Excel opens UTF-8 Arabic correctly
  const csv = "\uFEFF" + lines.join("\n")
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

export function parseCSV(text: string): string[][] {
  // Strip BOM
  const raw = text.replace(/^\uFEFF/, "")
  const rows: string[][] = []
  let cur: string[] = []
  let field = ""
  let inQuotes = false
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i]
    if (inQuotes) {
      if (ch === "\"") {
        if (raw[i + 1] === "\"") { field += "\""; i++ }
        else { inQuotes = false }
      } else {
        field += ch
      }
    } else {
      if (ch === "\"") inQuotes = true
      else if (ch === ",") { cur.push(field); field = "" }
      else if (ch === "\n" || ch === "\r") {
        if (ch === "\r" && raw[i + 1] === "\n") i++
        cur.push(field); field = ""
        if (cur.some(c => c.length)) rows.push(cur)
        cur = []
      } else {
        field += ch
      }
    }
  }
  if (field.length || cur.length) { cur.push(field); rows.push(cur) }
  return rows
}
