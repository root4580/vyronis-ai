//+------------------------------------------------------------------+
//| VyronisConfirm.mqh — M15 engulfing and rejection after CHoCH      |
//+------------------------------------------------------------------+
#ifndef VYRONIS_CONFIRM_MQH
#define VYRONIS_CONFIRM_MQH

#include <VyronisScannerTypes.mqh>

double ScannerM15Atr(const string symbol, const int period = 14)
{
   const int handle = iATR(symbol, PERIOD_M15, period);
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

ScannerConfirmResult ScannerDetectConfirm(
   const string symbol,
   const int direction,
   const datetime after_choch_time
)
{
   ScannerConfirmResult result;
   result.valid = false;
   result.type = CONF_NONE;
   result.bar_time = 0;
   result.label = "None";

   const double atr = ScannerM15Atr(symbol);
   const double minBody = (atr > 0) ? atr * 0.25 : ScannerPipSize(symbol) * 3;
   const double minRange = (atr > 0) ? atr * 0.2 : ScannerPipSize(symbol) * 2;
   const int bars = iBars(symbol, PERIOD_M15);
   if(bars < 5) return result;

   for(int shift = 1; shift < MathMin(12, bars - 2); shift++)
   {
      const datetime barTime = iTime(symbol, PERIOD_M15, shift);
      if(barTime <= after_choch_time) continue;

      const double open0 = iOpen(symbol, PERIOD_M15, shift);
      const double close0 = iClose(symbol, PERIOD_M15, shift);
      const double high0 = iHigh(symbol, PERIOD_M15, shift);
      const double low0 = iLow(symbol, PERIOD_M15, shift);
      const double open1 = iOpen(symbol, PERIOD_M15, shift + 1);
      const double close1 = iClose(symbol, PERIOD_M15, shift + 1);
      const double body0 = MathAbs(close0 - open0);
      const double range0 = high0 - low0;
      if(range0 <= 0) continue;

      if(direction == ORDER_TYPE_BUY)
      {
         const bool bearPrior = close1 < open1;
         const bool bullNow = close0 > open0;
         if(bearPrior && bullNow && body0 >= minBody
            && open0 <= close1 && close0 >= open1)
         {
            result.valid = true;
            result.type = CONF_ENGULF;
            result.bar_time = barTime;
            result.label = "Bullish engulfing (M15)";
            return result;
         }

         const double lowerWick = MathMin(open0, close0) - low0;
         if(range0 >= minRange && lowerWick / range0 >= 0.6
            && (close0 - low0) / range0 >= 0.75)
         {
            result.valid = true;
            result.type = CONF_REJECTION;
            result.bar_time = barTime;
            result.label = "Bullish rejection (M15)";
            return result;
         }
      }
      else
      {
         const bool bullPrior = close1 > open1;
         const bool bearNow = close0 < open0;
         if(bullPrior && bearNow && body0 >= minBody
            && open0 >= close1 && close0 <= open1)
         {
            result.valid = true;
            result.type = CONF_ENGULF;
            result.bar_time = barTime;
            result.label = "Bearish engulfing (M15)";
            return result;
         }

         const double upperWick = high0 - MathMax(open0, close0);
         if(range0 >= minRange && upperWick / range0 >= 0.6
            && (high0 - close0) / range0 >= 0.75)
         {
            result.valid = true;
            result.type = CONF_REJECTION;
            result.bar_time = barTime;
            result.label = "Bearish rejection (M15)";
            return result;
         }
      }
   }

   return result;
}

#endif // VYRONIS_CONFIRM_MQH
