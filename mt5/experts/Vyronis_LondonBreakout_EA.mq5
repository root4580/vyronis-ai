//+------------------------------------------------------------------+
//|                                      Vyronis_LondonBreakout_EA.mq5 |
//|                         Vyronis AI — Research Lab (Demo Only v1) |
//|  London session breakout of Asian range. CSV export → Vyronis.   |
//+------------------------------------------------------------------+
#property copyright "Vyronis AI"
#property link      "https://vyronis-ai.vercel.app/research-lab"
#property version   "1.00"
#property description "Demo-only London Breakout EA for Vyronis Research Lab CSV import."
#property strict

#include <Trade/Trade.mqh>

//--- Safety
input group "=== Safety (Demo Only) ==="
input bool   InpRequireDemoAccount   = true;       // Require demo account
input int    InpMagicNumber            = 92601001;   // Magic number (Vyronis LBO v1)

//--- Risk
input group "=== Risk Controls ==="
input double InpRiskPercent            = 0.25;     // Risk per trade (% equity)
input double InpMaxLot                 = 0.10;     // Max lot size
input double InpMinLot                 = 0.01;     // Min lot size
input double InpMaxDailyLossPercent    = 1.0;      // Max daily loss (% day-start equity)
input int    InpMaxConsecutiveLosses   = 3;        // Pause after N consecutive losses
input int    InpMaxSpreadPoints        = 20;       // Max spread (points)
input int    InpSlippagePoints         = 10;       // Max slippage (points)

//--- Sessions (broker server time)
input group "=== Session Windows (Server Time) ==="
input int    InpAsianStartHour         = 0;        // Asian range start hour
input int    InpAsianEndHour           = 7;        // Asian range end hour (inclusive)
input int    InpAsianEndMinute         = 59;       // Asian range end minute
input int    InpLondonStartHour        = 8;        // London entry start hour
input int    InpLondonStartMinute      = 0;        // London entry start minute
input int    InpLondonEndHour          = 11;       // London entry end hour
input int    InpLondonEndMinute        = 30;       // London entry end minute
input int    InpFlattenHour            = 12;       // Force flat hour
input int    InpFlattenMinute          = 30;       // Force flat minute

//--- Strategy
input group "=== Breakout Rules ==="
input double InpBreakoutBufferPips     = 2.0;      // Breakout buffer (pips)
input double InpSLBufferPips           = 2.0;      // SL buffer beyond range (pips)
input double InpTakeProfitR            = 1.5;      // Take profit (R multiple)
input double InpMinRangePips           = 15.0;     // Min Asian range (pips)
input double InpMaxRangePips           = 80.0;     // Max Asian range (pips)
input double InpMinSLPips              = 10.0;     // Min stop distance (pips)
input double InpMaxSLPips              = 40.0;     // Max stop distance (pips)
input ENUM_TIMEFRAMES InpSignalTimeframe = PERIOD_M15; // Signal timeframe

//--- Constants
const string EA_TAG = "Vyronis-LBO";

CTrade         g_trade;
datetime       g_currentDayStart     = 0;
double         g_asianHigh             = 0.0;
double         g_asianLow              = 0.0;
bool           g_rangeReady            = false;
bool           g_tradeTakenToday       = false;
double         g_dayStartEquity        = 0.0;
int            g_consecutiveLosses     = 0;
datetime       g_lastSignalBarTime     = 0;
bool           g_demoOk                = false;
bool           g_tradingPaused         = false;
bool           g_flattenDoneToday      = false;
string         g_statusLine            = "";

//+------------------------------------------------------------------+
//| Pip size helper                                                   |
//+------------------------------------------------------------------+
double PipSize()
{
   const int digits = (int)SymbolInfoInteger(_Symbol, SYMBOL_DIGITS);
   double point = SymbolInfoDouble(_Symbol, SYMBOL_POINT);
   if(digits == 3 || digits == 5)
      return point * 10.0;
   return point;
}

double PipsToPrice(const double pips)
{
   return pips * PipSize();
}

double RangePips(const double high, const double low)
{
   if(high <= 0.0 || low <= 0.0 || high <= low)
      return 0.0;
   return (high - low) / PipSize();
}

//+------------------------------------------------------------------+
//| Server-time helpers                                               |
//+------------------------------------------------------------------+
datetime DayStart(const datetime when)
{
   MqlDateTime dt;
   TimeToStruct(when, dt);
   dt.hour = 0;
   dt.min  = 0;
   dt.sec  = 0;
   return StructToTime(dt);
}

bool TimeInWindow(const datetime when,
                  const int startHour, const int startMinute,
                  const int endHour, const int endMinute)
{
   MqlDateTime dt;
   TimeToStruct(when, dt);
   const int nowMin   = dt.hour * 60 + dt.min;
   const int startMin = startHour * 60 + startMinute;
   const int endMin   = endHour * 60 + endMinute;
   return (nowMin >= startMin && nowMin <= endMin);
}

//+------------------------------------------------------------------+
//| Logging / UI                                                      |
//+------------------------------------------------------------------+
void LogInfo(const string message)
{
   PrintFormat("[%s] %s", EA_TAG, message);
}

void SetBlockedStatus(const string reason)
{
   g_statusLine = "DEMO ONLY — " + reason;
   Comment(g_statusLine);
}

void UpdateChartComment()
{
   if(!g_demoOk)
   {
      Comment(g_statusLine);
      return;
   }

   string rangeText = g_rangeReady
      ? StringFormat("Asian H/L: %.5f / %.5f (%.1f pips)",
                     g_asianHigh, g_asianLow, RangePips(g_asianHigh, g_asianLow))
      : "Asian range: building…";

   Comment(StringFormat("%s | Magic %d | %s | Trades today: %s | Loss streak: %d%s",
                        EA_TAG,
                        InpMagicNumber,
                        rangeText,
                        g_tradeTakenToday ? "YES" : "NO",
                        g_consecutiveLosses,
                        g_tradingPaused ? " | PAUSED" : ""));
}

//+------------------------------------------------------------------+
//| Demo-only guard                                                   |
//+------------------------------------------------------------------+
bool IsDemoAccount()
{
   const long tradeMode = AccountInfoInteger(ACCOUNT_TRADE_MODE);
   return (tradeMode == ACCOUNT_TRADE_MODE_DEMO);
}

bool TerminalAllowsTrading()
{
   if(!TerminalInfoInteger(TERMINAL_TRADE_ALLOWED))
      return false;
   if(!MQLInfoInteger(MQL_TRADE_ALLOWED))
      return false;
   return true;
}

bool ValidateSafety()
{
   if(InpRequireDemoAccount && !IsDemoAccount())
   {
      SetBlockedStatus("Live account blocked");
      LogInfo("BLOCKED: Live account detected. Demo only.");
      g_demoOk = false;
      return false;
   }

   if(!TerminalAllowsTrading())
   {
      SetBlockedStatus("AutoTrading disabled");
      LogInfo("BLOCKED: Enable Algo Trading in MT5.");
      g_demoOk = false;
      return false;
   }

   g_demoOk = true;
   return true;
}

//+------------------------------------------------------------------+
//| Daily reset                                                       |
//+------------------------------------------------------------------+
void ResetDailyState(const datetime now)
{
   g_currentDayStart   = DayStart(now);
   g_asianHigh         = 0.0;
   g_asianLow          = 0.0;
   g_rangeReady        = false;
   g_tradeTakenToday   = false;
   g_dayStartEquity    = AccountInfoDouble(ACCOUNT_EQUITY);
   g_tradingPaused     = (g_consecutiveLosses >= InpMaxConsecutiveLosses);
   g_lastSignalBarTime = 0;
   g_flattenDoneToday  = false;

   LogInfo(StringFormat("New day reset. Day-start equity: %.2f", g_dayStartEquity));
}

void EnsureDayState(const datetime now)
{
   const datetime dayStart = DayStart(now);
   if(dayStart != g_currentDayStart)
      ResetDailyState(now);
}

//+------------------------------------------------------------------+
//| Asian range calculation                                           |
//+------------------------------------------------------------------+
void CalculateAsianRange(const datetime now)
{
   const datetime dayStart = DayStart(now);
   MqlDateTime endDt;
   TimeToStruct(dayStart, endDt);
   endDt.hour = InpAsianEndHour;
   endDt.min  = InpAsianEndMinute;
   endDt.sec  = 59;
   const datetime rangeEnd = StructToTime(endDt);

   if(now < rangeEnd)
   {
      g_rangeReady = false;
      return;
   }

   double high = 0.0;
   double low  = 0.0;
   bool found  = false;

   const int bars = iBars(_Symbol, InpSignalTimeframe);
   for(int i = 0; i < bars; i++)
   {
      const datetime barTime = iTime(_Symbol, InpSignalTimeframe, i);
      if(barTime < dayStart)
         break;
      if(barTime > rangeEnd)
         continue;

      const double barHigh = iHigh(_Symbol, InpSignalTimeframe, i);
      const double barLow  = iLow(_Symbol, InpSignalTimeframe, i);

      if(!found)
      {
         high = barHigh;
         low  = barLow;
         found = true;
      }
      else
      {
         if(barHigh > high) high = barHigh;
         if(barLow < low)   low  = barLow;
      }
   }

   if(!found || high <= low)
   {
      g_rangeReady = false;
      return;
   }

   g_asianHigh  = high;
   g_asianLow   = low;
   g_rangeReady = true;
}

//+------------------------------------------------------------------+
//| Position / order helpers                                          |
//+------------------------------------------------------------------+
bool HasOpenPosition()
{
   for(int i = PositionsTotal() - 1; i >= 0; i--)
   {
      if(!g_trade.SelectByIndex(i))
         continue;
      if(g_trade.Symbol() != _Symbol)
         continue;
      if((int)g_trade.Magic() != InpMagicNumber)
         continue;
      return true;
   }
   return false;
}

int CurrentSpreadPoints()
{
   const double ask = SymbolInfoDouble(_Symbol, SYMBOL_ASK);
   const double bid = SymbolInfoDouble(_Symbol, SYMBOL_BID);
   const double point = SymbolInfoDouble(_Symbol, SYMBOL_POINT);
   if(point <= 0.0)
      return 999999;
   return (int)MathRound((ask - bid) / point);
}

bool DailyLossLimitHit()
{
   if(g_dayStartEquity <= 0.0)
      return false;

   const double equity = AccountInfoDouble(ACCOUNT_EQUITY);
   const double lossPct = ((g_dayStartEquity - equity) / g_dayStartEquity) * 100.0;
   return (lossPct >= InpMaxDailyLossPercent);
}

//+------------------------------------------------------------------+
//| Lot sizing                                                        |
//+------------------------------------------------------------------+
double NormalizeVolume(double volume)
{
   const double step = SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_STEP);
   const double minV = SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_MIN);
   const double maxV = SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_MAX);

   if(step > 0.0)
      volume = MathFloor(volume / step) * step;

   volume = MathMax(minV, volume);
   volume = MathMin(maxV, volume);
   volume = MathMin(InpMaxLot, volume);

   return NormalizeDouble(volume, 2);
}

double CalculateLots(const double entry, const double sl)
{
   const double slDistance = MathAbs(entry - sl);
   if(slDistance <= 0.0)
      return 0.0;

   const double tickSize  = SymbolInfoDouble(_Symbol, SYMBOL_TRADE_TICK_SIZE);
   const double tickValue = SymbolInfoDouble(_Symbol, SYMBOL_TRADE_TICK_VALUE);
   if(tickSize <= 0.0 || tickValue <= 0.0)
      return 0.0;

   const double riskMoney = AccountInfoDouble(ACCOUNT_EQUITY) * (InpRiskPercent / 100.0);
   const double lossPerLot = (slDistance / tickSize) * tickValue;
   if(lossPerLot <= 0.0)
      return 0.0;

   double lots = riskMoney / lossPerLot;
   lots = NormalizeVolume(lots);

   if(lots < InpMinLot)
   {
      LogInfo(StringFormat("Skip: computed lot %.2f below min %.2f", lots, InpMinLot));
      return 0.0;
   }

   return lots;
}

//+------------------------------------------------------------------+
//| Trade comment for Vyronis CSV traceability                        |
//+------------------------------------------------------------------+
string BuildComment(const string directionTag)
{
   return StringFormat("%s|%s|range=%.5f-%.5f|session=london",
                       EA_TAG,
                       directionTag,
                       g_asianHigh,
                       g_asianLow);
}

//+------------------------------------------------------------------+
//| Entry validation                                                  |
//+------------------------------------------------------------------+
bool RangeSizeValid()
{
   const double rangePips = RangePips(g_asianHigh, g_asianLow);
   if(rangePips < InpMinRangePips)
   {
      LogInfo(StringFormat("Skip: range %.1f pips below min %.1f", rangePips, InpMinRangePips));
      return false;
   }
   if(rangePips > InpMaxRangePips)
   {
      LogInfo(StringFormat("Skip: range %.1f pips above max %.1f", rangePips, InpMaxRangePips));
      return false;
   }
   return true;
}

bool StopDistanceValid(const double entry, const double sl)
{
   const double slPips = MathAbs(entry - sl) / PipSize();
   if(slPips < InpMinSLPips)
   {
      LogInfo(StringFormat("Skip: SL %.1f pips below min %.1f", slPips, InpMinSLPips));
      return false;
   }
   if(slPips > InpMaxSLPips)
   {
      LogInfo(StringFormat("Skip: SL %.1f pips above max %.1f", slPips, InpMaxSLPips));
      return false;
   }
   return true;
}

bool CanAttemptEntry(const datetime now)
{
   if(!g_demoOk)
      return false;
   if(g_tradingPaused)
      return false;
   if(g_tradeTakenToday)
      return false;
   if(HasOpenPosition())
      return false;
   if(DailyLossLimitHit())
   {
      LogInfo("Skip: daily loss limit reached.");
      return false;
   }
   if(!g_rangeReady)
      return false;
   if(!RangeSizeValid())
      return false;
   if(CurrentSpreadPoints() > InpMaxSpreadPoints)
   {
      LogInfo(StringFormat("Skip: spread %d > max %d", CurrentSpreadPoints(), InpMaxSpreadPoints));
      return false;
   }
   if(!TimeInWindow(now,
                    InpLondonStartHour, InpLondonStartMinute,
                    InpLondonEndHour, InpLondonEndMinute))
      return false;

   return true;
}

//+------------------------------------------------------------------+
//| Send market order                                                 |
//+------------------------------------------------------------------+
bool OpenBreakoutTrade(const ENUM_ORDER_TYPE orderType,
                       const double entry,
                       const double sl,
                       const double tp,
                       const string directionTag)
{
   const double lots = CalculateLots(entry, sl);
   if(lots <= 0.0)
      return false;

   g_trade.SetExpertMagicNumber(InpMagicNumber);
   g_trade.SetDeviationInPoints(InpSlippagePoints);
   g_trade.SetTypeFillingBySymbol(_Symbol);

   const string comment = BuildComment(directionTag);
   bool ok = false;

   if(orderType == ORDER_TYPE_BUY)
      ok = g_trade.Buy(lots, _Symbol, 0.0, sl, tp, comment);
   else
      ok = g_trade.Sell(lots, _Symbol, 0.0, sl, tp, comment);

   if(ok)
   {
      g_tradeTakenToday = true;
      LogInfo(StringFormat("Opened %s %.2f lots @ %.5f SL %.5f TP %.5f",
                           directionTag, lots, entry, sl, tp));
      return true;
   }

   LogInfo(StringFormat("Order failed (%s): %s", directionTag, g_trade.ResultRetcodeDescription()));
   return false;
}

bool BarCloseInEntryWindow(const datetime barOpenTime)
{
   const int periodSeconds = PeriodSeconds(InpSignalTimeframe);
   const datetime barCloseTime = barOpenTime + periodSeconds;

   MqlDateTime closeDt;
   TimeToStruct(barCloseTime, closeDt);
   const int closeMin = closeDt.hour * 60 + closeDt.min;

   const int startMin = InpLondonStartHour * 60 + InpLondonStartMinute;
   const int endMin   = InpLondonEndHour * 60 + InpLondonEndMinute;

   return (closeMin >= startMin && closeMin <= endMin);
}

//+------------------------------------------------------------------+
//| Evaluate closed signal bar                                        |
//+------------------------------------------------------------------+
void EvaluateBreakoutSignal()
{
   const datetime now = TimeCurrent();
   if(!CanAttemptEntry(now))
      return;

   const datetime barTime = iTime(_Symbol, InpSignalTimeframe, 1);
   if(barTime <= 0 || barTime == g_lastSignalBarTime)
      return;

   if(!BarCloseInEntryWindow(barTime))
      return;

   g_lastSignalBarTime = barTime;

   const double close1 = iClose(_Symbol, InpSignalTimeframe, 1);
   const double buffer = PipsToPrice(InpBreakoutBufferPips);
   const double slBuf  = PipsToPrice(InpSLBufferPips);

   const double buyTrigger  = g_asianHigh + buffer;
   const double sellTrigger = g_asianLow - buffer;

   // Buy breakout
   if(close1 > buyTrigger)
   {
      const double entry = SymbolInfoDouble(_Symbol, SYMBOL_ASK);
      const double sl    = g_asianLow - slBuf;
      const double risk  = entry - sl;
      const double tp    = entry + (risk * InpTakeProfitR);

      if(!StopDistanceValid(entry, sl))
         return;

      OpenBreakoutTrade(ORDER_TYPE_BUY, entry, sl, tp, "BUY");
      return;
   }

   // Sell breakout
   if(close1 < sellTrigger)
   {
      const double entry = SymbolInfoDouble(_Symbol, SYMBOL_BID);
      const double sl    = g_asianHigh + slBuf;
      const double risk  = sl - entry;
      const double tp    = entry - (risk * InpTakeProfitR);

      if(!StopDistanceValid(entry, sl))
         return;

      OpenBreakoutTrade(ORDER_TYPE_SELL, entry, sl, tp, "SELL");
   }
}

//+------------------------------------------------------------------+
//| Force flat at session end                                         |
//+------------------------------------------------------------------+
void ForceFlattenIfNeeded(const datetime now)
{
   MqlDateTime dt;
   TimeToStruct(now, dt);
   const int nowMin  = dt.hour * 60 + dt.min;
   const int flatMin = InpFlattenHour * 60 + InpFlattenMinute;

   if(nowMin < flatMin || g_flattenDoneToday)
      return;

   g_flattenDoneToday = true;

   for(int i = PositionsTotal() - 1; i >= 0; i--)
   {
      if(!g_trade.SelectByIndex(i))
         continue;
      if(g_trade.Symbol() != _Symbol)
         continue;
      if((int)g_trade.Magic() != InpMagicNumber)
         continue;

      const ulong ticket = g_trade.Ticket();
      if(g_trade.PositionClose(ticket))
         LogInfo(StringFormat("TIME_EXIT closed position #%I64u", ticket));
      else
         LogInfo(StringFormat("TIME_EXIT failed #%I64u: %s", ticket, g_trade.ResultRetcodeDescription()));
   }
}

//+------------------------------------------------------------------+
//| Track consecutive losses from last closed deal                    |
//+------------------------------------------------------------------+
void RefreshConsecutiveLosses()
{
   if(!HistorySelect(g_currentDayStart, TimeCurrent()))
      return;

   int streak = 0;
   const int total = HistoryDealsTotal();
   for(int i = total - 1; i >= 0; i--)
   {
      const ulong dealTicket = HistoryDealGetTicket(i);
      if(dealTicket == 0)
         continue;

      if(HistoryDealGetString(dealTicket, DEAL_SYMBOL) != _Symbol)
         continue;
      if((int)HistoryDealGetInteger(dealTicket, DEAL_MAGIC) != InpMagicNumber)
         continue;
      if((long)HistoryDealGetInteger(dealTicket, DEAL_ENTRY) != DEAL_ENTRY_OUT)
         continue;

      const double profit = HistoryDealGetDouble(dealTicket, DEAL_PROFIT)
                          + HistoryDealGetDouble(dealTicket, DEAL_SWAP)
                          + HistoryDealGetDouble(dealTicket, DEAL_COMMISSION);

      if(profit < -0.01)
      {
         streak++;
         continue;
      }

      if(profit > 0.01)
         break;

      // Break-even exits do not extend streak
      break;
   }

   g_consecutiveLosses = streak;
   if(g_consecutiveLosses >= InpMaxConsecutiveLosses)
      g_tradingPaused = true;
}

//+------------------------------------------------------------------+
//| New bar detector                                                  |
//+------------------------------------------------------------------+
bool IsNewSignalBar()
{
   static datetime lastBar = 0;
   const datetime currentBar = iTime(_Symbol, InpSignalTimeframe, 0);
   if(currentBar <= 0)
      return false;
   if(currentBar == lastBar)
      return false;
   lastBar = currentBar;
   return true;
}

//+------------------------------------------------------------------+
//| Expert initialization                                             |
//+------------------------------------------------------------------+
int OnInit()
{
   if(!ValidateSafety())
      return INIT_FAILED;

   g_trade.SetExpertMagicNumber(InpMagicNumber);
   g_trade.SetDeviationInPoints(InpSlippagePoints);

   ResetDailyState(TimeCurrent());
   CalculateAsianRange(TimeCurrent());
   RefreshConsecutiveLosses();
   UpdateChartComment();

   LogInfo(StringFormat("Initialized on %s demo=%s magic=%d",
                        _Symbol,
                        IsDemoAccount() ? "yes" : "no",
                        InpMagicNumber));
   return INIT_SUCCEEDED;
}

//+------------------------------------------------------------------+
//| Expert deinitialization                                           |
//+------------------------------------------------------------------+
void OnDeinit(const int reason)
{
   Comment("");
}

//+------------------------------------------------------------------+
//| Expert tick function                                              |
//+------------------------------------------------------------------+
void OnTick()
{
   if(!ValidateSafety())
      return;

   const datetime now = TimeCurrent();
   EnsureDayState(now);
   CalculateAsianRange(now);
   RefreshConsecutiveLosses();

   ForceFlattenIfNeeded(now);

   if(IsNewSignalBar())
      EvaluateBreakoutSignal();

   UpdateChartComment();
}

//+------------------------------------------------------------------+
//| Trade transaction — refresh loss streak after closes              |
//+------------------------------------------------------------------+
void OnTradeTransaction(const MqlTradeTransaction &trans,
                        const MqlTradeRequest &request,
                        const MqlTradeResult &result)
{
   if(trans.type == TRADE_TRANSACTION_DEAL_ADD)
      RefreshConsecutiveLosses();
}
