//+------------------------------------------------------------------+
//| VyronisStructure.mqh — HTF bias, M15 CHoCH, BOS bonus             |
//+------------------------------------------------------------------+
#ifndef VYRONIS_STRUCTURE_MQH
#define VYRONIS_STRUCTURE_MQH

#include <VyronisScannerTypes.mqh>

bool ScannerIsSwingHigh(const string symbol, const ENUM_TIMEFRAMES tf, const int shift)
{
   const double h = iHigh(symbol, tf, shift);
   if(h <= 0) return false;
   for(int i = 1; i <= 2; i++)
   {
      if(iHigh(symbol, tf, shift + i) >= h) return false;
      if(iHigh(symbol, tf, shift - i) >= h) return false;
   }
   return true;
}

bool ScannerIsSwingLow(const string symbol, const ENUM_TIMEFRAMES tf, const int shift)
{
   const double l = iLow(symbol, tf, shift);
   if(l <= 0) return false;
   for(int i = 1; i <= 2; i++)
   {
      if(iLow(symbol, tf, shift + i) <= l) return false;
      if(iLow(symbol, tf, shift - i) <= l) return false;
   }
   return true;
}

bool ScannerCollectSwings(
   const string symbol,
   const ENUM_TIMEFRAMES tf,
   const int lookback,
   double &highs[],
   double &lows[]
)
{
   ArrayResize(highs, 0);
   ArrayResize(lows, 0);
   const int bars = iBars(symbol, tf);
   if(bars < 10) return false;

   const int maxShift = MathMin(lookback, bars - 3);
   for(int shift = 2; shift < maxShift; shift++)
   {
      if(ScannerIsSwingHigh(symbol, tf, shift))
      {
         int n = ArraySize(highs);
         ArrayResize(highs, n + 1);
         highs[n] = iHigh(symbol, tf, shift);
      }
      if(ScannerIsSwingLow(symbol, tf, shift))
      {
         int n = ArraySize(lows);
         ArrayResize(lows, n + 1);
         lows[n] = iLow(symbol, tf, shift);
      }
   }
   return ArraySize(highs) >= 2 && ArraySize(lows) >= 2;
}

ENUM_SCANNER_BIAS ScannerBiasFromSwings(const double &highs[], const double &lows[])
{
   if(ArraySize(highs) < 2 || ArraySize(lows) < 2) return BIAS_NEUTRAL;
   const bool hh = highs[0] > highs[1];
   const bool hl = lows[0] > lows[1];
   const bool lh = highs[0] < highs[1];
   const bool ll = lows[0] < lows[1];
   if(hh && hl) return BIAS_BULLISH;
   if(lh && ll) return BIAS_BEARISH;
   return BIAS_NEUTRAL;
}

ScannerBiasResult ScannerEvaluateBias(const string symbol)
{
   ScannerBiasResult result;
   result.daily = BIAS_NEUTRAL;
   result.h4 = BIAS_NEUTRAL;
   result.aligned = false;
   result.direction = -1;

   double dHighs[], dLows[], hHighs[], hLows[];
   if(!ScannerCollectSwings(symbol, PERIOD_D1, 30, dHighs, dLows)) return result;
   if(!ScannerCollectSwings(symbol, PERIOD_H4, 60, hHighs, hLows)) return result;

   result.daily = ScannerBiasFromSwings(dHighs, dLows);
   result.h4 = ScannerBiasFromSwings(hHighs, hLows);
   result.aligned = (result.daily == result.h4 && result.daily != BIAS_NEUTRAL);
   if(result.aligned)
      result.direction = (result.daily == BIAS_BULLISH) ? ORDER_TYPE_BUY : ORDER_TYPE_SELL;
   return result;
}

bool ScannerFindM15Swings(
   const string symbol,
   const int lookback,
   double &swingHigh,
   double &swingLow,
   int &highShift,
   int &lowShift
)
{
   swingHigh = 0;
   swingLow = 0;
   highShift = -1;
   lowShift = -1;
   const int bars = iBars(symbol, PERIOD_M15);
   if(bars < 10) return false;

   for(int shift = 2; shift < MathMin(lookback, bars - 3); shift++)
   {
      if(highShift < 0 && ScannerIsSwingHigh(symbol, PERIOD_M15, shift))
      {
         swingHigh = iHigh(symbol, PERIOD_M15, shift);
         highShift = shift;
      }
      if(lowShift < 0 && ScannerIsSwingLow(symbol, PERIOD_M15, shift))
      {
         swingLow = iLow(symbol, PERIOD_M15, shift);
         lowShift = shift;
      }
      if(highShift >= 0 && lowShift >= 0) break;
   }
   return highShift >= 0 && lowShift >= 0;
}

ScannerChochResult ScannerDetectChoch(
   const string symbol,
   const int direction,
   const datetime after_time
)
{
   ScannerChochResult result;
   result.choch = false;
   result.bos = false;
   result.bar_time = 0;

   const int bars = iBars(symbol, PERIOD_M15);
   if(bars < 12) return result;

   double swingHigh, swingLow;
   int highShift, lowShift;
   if(!ScannerFindM15Swings(symbol, 48, swingHigh, swingLow, highShift, lowShift))
      return result;

   for(int shift = 1; shift < MathMin(16, bars - 2); shift++)
   {
      const datetime barTime = iTime(symbol, PERIOD_M15, shift);
      if(barTime <= after_time) continue;

      const double close = iClose(symbol, PERIOD_M15, shift);
      if(direction == ORDER_TYPE_BUY)
      {
         if(close > swingHigh)
         {
            result.choch = true;
            result.bar_time = barTime;
            break;
         }
      }
      else
      {
         if(close < swingLow)
         {
            result.choch = true;
            result.bar_time = barTime;
            break;
         }
      }
   }

   if(!result.choch) return result;

   double postHigh = 0, postLow = DBL_MAX;
   for(int shift = 1; shift < MathMin(12, bars - 2); shift++)
   {
      const datetime barTime = iTime(symbol, PERIOD_M15, shift);
      if(barTime <= result.bar_time) continue;
      postHigh = MathMax(postHigh, iHigh(symbol, PERIOD_M15, shift));
      postLow = MathMin(postLow, iLow(symbol, PERIOD_M15, shift));
   }

   if(direction == ORDER_TYPE_BUY && postHigh > swingHigh * 1.0001)
      result.bos = true;
   if(direction == ORDER_TYPE_SELL && postLow < swingLow * 0.9999)
      result.bos = true;

   return result;
}

#endif // VYRONIS_STRUCTURE_MQH
