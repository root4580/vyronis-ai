export type JournalFieldStatus = "yes" | "no" | "not_provided"

export type JournalFieldReview = {
  field: string
  status: JournalFieldStatus
  display: string
  note: string
}

export function fieldStatusLabel(status: JournalFieldStatus): string {
  if (status === "yes") return "Yes"
  if (status === "no") return "No"
  return "Not verified"
}

export function notProvidedNote(field: string): string {
  return `${field}: Not verified from journal data.`
}

export function resolveLiquiditySweepStatus(aoiType?: string | null): JournalFieldReview {
  const aoi = aoiType?.trim() ?? ""
  if (aoi === "liquidity_sweep") {
    return {
      field: "Liquidity sweep",
      status: "yes",
      display: "Yes",
      note: "Liquidity sweep logged at the area of interest.",
    }
  }
  if (aoi === "none") {
    return {
      field: "Liquidity sweep",
      status: "no",
      display: "No",
      note: "You marked that no liquidity sweep was present.",
    }
  }
  return {
    field: "Liquidity sweep",
    status: "not_provided",
      display: "Not verified",
      note: notProvidedNote("Liquidity sweep"),
  }
}

export function resolveStructureStatus(
  field: "CHoCH" | "BOS",
  confirmationType?: string | null,
): JournalFieldReview {
  const confirmation = confirmationType?.trim().toLowerCase() ?? ""
  const key = field.toLowerCase()

  if (confirmation === key) {
    return {
      field,
      status: "yes",
      display: "Yes",
      note: `${field} confirmation logged on entry.`,
    }
  }
  if (confirmation === "none") {
    return {
      field,
      status: "no",
      display: "No",
      note: `You marked that no ${field} confirmation was present.`,
    }
  }
  return {
    field,
    status: "not_provided",
    display: "Not verified",
    note: notProvidedNote(field),
  }
}

/** Only explicit No deducts. Not provided is neutral. */
export function doctrineScoreAdjustment(reviews: JournalFieldReview[]): number {
  let delta = 0
  for (const review of reviews) {
    if (review.status === "yes") delta += 3
    if (review.status === "no") delta -= 4
  }
  return delta
}
