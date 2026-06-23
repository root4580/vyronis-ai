//+------------------------------------------------------------------+
//| VyronisZones.mqh — H4 AOI: FVG, Order Block, Supply, Demand       |
//+------------------------------------------------------------------+
#ifndef VYRONIS_ZONES_MQH
#define VYRONIS_ZONES_MQH

#include <VyronisScannerTypes.mqh>
#include <VyronisStructure.mqh>
#include <VyronisFvg.mqh>

bool ScannerPriceReactingInZone(
   const string symbol,
   const double top,
   const double bottom
)
{
   const double lo = MathMin(top, bottom);
   const double hi = MathMax(top, bottom);
   if(ScannerPriceInFvg(symbol, top, bottom)) return true;

   const int bars = iBars(symbol, PERIOD_M15);
   for(int shift = 1; shift < MathMin(32, bars - 1); shift++)
   {
      if(iLow(symbol, PERIOD_M15, shift) <= hi && iHigh(symbol, PERIOD_M15, shift) >= lo)
         return true;
   }
   return false;
}

ScannerAoiResult ScannerFindOrderBlock(
   const string symbol,
   const int direction,
   const datetime after_time
)
{
   ScannerAoiResult result;
   result.valid = false;
   result.top = 0;
   result.bottom = 0;
   result.formed_at = 0;
   result.id = "";
   result.zone_type = "Order Block";

   const double atr = ScannerH4Atr(symbol);
   const double minBody = (atr > 0) ? atr * 0.8 : ScannerPipSize(symbol) * 8;
   const int bars = iBars(symbol, PERIOD_H4);
   if(bars < 12) return result;

   for(int shift = 3; shift < MathMin(50, bars - 4); shift++)
   {
      const datetime formed = iTime(symbol, PERIOD_H4, shift);
      if(formed < after_time) continue;

      const double open0 = iOpen(symbol, PERIOD_H4, shift);
      const double close0 = iClose(symbol, PERIOD_H4, shift);
      const double high0 = iHigh(symbol, PERIOD_H4, shift);
      const double low0 = iLow(symbol, PERIOD_H4, shift);
      const double open1 = iOpen(symbol, PERIOD_H4, shift - 1);
      const double close1 = iClose(symbol, PERIOD_H4, shift - 1);
      const double body1 = MathAbs(close1 - open1);

      if(direction == ORDER_TYPE_BUY)
      {
         const bool bearOb = close0 < open0;
         const bool bullImpulse = close1 > open1 && body1 >= minBody
            && close1 > high0;
         if(!bearOb || !bullImpulse) continue;
         result.valid = true;
         result.top = high0;
         result.bottom = low0;
         result.formed_at = formed;
         result.id = symbol + "-ob-bull-" + IntegerToString((long)formed);
         return result;
      }
      else
      {
         const bool bullOb = close0 > open0;
         const bool bearImpulse = close1 < open1 && body1 >= minBody
            && close1 < low0;
         if(!bullOb || !bearImpulse) continue;
         result.valid = true;
         result.top = high0;
         result.bottom = low0;
         result.formed_at = formed;
         result.id = symbol + "-ob-bear-" + IntegerToString((long)formed);
         return result;
      }
   }
   return result;
}

ScannerAoiResult ScannerFindSupplyDemandZone(
   const string symbol,
   const int direction,
   const datetime after_time
)
{
   ScannerAoiResult result;
   result.valid = false;
   result.top = 0;
   result.bottom = 0;
   result.formed_at = 0;
   result.id = "";
   result.zone_type = (direction == ORDER_TYPE_BUY) ? "Demand" : "Supply";

   const double pip = ScannerPipSize(symbol);
   const double zonePad = pip * 5;
   const int bars = iBars(symbol, PERIOD_H4);
   if(bars < 15) return result;

   for(int shift = 2; shift < MathMin(40, bars - 3); shift++)
   {
      const datetime formed = iTime(symbol, PERIOD_H4, shift);
      if(formed < after_time) continue;

      if(direction == ORDER_TYPE_SELL && ScannerIsSwingHigh(symbol, PERIOD_H4, shift))
      {
         const double level = iHigh(symbol, PERIOD_H4, shift);
         const double close = iClose(symbol, PERIOD_H4, shift);
         if(close < level - zonePad)
         {
            result.valid = true;
            result.top = level + zonePad;
            result.bottom = level - zonePad;
            result.formed_at = formed;
            result.id = symbol + "-supply-" + IntegerToString((long)formed);
            result.zone_type = "Supply";
            return result;
         }
      }
      if(direction == ORDER_TYPE_BUY && ScannerIsSwingLow(symbol, PERIOD_H4, shift))
      {
         const double level = iLow(symbol, PERIOD_H4, shift);
         const double close = iClose(symbol, PERIOD_H4, shift);
         if(close > level + zonePad)
         {
            result.valid = true;
            result.top = level + zonePad;
            result.bottom = level - zonePad;
            result.formed_at = formed;
            result.id = symbol + "-demand-" + IntegerToString((long)formed);
            result.zone_type = "Demand";
            return result;
         }
      }
   }
   return result;
}

ScannerAoiResult ScannerFvgToAoi(const ScannerFvgResult &fvg)
{
   ScannerAoiResult result;
   result.valid = fvg.valid;
   result.top = fvg.top;
   result.bottom = fvg.bottom;
   result.formed_at = fvg.formed_at;
   result.id = fvg.id;
   result.zone_type = "FVG";
   return result;
}

ScannerAoiResult ScannerFindActiveAoi(
   const string symbol,
   const int direction,
   const datetime after_time
)
{
   ScannerFvgResult fvg = ScannerFindActiveFvg(symbol, direction, after_time);
   if(fvg.valid)
   {
      ScannerAoiResult aoi = ScannerFvgToAoi(fvg);
      if(ScannerPriceReactingInZone(symbol, aoi.top, aoi.bottom))
         return aoi;
   }

   ScannerAoiResult ob = ScannerFindOrderBlock(symbol, direction, after_time);
   if(ob.valid && ScannerPriceReactingInZone(symbol, ob.top, ob.bottom))
      return ob;

   ScannerAoiResult sd = ScannerFindSupplyDemandZone(symbol, direction, after_time);
   if(sd.valid && ScannerPriceReactingInZone(symbol, sd.top, sd.bottom))
      return sd;

   ScannerAoiResult empty;
   empty.valid = false;
   empty.zone_type = "None";
   return empty;
}

#endif // VYRONIS_ZONES_MQH
