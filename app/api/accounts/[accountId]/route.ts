import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import {
  deleteTradingAccount,
  getTradingAccount,
  lockTradingAccountStartingBalance,
  updateTradingAccount,
  TradingAccountsTableMissingError,
} from "@/lib/accounts/trading-account-service"
import type { TradingAccountUpdate } from "@/lib/accounts/types"

type RouteContext = { params: Promise<{ accountId: string }> }

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { accountId } = await context.params
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = (await request.json().catch(() => ({}))) as TradingAccountUpdate & {
      lockStartingBalance?: boolean
    }

    if (body.lockStartingBalance === true) {
      await lockTradingAccountStartingBalance(supabase, user.id, accountId)
      const account = await getTradingAccount(supabase, user.id, accountId)
      return NextResponse.json({ account })
    }

    const { lockStartingBalance: _lock, ...patch } = body
    const account = await updateTradingAccount(supabase, user.id, accountId, patch)
    return NextResponse.json({ account })
  } catch (error) {
    if (error instanceof TradingAccountsTableMissingError) {
      return NextResponse.json({ error: error.message }, { status: 503 })
    }
    console.error("Account PATCH error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not update account" },
      { status: 400 },
    )
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { accountId } = await context.params
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    await deleteTradingAccount(supabase, user.id, accountId)
    return NextResponse.json({ ok: true })
  } catch (error) {
    if (error instanceof TradingAccountsTableMissingError) {
      return NextResponse.json({ error: error.message }, { status: 503 })
    }
    console.error("Account DELETE error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not delete account" },
      { status: 400 },
    )
  }
}
