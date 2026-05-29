/** Flexible CSV header normalization and canonical column mapping. */

export function normalizeHeaderKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

const HEADER_ALIASES: Record<string, string[]> = {
  ticket: ["ticket", "deal", "position", "order", "position id", "deal ticket", "id"],
  open_time: [
    "open time",
    "time open",
    "entry time",
    "open date",
    "opened at",
    "entry date",
    "open datetime",
    "open date time",
  ],
  close_time: [
    "close time",
    "time close",
    "exit time",
    "close date",
    "closed at",
    "exit date",
    "close datetime",
    "close date time",
    "time 1",
    "time1",
    "time 2",
    "time2",
  ],
  date: ["date", "trade date", "trade date", "day", "trading date"],
  time: ["time"],
  symbol: ["symbol", "item", "instrument", "market"],
  pair: ["pair"],
  type: ["type", "order type", "trade type"],
  direction: ["direction", "side", "action", "buy sell"],
  volume: ["volume", "size", "lots", "quantity", "vol"],
  open_price: ["open price", "price open", "entry price"],
  close_price: ["close price", "price close", "exit price"],
  price: ["price"],
  sl: ["sl", "stop loss", "stoploss", "s l", "stop"],
  tp: ["tp", "take profit", "takeprofit", "t p", "target"],
  commission: ["commission", "commissions", "comm", "fee", "fees"],
  swap: ["swap", "storage"],
  profit: ["profit", "gross profit", "net profit"],
  pnl: ["pnl", "p l", "pl", "gain", "net pnl"],
  comment: ["comment", "notes", "description"],
  magic: ["magic", "magic number", "expert magic number", "expert"],
  account: ["account", "login", "account number"],
}

const ALIAS_TO_CANONICAL = new Map<string, string>()
for (const [canonical, aliases] of Object.entries(HEADER_ALIASES)) {
  ALIAS_TO_CANONICAL.set(normalizeHeaderKey(canonical), canonical)
  for (const alias of aliases) {
    ALIAS_TO_CANONICAL.set(normalizeHeaderKey(alias), canonical)
  }
}

export function resolveCanonicalHeader(header: string): string | null {
  const key = normalizeHeaderKey(header)
  return ALIAS_TO_CANONICAL.get(key) ?? null
}

export function buildHeaderMapping(headers: string[]): Record<string, string> {
  const mapping: Record<string, string> = {}
  for (const header of headers) {
    const canonical = resolveCanonicalHeader(header)
    mapping[header] = canonical ?? `(raw: ${normalizeHeaderKey(header)})`
  }
  return mapping
}

export function detectCsvDelimiter(sampleLine: string): "," | ";" | "\t" {
  const commas = (sampleLine.match(/,/g) ?? []).length
  const semis = (sampleLine.match(/;/g) ?? []).length
  const tabs = (sampleLine.match(/\t/g) ?? []).length
  if (semis > commas && semis >= tabs) return ";"
  if (tabs > commas && tabs >= semis) return "\t"
  return ","
}

export function parseCsvLineWithDelimiter(line: string, delimiter: string): string[] {
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
    if (char === delimiter && !inQuotes) {
      cells.push(current.trim())
      current = ""
      continue
    }
    current += char
  }

  cells.push(current.trim())
  return cells
}
