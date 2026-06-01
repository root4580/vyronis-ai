/** TradingView alert message template — paste into Pine `alert()` message field. */
export function buildTradingViewAlertTemplate(secret: string): string {
  return JSON.stringify(
    {
      secret,
      symbol: "{{ticker}}",
      timeframe: "15",
      direction: "{{strategy.order.action}}",
      strategy_name: "My Strategy",
      entry_zone: "{{close}}",
      stop_loss: "{{plot(\"SL\")}}",
      take_profit: "{{plot(\"TP\")}}",
      confidence: 70,
      message: "{{strategy.order.alert_message}}",
      chart_url: "https://www.tradingview.com/chart/?symbol={{ticker}}",
      image_url: null,
      alert_id: "{{timenow}}",
    },
    null,
    2,
  )
}

export function buildTradingViewAlertTemplatePlain(secret: string): string {
  return `{
  "secret": "${secret}",
  "symbol": "{{ticker}}",
  "timeframe": "15",
  "direction": "BUY",
  "strategy_name": "London Breakout",
  "entry_zone": "{{close}}",
  "stop_loss": 1.0820,
  "take_profit": 1.0920,
  "confidence": 72,
  "message": "Breakout setup",
  "chart_url": "https://www.tradingview.com/chart/?symbol={{ticker}}",
  "image_url": null
}`
}
