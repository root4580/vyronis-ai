//+------------------------------------------------------------------+
//| VyronisLiquidity.mqh — PDH/PDL and equal H/L sweeps               |
//+------------------------------------------------------------------+
#ifndef VYRONIS_LIQUIDITY_MQH
#define VYRONIS_LIQUIDITY_MQH

#include <VyronisScannerTypes.mqh>

bool ScannerDetectSweep(
   const string symbol,
   const int direction,
   ScannerSweepResult &result
)
{
   result.valid = false;
   result.source = SWEEP_NONE;
   result.level = 0;
   result.bar_time = 0;
   result.wick_extreme = 0;

   const double pip = ScannerPipSize(symbol);
   const double buffer = pip * 0.5;
   const int bars = iBars(symbol, PERIOD_M15);
   if(bars < 20) return false;

   const double pdh = iHigh(symbol, PERIOD_D1, 1);
   const double pdl = iLow(symbol, PERIOD_D1, 1);

   for(int shift = 1; shift < MathMin(48, bars - 2); shift++)
   {
      const double high = iHigh(symbol, PERIOD_M15, shift);
      const double low = iLow(symbol, PERIOD_M15, shift);
      const double close = iClose(symbol, PERIOD_M15, shift);
      const datetime barTime = iTime(symbol, PERIOD_M15, shift);

      if(direction == ORDER_TYPE_SELL)
      {
         if(high > pdh + buffer && close < pdh)
         {
            result.valid = true;
            result.source = SWEEP_PDH;
            result.level = pdh;
            result.bar_time = barTime;
            result.wick_extreme = high;
            return true;
         }
      }
      else
      {
         if(low < pdl - buffer && close > pdl)
         {
            result.valid = true;
            result.source = SWEEP_PDL;
            result.level = pdl;
            result.bar_time = barTime;
            result.wick_extreme = low;
            return true;
         }
      }
   }

   const double eqTol = pip * 3.0;
   for(int shift = 2; shift < MathMin(48, bars - 3); shift++)
   {
      const double levelHigh = iHigh(symbol, PERIOD_M15, shift + 1);
      const double levelLow = iLow(symbol, PERIOD_M15, shift + 1);
      int touchHigh = 0;
      int touchLow = 0;

      for(int j = shift; j < MathMin(shift + 20, bars - 2); j++)
      {
         if(MathAbs(iHigh(symbol, PERIOD_M15, j) - levelHigh) <= eqTol) touchHigh++;
         if(MathAbs(iLow(symbol, PERIOD_M15, j) - levelLow) <= eqTol) touchLow++;
      }

      const double high = iHigh(symbol, PERIOD_M15, shift);
      const double low = iLow(symbol, PERIOD_M15, shift);
      const double close = iClose(symbol, PERIOD_M15, shift);
      const datetime barTime = iTime(symbol, PERIOD_M15, shift);

      if(direction == ORDER_TYPE_SELL && touchHigh >= 2)
      {
         if(high > levelHigh + buffer && close < levelHigh)
         {
            result.valid = true;
            result.source = SWEEP_EQH;
            result.level = levelHigh;
            result.bar_time = barTime;
            result.wick_extreme = high;
            return true;
         }
      }
      if(direction == ORDER_TYPE_BUY && touchLow >= 2)
      {
         if(low < levelLow - buffer && close > levelLow)
         {
            result.valid = true;
            result.source = SWEEP_EQL;
            result.level = levelLow;
            result.bar_time = barTime;
            result.wick_extreme = low;
            return true;
         }
      }
   }

   return false;
}

#endif // VYRONIS_LIQUIDITY_MQH
