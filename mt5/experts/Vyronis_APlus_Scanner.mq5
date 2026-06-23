//+------------------------------------------------------------------+
//| Vyronis_APlus_Scanner.mq5 — Precision Flow A+ setup scanner       |
//| Attach ONCE to any chart. Scans 6 pairs. Alert only.              |
//+------------------------------------------------------------------+
#property copyright "Vyronis AI"
#property version   "1.00"
#property description "Precision Flow scanner — A+ Sniper alerts + Vyronis webhook"

#include <VyronisScannerTypes.mqh>
#include <VyronisSession.mqh>
#include <VyronisStructure.mqh>
#include <VyronisLiquidity.mqh>
#include <VyronisFvg.mqh>
#include <VyronisConfirm.mqh>
#include <VyronisRisk.mqh>
#include <VyronisScore.mqh>
#include <VyronisScannerState.mqh>
#include <VyronisScannerWebhook.mqh>
#include <VyronisScannerPanel.mqh>

input string InpVyronisScannerUrl = "https://vyronishq.com/api/webhooks/mt5/scanner";
input string InpVyronisApiKey     = "";
input string InpSymbols           = "EURUSD,AUDUSD,GBPCAD,GBPNZD,CHFJPY,USDCHF";
input int    InpTimerSeconds      = 30;
input bool   InpScanOnNewM15Bar   = true;
input bool   InpPublishWatchlist  = true;
input bool   InpVerboseLog        = true;

string   g_symbols[];
datetime g_last_m15_bar[];
SymbolPanelRow g_panel_rows[];
int      g_alert_count = 0;

//+------------------------------------------------------------------+
int OnInit()
{
   if(StringLen(InpVyronisApiKey) < 16)
   {
      Alert("Vyronis Scanner: paste API key from Vyronis → Account Settings → MT5 auto-sync");
      return INIT_PARAMETERS_INCORRECT;
   }

   if(StringFind(InpVyronisScannerUrl, "http") != 0)
   {
      Alert("Vyronis Scanner: invalid webhook URL");
      return INIT_PARAMETERS_INCORRECT;
   }

   if(!ScannerParseSymbols(InpSymbols, g_symbols))
   {
      Alert("Vyronis Scanner: no valid symbols in InpSymbols");
      return INIT_PARAMETERS_INCORRECT;
   }

   ArrayResize(g_last_m15_bar, ArraySize(g_symbols));
   ArrayResize(g_panel_rows, ArraySize(g_symbols));
   ArrayInitialize(g_last_m15_bar, 0);

   for(int i = 0; i < ArraySize(g_symbols); i++)
   {
      SymbolSelect(g_symbols[i], true);
      g_panel_rows[i].symbol = g_symbols[i];
      g_panel_rows[i].bias_text = "—";
      g_panel_rows[i].session_text = "Off";
      g_panel_rows[i].state_text = "IDLE";
      g_panel_rows[i].grade_text = "Skip";
      g_panel_rows[i].last_scan = 0;
      g_panel_rows[i].phase = PHASE_IDLE;
   }

   EventSetTimer(MathMax(5, InpTimerSeconds));
   ScannerRefreshPanel();
   Print("Vyronis A+ Scanner: monitoring ", ArraySize(g_symbols), " pairs");
   return INIT_SUCCEEDED;
}

//+------------------------------------------------------------------+
void OnDeinit(const int reason)
{
   EventKillTimer();
   Comment("");
}

//+------------------------------------------------------------------+
void OnTimer()
{
   const ENUM_SCANNER_SESSION session = ScannerGetActiveSessionGMT();
   const string sessionLabel = ScannerSessionLabel(session);
   const bool inSession = (session != SESSION_NONE);

   for(int i = 0; i < ArraySize(g_symbols); i++)
   {
      const string symbol = g_symbols[i];
      g_panel_rows[i].last_scan = TimeGMT();
      g_panel_rows[i].session_text = inSession ? sessionLabel : "Off";

      if(InpScanOnNewM15Bar)
      {
         const datetime barTime = iTime(symbol, PERIOD_M15, 0);
         if(barTime == g_last_m15_bar[i])
         {
            ScannerRefreshPanel();
            continue;
         }
         g_last_m15_bar[i] = barTime;
      }

      ScannerRunSymbol(symbol, i, sessionLabel, inSession);
   }

   ScannerRefreshPanel();
}

//+------------------------------------------------------------------+
bool ScannerParseSymbols(const string csv, string &out[])
{
   string parts[];
   const int n = StringSplit(csv, ',', parts);
   ArrayResize(out, 0);
   for(int i = 0; i < n; i++)
   {
      string sym = parts[i];
      StringTrimLeft(sym);
      StringTrimRight(sym);
      if(StringLen(sym) < 3) continue;
      int sz = ArraySize(out);
      ArrayResize(out, sz + 1);
      out[sz] = sym;
   }
   return ArraySize(out) > 0;
}

//+------------------------------------------------------------------+
void ScannerRunSymbol(
   const string symbol,
   const int row_index,
   const string session_label,
   const bool in_session
)
{
   ScannerBiasResult bias = ScannerEvaluateBias(symbol);
   g_panel_rows[row_index].bias_text = ScannerBiasToString(bias.daily) + "/" + ScannerBiasToString(bias.h4);

   if(!in_session || !bias.aligned)
   {
      g_panel_rows[row_index].phase = PHASE_IDLE;
      g_panel_rows[row_index].state_text = "IDLE";
      g_panel_rows[row_index].grade_text = "Skip";
      return;
   }

   g_panel_rows[row_index].phase = PHASE_BIAS_OK;
   g_panel_rows[row_index].state_text = "BIAS_OK";

   ScannerSweepResult sweep;
   if(!ScannerDetectSweep(symbol, bias.direction, sweep))
   {
      g_panel_rows[row_index].grade_text = "Skip";
      return;
   }

   if(ScannerIsNewSweep(symbol, sweep.level))
      GlobalVariableDel(ScannerStateKey(symbol, "POSTED_HASH"));

   g_panel_rows[row_index].phase = PHASE_SWEPT;
   g_panel_rows[row_index].state_text = "SWEPT";

   ScannerFvgResult fvg = ScannerFindActiveFvg(symbol, bias.direction, sweep.bar_time);
   if(!fvg.valid || !ScannerPriceReactingInFvg(symbol, fvg))
   {
      g_panel_rows[row_index].grade_text = "Skip";
      return;
   }

   g_panel_rows[row_index].phase = PHASE_IN_FVG;
   g_panel_rows[row_index].state_text = "IN_FVG";

   ScannerChochResult choch = ScannerDetectChoch(symbol, bias.direction, sweep.bar_time);
   if(!choch.choch)
   {
      g_panel_rows[row_index].grade_text = "Skip";
      return;
   }

   g_panel_rows[row_index].phase = PHASE_CHOCH;
   g_panel_rows[row_index].state_text = "CHOCH";

   ScannerConfirmResult confirm = ScannerDetectConfirm(symbol, bias.direction, choch.bar_time);
   if(!confirm.valid)
   {
      g_panel_rows[row_index].grade_text = "Skip";
      return;
   }

   g_panel_rows[row_index].phase = PHASE_CONFIRMED;
   g_panel_rows[row_index].state_text = "CONFIRMED";

   ScannerRiskResult risk = ScannerBuildRisk(symbol, bias.direction, sweep, confirm);
   if(!risk.meets_min_rr)
   {
      g_panel_rows[row_index].grade_text = "Skip";
      return;
   }

   ScannerSignal signal = ScannerEvaluateSignal(
      symbol, session_label, bias, sweep, fvg, choch, confirm, risk, in_session
   );

   g_panel_rows[row_index].phase = PHASE_SCORED;
   g_panel_rows[row_index].state_text = "SCORED";
   g_panel_rows[row_index].grade_text = signal.grade_label;

   if(signal.grade == GRADE_SKIP) return;

   const string postedKey = ScannerStateKey(symbol, "POSTED_HASH");
   const int postHash = ScannerStringHash(signal.setup_id);
   const bool alreadyPosted = GlobalVariableCheck(postedKey)
      && (int)GlobalVariableGet(postedKey) == postHash;

   const bool publishWebhook =
      !alreadyPosted
      && (signal.grade == GRADE_A_PLUS_SNIPER
         || (InpPublishWatchlist && (signal.grade == GRADE_A_STRONG || signal.grade == GRADE_B_WATCHLIST)));

   if(publishWebhook)
   {
      int status = 0;
      string response = "";
      if(ScannerPostSignal(InpVyronisScannerUrl, InpVyronisApiKey, signal, status, response))
      {
         GlobalVariableSet(postedKey, (double)postHash);
         if(InpVerboseLog)
            Print("Vyronis Scanner webhook OK ", symbol, " ", signal.grade_label, " HTTP=", status);
      }
      else if(InpVerboseLog)
         Print("Vyronis Scanner webhook FAIL ", symbol, " HTTP=", status, " ", response);
   }

   if(ScannerShouldFireAlert(symbol, signal, sweep))
   {
      Alert(ScannerFormatAlertText(signal));
      ScannerMarkSetupAlerted(symbol, signal, sweep);
      g_alert_count++;
      if(InpVerboseLog)
         Print("Vyronis Scanner ALERT ", symbol, " ", signal.grade_label, " score=", signal.score);
   }
}

//+------------------------------------------------------------------+
void ScannerRefreshPanel()
{
   ScannerUpdateChartPanel(g_panel_rows, g_alert_count, ScannerGetActiveSessionGMT());
}

//+------------------------------------------------------------------+
