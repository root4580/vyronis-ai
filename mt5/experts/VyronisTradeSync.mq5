//+------------------------------------------------------------------+
//| VyronisTradeSync.mq5 — account-wide closed trade sync to Vyronis   |
//| Attach ONCE to any chart (e.g. EURUSD H1). Watches ALL symbols.   |
//+------------------------------------------------------------------+
#property copyright "Vyronis AI"
#property version   "1.10"
#property description "Syncs every closed deal on the account to Vyronis. One chart only."

#include <VyronisTradeWebhook.mqh>

//--- inputs
input string InpVyronisWebhookUrl = "https://vyronishq.com/api/webhooks/mt5/trades";
input string InpVyronisApiKey     = "";
input int    InpSyncHistoryHours   = 0;     // backfill on attach: 0 = full account history
input int    InpScanLookbackHours  = 168;   // timer scan window (all symbols)
input int    InpScanIntervalSec    = 45;    // account-wide scan interval (0 = off)
input int    InpMaxRetries         = 3;
input int    InpPingIntervalSec    = 120;   // keep-alive ping (0 = off)
input bool   InpPingOnAttach       = true;
input bool   InpVerboseLog        = true;

//--- status (account-wide, not chart-specific)
int      g_syncedCount   = 0;
int      g_failCount     = 0;
datetime g_lastSyncTime  = 0;
string   g_accountLogin  = "";
string   g_broker        = "";
int      g_timerTicks    = 0;

//+------------------------------------------------------------------+
//| Expert initialization                                             |
//+------------------------------------------------------------------+
int OnInit()
{
   if(StringLen(InpVyronisApiKey) < 16)
   {
      Alert("Vyronis: paste API key from Vyronis → Trade Journal → MT5 Connection");
      return INIT_PARAMETERS_INCORRECT;
   }

   if(StringFind(InpVyronisWebhookUrl, "http") != 0)
   {
      Alert("Vyronis: invalid webhook URL");
      return INIT_PARAMETERS_INCORRECT;
   }

   g_accountLogin = IntegerToString((long)AccountInfoInteger(ACCOUNT_LOGIN));
   g_broker = AccountInfoString(ACCOUNT_SERVER);

   VyronisUpdateChartComment();

   if(InpPingOnAttach)
      VyronisSendStartupPing();

   datetime fromTime = VyronisBackfillFromTime();
   int backfilled = VyronisScanAccountClosedDeals(fromTime);
   if(InpVerboseLog)
      Print("Vyronis: account backfill synced ", backfilled, " closing deal(s) since ",
            TimeToString(fromTime, TIME_DATE|TIME_MINUTES));

   int timerSec = InpScanIntervalSec > 0 ? InpScanIntervalSec : InpPingIntervalSec;
   if(timerSec <= 0)
      timerSec = 60;
   EventSetTimer(timerSec);

   Print("Vyronis: attached to ", _Symbol, " — monitoring ALL account symbols");
   return INIT_SUCCEEDED;
}

//+------------------------------------------------------------------+
void OnDeinit(const int reason)
{
   EventKillTimer();
   Comment("");
}

//+------------------------------------------------------------------+
//| Instant notify when any symbol closes (account-wide)              |
//+------------------------------------------------------------------+
void OnTradeTransaction(
   const MqlTradeTransaction &trans,
   const MqlTradeRequest &request,
   const MqlTradeResult &result
)
{
   if(trans.type != TRADE_TRANSACTION_DEAL_ADD)
      return;

   const ulong dealTicket = trans.deal;
   if(!VyronisIsClosingDeal(dealTicket))
      return;

   VyronisSyncClosedDeal(dealTicket);
}

//+------------------------------------------------------------------+
//| Timer — scan account history + retry failures + ping              |
//+------------------------------------------------------------------+
void OnTimer()
{
   VyronisUpdateChartComment();
   g_timerTicks++;

   const ulong retryDeal = VyronisPopFailedDeal();
   if(retryDeal > 0)
   {
      if(InpVerboseLog)
         Print("Vyronis: retry deal ", retryDeal);
      VyronisSyncClosedDeal(retryDeal);
      return;
   }

   if(InpScanLookbackHours > 0)
   {
      const datetime fromTime = TimeCurrent() - InpScanLookbackHours * 3600;
      VyronisScanAccountClosedDeals(fromTime);
   }

   const int timerSec = MathMax(1, InpScanIntervalSec > 0 ? InpScanIntervalSec : 60);
   if(InpPingIntervalSec > 0)
   {
      const int pingEvery = MathMax(1, InpPingIntervalSec / timerSec);
      if(g_timerTicks % pingEvery == 0)
      {
         int status = 0;
         string response = "";
         VyronisSendConnectionPing(InpVyronisWebhookUrl, InpVyronisApiKey, status, response);
      }
   }
}

//+------------------------------------------------------------------+
datetime VyronisBackfillFromTime()
{
   if(InpSyncHistoryHours <= 0)
      return (datetime)0;
   return TimeCurrent() - InpSyncHistoryHours * 3600;
}

//+------------------------------------------------------------------+
//| Scan ALL symbols — account deal history                           |
//+------------------------------------------------------------------+
int VyronisScanAccountClosedDeals(const datetime fromTime)
{
   const datetime toTime = TimeCurrent() + 60;
   if(!VyronisSelectAccountDealHistory(fromTime, toTime))
      return 0;

   const int total = HistoryDealsTotal();
   int synced = 0;

   for(int i = 0; i < total; i++)
   {
      const ulong dealTicket = HistoryDealGetTicket(i);
      if(!VyronisIsClosingDeal(dealTicket))
         continue;

      if(VyronisIsDealSynced(dealTicket))
         continue;

      if(VyronisSyncClosedDeal(dealTicket))
         synced++;
   }

   VyronisUpdateChartComment();
   return synced;
}

//+------------------------------------------------------------------+
//| Sync one closing deal by deal ticket ID                           |
//+------------------------------------------------------------------+
bool VyronisSyncClosedDeal(const ulong dealTicket)
{
   if(VyronisIsDealSynced(dealTicket))
      return false;

   const string symbol = HistoryDealGetString(dealTicket, DEAL_SYMBOL);
   string json = VyronisBuildClosedTradeJson(dealTicket, InpVyronisApiKey, false);
   if(json == "")
      return false;

   int status = 0;
   string response = "";
   const bool ok = VyronisPostTradeJson(
      InpVyronisWebhookUrl,
      InpVyronisApiKey,
      json,
      status,
      response,
      InpMaxRetries
   );

   const string dealKey = VyronisDealDedupeKey(dealTicket);

   if(ok)
   {
      VyronisMarkDealSynced(dealTicket);
      g_syncedCount++;
      g_lastSyncTime = TimeCurrent();
      if(InpVerboseLog)
         Print("Vyronis OK #", g_syncedCount, " deal=", dealKey, " ", symbol, " HTTP=", status);
   }
   else
   {
      g_failCount++;
      VyronisQueueFailedDeal(dealTicket);
      Print("Vyronis FAIL deal=", dealKey, " ", symbol, " HTTP=", status, " ", response);
   }

   VyronisUpdateChartComment();
   return ok;
}

//+------------------------------------------------------------------+
void VyronisSendStartupPing()
{
   int status = 0;
   string response = "";
   if(VyronisSendConnectionPing(InpVyronisWebhookUrl, InpVyronisApiKey, status, response))
      Print("Vyronis PING OK HTTP=", status, " (all symbols active)");
   else
      Print("Vyronis PING FAIL HTTP=", status, " ", response);
   VyronisUpdateChartComment();
}

//+------------------------------------------------------------------+
void VyronisUpdateChartComment()
{
   string line1 = "Vyronis Sync Active: watching all symbols";
   string line2 = "Account: " + g_accountLogin + " | Broker: " + g_broker;
   string line3 = "Synced: " + IntegerToString(g_syncedCount);
   if(g_failCount > 0)
      line3 += " | Failed: " + IntegerToString(g_failCount);
   if(g_lastSyncTime > 0)
      line3 += " | Last: " + TimeToString(g_lastSyncTime, TIME_DATE|TIME_MINUTES);
   else
      line3 += " | Last: —";

   Comment(line1, "\n", line2, "\n", line3);
}
