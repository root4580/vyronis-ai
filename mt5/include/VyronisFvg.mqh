//+------------------------------------------------------------------+
//| VyronisFvg.mqh — H4 fair value gap detection                      |
//+------------------------------------------------------------------+
#ifndef VYRONIS_FVG_MQH
#define VYRONIS_FVG_MQH

#include <VyronisScannerTypes.mqh>

double ScannerH4Atr(const string symbol, const int period = 14)
{
   const int handle = iATR(symbol, PERIOD_H4, period);
   if(handle == INVALID_HANDLE) return 0;
   double buf[];
   ArraySetAsSeries(buf, true);
   if(CopyBuffer(handle, 0, 1, 1, buf) < 1)
   {
      IndicatorRelease(handle);
      return 0;
   }
   IndicatorRelease(handle);
   return buf[0];
}

bool ScannerPriceInFvg(const string symbol, const double top, const double bottom)
{
   const double bid = SymbolInfoDouble(symbol, SYMBOL_BID);
   const double ask = SymbolInfoDouble(symbol, SYMBOL_ASK);
   const double mid = (bid + ask) * 0.5;
   const double lo = MathMin(top, bottom);
   const double hi = MathMax(top, bottom);
   return mid >= lo && mid <= hi;
}

bool ScannerFvgMitigated(const string symbol, const double top, const double bottom, const datetime formed_at)
{
   const double lo = MathMin(top, bottom);
   const double hi = MathMax(top, bottom);
   const int bars = iBars(symbol, PERIOD_H4);
   for(int shift = 1; shift < MathMin(40, bars - 1); shift++)
   {
      if(iTime(symbol, PERIOD_H4, shift) < formed_at) break;
      const double close = iClose(symbol, PERIOD_H4, shift);
      if(close < lo || close > hi) continue;
      if(iLow(symbol, PERIOD_H4, shift) <= lo && iHigh(symbol, PERIOD_H4, shift) >= hi)
         return true;
   }
   return false;
}

ScannerFvgResult ScannerFindActiveFvg(
   const string symbol,
   const int direction,
   const datetime after_time
)
{
   ScannerFvgResult result;
   result.valid = false;
   result.top = 0;
   result.bottom = 0;
   result.formed_at = 0;
   result.id = "";

   const double atr = ScannerH4Atr(symbol);
   const double minGap = (atr > 0) ? atr * 0.3 : ScannerPipSize(symbol) * 5;
   const int bars = iBars(symbol, PERIOD_H4);
   if(bars < 10) return result;

   for(int shift = 2; shift < MathMin(60, bars - 3); shift++)
   {
      const datetime formed = iTime(symbol, PERIOD_H4, shift);
      if(formed < after_time) continue;

      if(direction == ORDER_TYPE_BUY)
      {
         const double gapLow = iLow(symbol, PERIOD_H4, shift);
         const double gapHigh = iHigh(symbol, PERIOD_H4, shift + 2);
         if(gapLow > gapHigh && (gapLow - gapHigh) >= minGap)
         {
            if(ScannerFvgMitigated(symbol, gapLow, gapHigh, formed)) continue;
            result.valid = true;
            result.top = gapLow;
            result.bottom = gapHigh;
            result.formed_at = formed;
            result.id = symbol + "-fvg-bull-" + IntegerToString((long)formed);
            return result;
         }
      }
      else
      {
         const double gapHigh = iHigh(symbol, PERIOD_H4, shift);
         const double gapLow = iLow(symbol, PERIOD_H4, shift + 2);
         if(gapHigh < gapLow && (gapLow - gapHigh) >= minGap)
         {
            if(ScannerFvgMitigated(symbol, gapHigh, gapLow, formed)) continue;
            result.valid = true;
            result.top = gapLow;
            result.bottom = gapHigh;
            result.formed_at = formed;
            result.id = symbol + "-fvg-bear-" + IntegerToString((long)formed);
            return result;
         }
      }
   }

   return result;
}

bool ScannerPriceReactingInFvg(
   const string symbol,
   const ScannerFvgResult &fvg
)
{
   if(!fvg.valid) return false;
   if(ScannerPriceInFvg(symbol, fvg.top, fvg.bottom)) return true;

   const int bars = iBars(symbol, PERIOD_M15);
   for(int shift = 1; shift < MathMin(32, bars - 1); shift++)
   {
      const double lo = MathMin(fvg.top, fvg.bottom);
      const double hi = MathMax(fvg.top, fvg.bottom);
      if(iLow(symbol, PERIOD_M15, shift) <= hi && iHigh(symbol, PERIOD_M15, shift) >= lo)
         return true;
   }
   return false;
}

#endif // VYRONIS_FVG_MQH
