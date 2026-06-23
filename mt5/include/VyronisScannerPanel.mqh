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
   int building = 0, waiting = 0, alerted = 0;
   for(int i = 0; i < ArraySize(rows); i++)
   {
      if(rows[i].display_state == DISPLAY_BUILDING) building++;
      else if(rows[i].display_state == DISPLAY_WAITING) waiting++;
      else if(rows[i].display_state == DISPLAY_ALERTED) alerted++;
   }

   string panel = "=== Vyronis A+ Scanner v" + VYRONIS_SCANNER_VERSION + " ===\n";
   panel += "Session: " + ScannerSessionLabel(active_session);
   panel += " | Pairs: " + IntegerToString(ArraySize(rows));
   panel += " | Building: " + IntegerToString(building);
   panel += " | Waiting: " + IntegerToString(waiting);
   panel += " | A/A+: " + IntegerToString(alerted);
   panel += " | Alerts: " + IntegerToString(alert_count) + "\n";
   panel += "────────────────────────────────────────────────────\n";
   panel += "Pair      W/D/H4 Bias         State              Grade\n";
   panel += "────────────────────────────────────────────────────\n";

   for(int i = 0; i < ArraySize(rows); i++)
   {
      panel += StringFormat(
         "%-8s  %-18s  %-18s  %s\n",
         rows[i].symbol,
         rows[i].bias_text,
         ScannerDisplayStateToString(rows[i].display_state),
         rows[i].grade_text
      );
   }

   panel += "────────────────────────────────────────────────────\n";
   panel += "A/A+ = Live Signals | Building = Watchlist on Vyronis";
   Comment(panel);
}

#endif // VYRONIS_SCANNER_PANEL_MQH
