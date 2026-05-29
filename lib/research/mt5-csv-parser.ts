import type { Mt5CsvRow, ParsedMt5CsvResult } from "@/lib/research/types"
import { buildHeaderMapping } from "@/lib/journal/csv-header-utils"
import {
  buildJournalCsvColumnDiagnostics,
  logJournalCsvColumnDiagnostics,
  mapCsvTradeRow,
  type JournalCsvColumnDiagnostics,
} from "@/lib/journal/journal-csv-mapper"
import {
  detectCsvDelimiter,
  parseCsvLineWithDelimiter,
} from "@/lib/journal/csv-header-utils"

const MAX_CSV_BYTES = 5 * 1024 * 1024
const MAX_CSV_ROWS = 2000

function sanitizeHeader(header: string): string {
  return header.trim().replace(/^\uFEFF/, "")
}

function detectFormat(headers: string[]): ParsedMt5CsvResult["format"] {
  const joined = headers.join("|").toLowerCase()
  if (/close time|exit time|close date|time 1|time1/i.test(joined)) return "history"
  if (/deal|position id/i.test(joined)) return "deals"
  if (/order/i.test(joined) && /balance/i.test(joined)) return "orders"
  return "unknown"
}

export function parseMt5Csv(content: string): ParsedMt5CsvResult {
  const trimmed = content.trim()
  if (!trimmed) {
    throw new Error("CSV file is empty.")
  }

  if (trimmed.length > MAX_CSV_BYTES) {
    throw new Error("CSV file exceeds the 5 MB limit.")
  }

  const lines = trimmed.split(/\r?\n/).filter((line) => line.trim().length > 0)
  if (lines.length < 2) {
    throw new Error("CSV must include a header row and at least one data row.")
  }

  const delimiter = detectCsvDelimiter(lines[0])
  const rawHeaders = parseCsvLineWithDelimiter(lines[0], delimiter)
  const headers = rawHeaders.map(sanitizeHeader)
  const headerMapping = buildHeaderMapping(headers)
  const rows: Mt5CsvRow[] = []

  for (let i = 1; i < lines.length && rows.length < MAX_CSV_ROWS; i += 1) {
    const values = parseCsvLineWithDelimiter(lines[i], delimiter)
    if (values.every((cell) => !cell.trim())) continue
    rows.push(mapCsvTradeRow(headers, values))
  }

  if (rows.length === 0) {
    throw new Error("No trade rows found in CSV.")
  }

  if (lines.length - 1 > MAX_CSV_ROWS) {
    throw new Error(`CSV exceeds the ${MAX_CSV_ROWS} row limit. Split the file and import in batches.`)
  }

  const columnDiagnostics: JournalCsvColumnDiagnostics = buildJournalCsvColumnDiagnostics(
    headers,
    rows[0],
    delimiter,
  )
  logJournalCsvColumnDiagnostics(columnDiagnostics)

  console.log("[journal-csv-parse] headers detected", {
    headers,
    headerMapping,
    delimiter,
    mapper: "universal",
  })

  return {
    headers,
    rows,
    format: detectFormat(headers),
    delimiter,
    headerMapping,
    columnDiagnostics,
  }
}

export { MAX_CSV_BYTES, MAX_CSV_ROWS }
