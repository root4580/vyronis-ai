const CURRENCY_SPOKEN_NAMES: Record<string, string> = {
  AUD: "Australian dollar",
  CAD: "Canadian dollar",
  CHF: "Swiss franc",
  EUR: "Euro",
  GBP: "British pound",
  JPY: "Japanese yen",
  NZD: "New Zealand dollar",
  USD: "U S dollar",
  XAU: "Gold",
  XAG: "Silver",
  BTC: "Bitcoin",
  ETH: "Ethereum",
}

const KNOWN_CURRENCY_CODES = new Set(Object.keys(CURRENCY_SPOKEN_NAMES))

function spokenCurrency(code: string): string {
  return CURRENCY_SPOKEN_NAMES[code.toUpperCase()] ?? code.toUpperCase()
}

function spokenForexPair(base: string, quote: string): string {
  return `${spokenCurrency(base)} ${spokenCurrency(quote)}`
}

function isLikelyForexPair(base: string, quote: string): boolean {
  return KNOWN_CURRENCY_CODES.has(base) && KNOWN_CURRENCY_CODES.has(quote)
}

/** Expand pair tickers for natural TTS — EURUSD → "Euro U S dollar". */
export function formatCouncilSpeechText(text: string): string {
  return text.replace(/\b([A-Za-z]{3})[\/\s-]?([A-Za-z]{3})\b/g, (match, base, quote) => {
    const normalizedBase = base.toUpperCase()
    const normalizedQuote = quote.toUpperCase()
    if (!isLikelyForexPair(normalizedBase, normalizedQuote)) return match
    return spokenForexPair(normalizedBase, normalizedQuote)
  })
}
