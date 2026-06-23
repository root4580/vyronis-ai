/**
 * Auth callback diagnostics — run: npm run test:auth-callback
 */
import assert from "node:assert/strict"
import { NextRequest } from "next/server"
import { buildAuthCallbackDiagnostics } from "../lib/auth-callback-server"

function mockRequest(url: string): NextRequest {
  return new NextRequest(new URL(url, "https://vyronishq.com"))
}

const codeDiag = buildAuthCallbackDiagnostics(
  mockRequest(
    "https://vyronishq.com/auth/callback?code=abcdef123456&type=signup&next=%2Fhq",
  ),
)
assert.equal(codeDiag.hasCode, true)
assert.equal(codeDiag.hasTokenHash, false)
assert.equal(codeDiag.type, "signup")
assert.match(decodeURIComponent(codeDiag.redactedQuery), /code=\[len=12\]/)
assert.doesNotMatch(codeDiag.redactedQuery, /abcdef/)

const hashDiag = buildAuthCallbackDiagnostics(
  mockRequest(
    "https://vyronishq.com/auth/callback?token_hash=longtokenhashvalue&type=email",
  ),
)
assert.equal(hashDiag.hasTokenHash, true)
assert.equal(hashDiag.hasCode, false)
assert.match(decodeURIComponent(hashDiag.redactedQuery), /token_hash=\[len=18\]/)

console.log("✓ auth callback diagnostics tests passed")
