import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import {
  createTradingAccount,
  ensureDefaultTradingAccount,
  listTradingAccounts,
  TradingAccountsTableMissingError,
} from "@/lib/accounts/trading-account-service"
import type { TradingAccountInput } from "@/lib/accounts/types"

export async function GET() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    let accounts = await listTradingAccounts(supabase, user.id)
    if (accounts.length === 0) {
      await ensureDefaultTradingAccount(supabase, user.id)
      accounts = await listTradingAccounts(supabase, user.id)
    }

    return NextResponse.json({ accounts })
  } catch (error) {
    if (error instanceof TradingAccountsTableMissingError) {
      return NextResponse.json({ error: error.message }, { status: 503 })
    }
    console.error("Accounts GET error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not load accounts" },
      { status: 500 },
    )
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = (await request.json().catch(() => ({}))) as TradingAccountInput & {
      makeDefault?: boolean
    }

    if (!body.name?.trim()) {
      return NextResponse.json({ error: "Account name is required" }, { status: 400 })
    }

    if (!Number.isFinite(body.starting_balance) || body.starting_balance <= 0) {
      return NextResponse.json({ error: "Starting balance must be greater than 0" }, { status: 400 })
    }

    const account = await createTradingAccount(supabase, user.id, body, {
      makeDefault: body.makeDefault,
    })

    return NextResponse.json({ account })
  } catch (error) {
    if (error instanceof TradingAccountsTableMissingError) {
      return NextResponse.json({ error: error.message }, { status: 503 })
    }
    console.error("Accounts POST error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not create account" },
      { status: 500 },
    )
  }
}
