/**
 * Remove fake MT5 pipeline test trades from the journal.
 *
 *   npx tsx scripts/cleanup-mt5-test-trades.ts
 *   npx tsx scripts/cleanup-mt5-test-trades.ts --dry-run
 */
import { loadEnvLocal } from "./load-env-local"
import { createServiceRoleClient } from "../lib/supabase/admin"

loadEnvLocal()

const dryRun = process.argv.includes("--dry-run")

async function main() {
  const supabase = createServiceRoleClient()

  const { data: candidates, error: listError } = await supabase
    .from("trades")
    .select("id, external_ticket, trade_notes, import_source, user_id, trade_date, pnl")
    .eq("import_source", "mt5_webhook")
    .or(
      [
        "external_ticket.like.mt5-quick-%",
        "external_ticket.like.mt5-test-%",
        "trade_notes.ilike.%vyronis-mt5%",
        "trade_notes.ilike.%pipeline-test%",
        "trade_notes.ilike.%quick-test%",
      ].join(","),
    )

  if (listError) throw new Error(listError.message)

  const rows = candidates ?? []
  if (rows.length === 0) {
    console.log("No MT5 test trades found.")
    return
  }

  console.log(`Found ${rows.length} test trade(s):`)
  for (const row of rows) {
    console.log(
      `  - ${row.id} ticket=${row.external_ticket} date=${row.trade_date} pnl=${row.pnl}`,
    )
  }

  if (dryRun) {
    console.log("Dry run — no rows deleted.")
    return
  }

  const ids = rows.map((r) => r.id)
  const { error: deleteError } = await supabase.from("trades").delete().in("id", ids)
  if (deleteError) throw new Error(deleteError.message)

  console.log(`Deleted ${ids.length} test trade(s).`)
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
