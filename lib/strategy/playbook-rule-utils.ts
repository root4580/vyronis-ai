import type { PlaybookRuleItem } from "@/lib/strategy/types"

export function rule(
  id: string,
  label: string,
  required = true,
  enabled = true,
): PlaybookRuleItem {
  return { id, label, enabled, required }
}

export function enabledRuleLabels(
  rules: Array<{ enabled: boolean; label: string }>,
): string[] {
  return rules.filter((item) => item.enabled).map((item) => item.label)
}
