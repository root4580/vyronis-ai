import type { Mt5CsvRow, ParsedMt5CsvResult } from "@/lib/research/types"

const MAX_CSV_BYTES = 5 * 1024 * 1024
const MAX_CSV_ROWS = 2000

const HEADER_ALIASES: Record<string, string[]> = {
  ticket: ["ticket", "deal", "position", "order", "position id", "deal ticket"],
  open_time: ["open time", "time open", "open_time", "time"],
  close_time: ["close time", "time close", "close_time", "time.1", "time_1"],
  symbol: ["symbol", "item", "instrument"],
  type: ["type", "direction", "side"],
  volume: ["volume", "size", "lots", "quantity"],
  open_price: ["open price", "price open", "price", "open_price"],
  close_price: ["close price", "price close", "price.1", "price_1", "close_price"],
  sl: ["s/l", "s / l", "sl", "stop loss", "stoploss"],
  tp: ["t/p", "t / p", "tp", "take profit", "takeprofit"],
  commission: ["commission", "comm"],
  swap: ["swap", "storage"],
  profit: ["profit", "pnl", "p/l", "net profit"],
  comment: ["comment", "notes"],
  magic: ["magic", "magic number", "expert magic number", "expert"],
  account: ["account", "login", "account number"],
}

function normalizeHeader(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ")
}

function parseCsvLine(line: string): string[] {
  const cells: string[] = []
  let current = ""
  let inQuotes = false

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i]
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"'
        i += 1
      } else {
        inQuotes = !inQuotes
      }
      continue
    }
    if (char === "," && !inQuotes) {
      cells.push(current.trim())
      current = ""
      continue
    }
    current += char
  }

  cells.push(current.trim())
  return cells
}

function detectFormat(headers: string[]): ParsedMt5CsvResult["format"] {
  const joined = headers.join("|")
  if (/close time|time\.1|time_1/i.test(joined)) return "history"
  if (/deal|position id/i.test(joined)) return "deals"
  if (/order/i.test(joined) && /balance/i.test(joined)) return "orders"
  return "unknown"
}

function resolveCanonicalKey(header: string): string | null {
  const normalized = normalizeHeader(header)
  for (const [canonical, aliases] of Object.entries(HEADER_ALIASES)) {
    if (aliases.some((alias) => normalized === alias || normalized.includes(alias))) {
      return canonical
    }
  }
  return null
}

function mapRow(headers: string[], values: string[]): Mt5CsvRow {
  const row: Mt5CsvRow = {}
  const usedCanonical = new Set<string>()

  headers.forEach((header, index) => {
    const canonical = resolveCanonicalKey(header)
    const value = values[index]?.trim() ?? ""
    if (!value) return

    if (canonical && !usedCanonical.has(canonical)) {
      row[canonical] = value
      usedCanonical.add(canonical)
      return
    }

    row[normalizeHeader(header).replace(/\s+/g, "_")] = value
  })

  return row
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

  const headers = parseCsvLine(lines[0]).map(normalizeHeader)
  const rows: Mt5CsvRow[] = []

  for (let i = 1; i < lines.length && rows.length < MAX_CSV_ROWS; i += 1) {
    const values = parseCsvLine(lines[i])
    if (values.every((cell) => !cell.trim())) continue
    rows.push(mapRow(headers, values))
  }

  if (rows.length === 0) {
    throw new Error("No trade rows found in CSV.")
  }

  if (lines.length - 1 > MAX_CSV_ROWS) {
    throw new Error(`CSV exceeds the ${MAX_CSV_ROWS} row limit. Split the file and import in batches.`)
  }

  return {
    headers,
    rows,
    format: detectFormat(headers),
  }
}

export { MAX_CSV_BYTES, MAX_CSV_ROWS }
