//+------------------------------------------------------------------+
//| VyronisScannerPanel.mqh — chart dashboard for all watchlist pairs |
//+------------------------------------------------------------------+
#ifndef VYRONIS_SCANNER_PANEL_MQH
#define VYRONIS_SCANNER_PANEL_MQH

#include <VyronisScannerTypes.mqh>

void ScannerUpdateChartPanel(
   const SymbolPanelRow &rows[],
   const int alert_count,
   const ENUM_SCANNER_SESSION active_session
)
{
   string panel = "=== Vyronis A+ Scanner v" + VYRONIS_SCANNER_VERSION + " ===\n";
   panel += "Session: " + ScannerSessionLabel(active_session);
   panel += " | Alerts: " + IntegerToString(alert_count) + "\n";
   panel += "────────────────────────────────────────\n";
   panel += "Pair      Bias           Sess    State       Scan(GMT)  Grade\n";
   panel += "────────────────────────────────────────\n";

   for(int i = 0; i < ArraySize(rows); i++)
   {
      string scanTime = (rows[i].last_scan > 0)
         ? TimeToString(rows[i].last_scan, TIME_MINUTES)
         : "—";
      panel += StringFormat(
         "%-8s  %-14s %-6s  %-10s  %-9s  %s\n",
         rows[i].symbol,
         rows[i].bias_text,
         rows[i].session_text,
         rows[i].state_text,
         scanTime,
         rows[i].grade_text
      );
   }

   panel += "────────────────────────────────────────\n";
   panel += "A+ Sniper = MT5 alert | A/B = Vyronis watchlist";
   Comment(panel);
}

#endif // VYRONIS_SCANNER_PANEL_MQH
