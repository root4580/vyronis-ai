//+------------------------------------------------------------------+
//| VyronisRisk.mqh — entry, SL, TP, R:R for Precision Flow         |
//+------------------------------------------------------------------+
#ifndef VYRONIS_RISK_MQH
#define VYRONIS_RISK_MQH

#include <VyronisScannerTypes.mqh>
#include <VyronisStructure.mqh>

double ScannerAsiaHigh(const string symbol)
{
   MqlDateTime dt;
   TimeToStruct(TimeGMT(), dt);
   dt.hour = 0;
   dt.min = 0;
   dt.sec = 0;
   const datetime dayStart = StructToTime(dt);

   double hi = 0;
   const int bars = iBars(symbol, PERIOD_M15);
   for(int shift = 0; shift < MathMin(32, bars - 1); shift++)
   {
      const datetime t = iTime(symbol, PERIOD_M15, shift);
      if(t < dayStart) break;
      MqlDateTime barDt;
      TimeToStruct(t, barDt);
      if(barDt.hour >= 0 && barDt.hour < 7)
         hi = MathMax(hi, iHigh(symbol, PERIOD_M15, shift));
   }
   return hi;
}

double ScannerAsiaLow(const string symbol)
{
   MqlDateTime dt;
   TimeToStruct(TimeGMT(), dt);
   dt.hour = 0;
   dt.min = 0;
   dt.sec = 0;
   const datetime dayStart = StructToTime(dt);

   double lo = DBL_MAX;
   const int bars = iBars(symbol, PERIOD_M15);
   for(int shift = 0; shift < MathMin(32, bars - 1); shift++)
   {
      const datetime t = iTime(symbol, PERIOD_M15, shift);
      if(t < dayStart) break;
      MqlDateTime barDt;
      TimeToStruct(t, barDt);
      if(barDt.hour >= 0 && barDt.hour < 7)
         lo = MathMin(lo, iLow(symbol, PERIOD_M15, shift));
   }
   return (lo == DBL_MAX) ? 0 : lo;
}

ScannerRiskResult ScannerBuildRisk(
   const string symbol,
   const int direction,
   const ScannerSweepResult &sweep,
   const ScannerConfirmResult &confirm
)
{
   ScannerRiskResult result;
   result.entry = 0;
   result.sl = 0;
   result.tp = 0;
   result.rr = 0;
   result.meets_min_rr = false;

   if(!sweep.valid || !confirm.valid) return result;

   const double pip = ScannerPipSize(symbol);
   const double buffer = (StringFind(symbol, "JPY") >= 0) ? pip * 2 : pip * 0.2;
   result.entry = iClose(symbol, PERIOD_M15, 1);

   double swingHigh = 0, swingLow = 0;
   int highShift = -1, lowShift = -1;
   ScannerFindM15Swings(symbol, 80, swingHigh, swingLow, highShift, lowShift);

   const int h4HighShift = iHighest(symbol, PERIOD_H4, MODE_HIGH, 20, 1);
   const int h4LowShift = iLowest(symbol, PERIOD_H4, MODE_LOW, 20, 1);
   const double h4High = iHigh(symbol, PERIOD_H4, h4HighShift);
   const double h4Low = iLow(symbol, PERIOD_H4, h4LowShift);

   if(direction == ORDER_TYPE_BUY)
   {
      result.sl = sweep.wick_extreme - buffer;
      const double pdh = iHigh(symbol, PERIOD_D1, 0);
      const double asiaHi = ScannerAsiaHigh(symbol);
      result.tp = MathMax(pdh, MathMax(asiaHi, MathMax(swingHigh, h4High)));
      if(result.tp <= result.entry)
         result.tp = result.entry + (result.entry - result.sl) * 2.0;
   }
   else
   {
      result.sl = sweep.wick_extreme + buffer;
      const double pdl = iLow(symbol, PERIOD_D1, 0);
      const double asiaLo = ScannerAsiaLow(symbol);
      const double asiaTarget = (asiaLo > 0) ? asiaLo : pdl;
      result.tp = MathMin(pdl, MathMin(asiaTarget, MathMin(swingLow, h4Low)));
      if(result.tp >= result.entry)
         result.tp = result.entry - (result.sl - result.entry) * 2.0;
   }

   const double risk = MathAbs(result.entry - result.sl);
   const double reward = MathAbs(result.tp - result.entry);
   if(risk > 0)
      result.rr = reward / risk;
   result.meets_min_rr = (result.rr >= 2.0);
   return result;
}

#endif // VYRONIS_RISK_MQH
