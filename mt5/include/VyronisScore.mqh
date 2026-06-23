//+------------------------------------------------------------------+
//| VyronisScore.mqh — gates, scoring, grade classification         |
//+------------------------------------------------------------------+
#ifndef VYRONIS_SCORE_MQH
#define VYRONIS_SCORE_MQH

#include <VyronisScannerTypes.mqh>

bool ScannerPassesHardGates(
   const bool in_session,
   const ScannerBiasResult &bias,
   const ScannerSweepResult &sweep,
   const ScannerAoiResult &aoi,
   const bool in_aoi,
   const ScannerChochResult &choch,
   const ScannerConfirmResult &confirm,
   const ScannerRiskResult &risk
)
{
   if(!in_session) return false;
   if(!bias.aligned) return false;
   if(!sweep.valid) return false;
   if(!aoi.valid || !in_aoi) return false;
   if(!choch.choch) return false;
   if(!confirm.valid) return false;
   if(!risk.meets_min_rr) return false;
   return true;
}

ENUM_SCANNER_GRADE ScannerClassifyScore(const int score)
{
   if(score >= 90) return GRADE_A_PLUS_SNIPER;
   if(score >= 80) return GRADE_A_STRONG;
   if(score >= 70) return GRADE_B_WATCHLIST;
   return GRADE_SKIP;
}

ScannerSignal ScannerEvaluateSignal(
   const string symbol,
   const string session_label,
   const ScannerBiasResult &bias,
   const ScannerSweepResult &sweep,
   const ScannerAoiResult &aoi,
   const ScannerChochResult &choch,
   const ScannerConfirmResult &confirm,
   const ScannerRiskResult &risk,
   const bool in_session
)
{
   ScannerSignal signal;
   signal.symbol = symbol;
   signal.pair_display = ScannerFormatPairDisplay(symbol);
   signal.direction = bias.direction;
   signal.weekly_bias = bias.weekly;
   signal.daily_bias = bias.daily;
   signal.h4_bias = bias.h4;
   signal.zone_type = aoi.valid ? aoi.zone_type : "None";
   signal.sweep_label = ScannerSweepSourceToString(sweep.source);
   signal.choch_label = choch.choch ? "Confirmed" : "None";
   signal.confirmation_type = confirm.label;
   signal.rr = risk.rr;
   signal.session = session_label;
   signal.bos_bonus = choch.bos;
   signal.grade = GRADE_SKIP;
   signal.grade_label = "Skip";
   signal.score = 0;
   signal.setup_id = "";

   if(!ScannerPassesHardGates(in_session, bias, sweep, aoi, true, choch, confirm, risk))
      return signal;

   int score = 18 + 14 + 14 + 14 + 10 + 12 + 14;
   if(choch.bos) score += 8;
   if(risk.rr >= 3.0) score += 2;
   if(score > 100) score = 100;

   signal.score = score;
   signal.grade = ScannerClassifyScore(score);
   signal.grade_label = ScannerGradeToLabel(signal.grade);

   MqlDateTime dt;
   TimeToStruct(TimeGMT(), dt);
   string sessionKey = (session_label == "London") ? "LON" : "NY";
   string monStr = (dt.mon < 10) ? ("0" + IntegerToString(dt.mon)) : IntegerToString(dt.mon);
   string dayStr = (dt.day < 10) ? ("0" + IntegerToString(dt.day)) : IntegerToString(dt.day);
   signal.setup_id = symbol + "-" + ScannerDirectionToString(bias.direction) + "-"
      + IntegerToString(dt.year) + monStr + dayStr
      + "-" + sessionKey + "-" + DoubleToString(sweep.level, (int)SymbolInfoInteger(symbol, SYMBOL_DIGITS))
      + "-" + aoi.id;

   signal.risk = risk;
   return signal;
}

#endif // VYRONIS_SCORE_MQH
