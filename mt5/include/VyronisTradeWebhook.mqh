//+------------------------------------------------------------------+
//| VyronisTradeWebhook.mqh — production MT5 → Vyronis journal sync    |
//+------------------------------------------------------------------+
#ifndef VYRONIS_TRADE_WEBHOOK_MQH
#define VYRONIS_TRADE_WEBHOOK_MQH

#define VYRONIS_SYNC_PREFIX "VYRONIS_SYNC_"
#define VYRONIS_DEFAULT_RETRIES 3
#define VYRONIS_RETRY_DELAY_MS 1500

//+------------------------------------------------------------------+
//| Escape string for JSON value                                      |
//+------------------------------------------------------------------+
string VyronisJsonEscape(const string value)
{
   string out = value;
   StringReplace(out, "\\", "\\\\");
   StringReplace(out, "\"", "\\\"");
   StringReplace(out, "\n", "\\n");
   StringReplace(out, "\r", "\\r");
   return out;
}

//+------------------------------------------------------------------+
//| Format datetime for Vyronis API (YYYY.MM.DD HH:MM:SS)             |
//+------------------------------------------------------------------+
string VyronisFormatDateTime(const datetime value)
{
   if(value <= 0) return "";
   return TimeToString(value, TIME_DATE|TIME_SECONDS);
}

//+------------------------------------------------------------------+
//| Local dedupe — skip tickets already synced this terminal session  |
//+------------------------------------------------------------------+
bool VyronisIsTicketAlreadySynced(const string ticketKey)
{
   string key = VYRONIS_SYNC_PREFIX + ticketKey;
   if(GlobalVariableCheck(key))
      return true;
   return false;
}

void VyronisMarkTicketSynced(const string ticketKey)
{
   string key = VYRONIS_SYNC_PREFIX + ticketKey;
   GlobalVariableSet(key, (double)TimeCurrent());
}

//+------------------------------------------------------------------+
//| Deal-ticket dedupe (one sync per closing deal, all symbols)       |
//+------------------------------------------------------------------+
string VyronisDealDedupeKey(const ulong dealTicket)
{
   return IntegerToString((long)dealTicket);
}

bool VyronisIsDealSynced(const ulong dealTicket)
{
   if(dealTicket == 0) return false;
   return VyronisIsTicketAlreadySynced(VyronisDealDedupeKey(dealTicket));
}

void VyronisMarkDealSynced(const ulong dealTicket)
{
   if(dealTicket == 0) return;
   VyronisMarkTicketSynced(VyronisDealDedupeKey(dealTicket));
}

//+------------------------------------------------------------------+
//| True if deal is a trade close (any symbol on the account)         |
//+------------------------------------------------------------------+
bool VyronisIsClosingDeal(const ulong dealTicket)
{
   if(dealTicket == 0 || !HistoryDealSelect(dealTicket))
      return false;

   const long entry = HistoryDealGetInteger(dealTicket, DEAL_ENTRY);
   if(entry != DEAL_ENTRY_OUT && entry != DEAL_ENTRY_OUT_BY)
      return false;

   const long dtype = HistoryDealGetInteger(dealTicket, DEAL_TYPE);
   if(dtype != DEAL_TYPE_BUY && dtype != DEAL_TYPE_SELL)
      return false;

   const string symbol = HistoryDealGetString(dealTicket, DEAL_SYMBOL);
   if(StringLen(symbol) < 1)
      return false;

   return true;
}

//+------------------------------------------------------------------+
//| Select full account deal history (all symbols)                    |
//+------------------------------------------------------------------+
bool VyronisSelectAccountDealHistory(const datetime fromTime, const datetime toTime)
{
   ResetLastError();
   if(!HistorySelect(fromTime, toTime))
   {
      Print("Vyronis: HistorySelect failed ", GetLastError(),
            " from=", TimeToString(fromTime, TIME_DATE|TIME_SECONDS),
            " to=", TimeToString(toTime, TIME_DATE|TIME_SECONDS));
      return false;
   }
   return true;
}

//+------------------------------------------------------------------+
//| Resolve SL/TP from position order history                         |
//+------------------------------------------------------------------+
bool VyronisResolvePositionSlTp(
   const ulong positionId,
   double &sl,
   double &tp
)
{
   sl = 0.0;
   tp = 0.0;
   if(positionId == 0) return false;

   if(!HistorySelectByPosition(positionId))
      return false;

   int total = HistoryOrdersTotal();
   for(int i = 0; i < total; i++)
   {
      ulong orderTicket = HistoryOrderGetTicket(i);
      if(orderTicket == 0) continue;
      if(HistoryOrderGetInteger(orderTicket, ORDER_POSITION_ID) != (long)positionId)
         continue;

      double orderSl = HistoryOrderGetDouble(orderTicket, ORDER_SL);
      double orderTp = HistoryOrderGetDouble(orderTicket, ORDER_TP);
      if(orderSl > 0) sl = orderSl;
      if(orderTp > 0) tp = orderTp;
   }
   return (sl > 0 || tp > 0);
}

//+------------------------------------------------------------------+
//| Build full closed-position JSON from exit deal ticket             |
//+------------------------------------------------------------------+
string VyronisBuildClosedTradeJson(
   const ulong  exitDealTicket,
   const string apiKey,
   const bool   replaceExisting = false
)
{
   if(!HistoryDealSelect(exitDealTicket))
      return "";

   const long entryType = HistoryDealGetInteger(exitDealTicket, DEAL_ENTRY);
   if(entryType != DEAL_ENTRY_OUT && entryType != DEAL_ENTRY_OUT_BY)
      return "";

   const ulong positionId = (ulong)HistoryDealGetInteger(exitDealTicket, DEAL_POSITION_ID);
   const string symbol = HistoryDealGetString(exitDealTicket, DEAL_SYMBOL);
   const long dealType = HistoryDealGetInteger(exitDealTicket, DEAL_TYPE);
   const datetime closeTime = (datetime)HistoryDealGetInteger(exitDealTicket, DEAL_TIME);
   const double closePrice = HistoryDealGetDouble(exitDealTicket, DEAL_PRICE);
   const double exitVolume = HistoryDealGetDouble(exitDealTicket, DEAL_VOLUME);
   const long magic = HistoryDealGetInteger(exitDealTicket, DEAL_MAGIC);
   const string comment = HistoryDealGetString(exitDealTicket, DEAL_COMMENT);

   string direction = "BUY";
   if(dealType == DEAL_TYPE_SELL)
      direction = "SELL";

   double profit = HistoryDealGetDouble(exitDealTicket, DEAL_PROFIT);
   double commission = HistoryDealGetDouble(exitDealTicket, DEAL_COMMISSION);
   double swap = HistoryDealGetDouble(exitDealTicket, DEAL_SWAP);
   double volume = exitVolume;
   double openPrice = 0.0;
   datetime openTime = 0;
   const string ticketId = VyronisDealDedupeKey(exitDealTicket);

   if(positionId > 0 && HistorySelectByPosition(positionId))
   {
      int deals = HistoryDealsTotal();
      for(int i = 0; i < deals; i++)
      {
         ulong dealTicket = HistoryDealGetTicket(i);
         if(dealTicket == 0) continue;

         const long dealEntry = HistoryDealGetInteger(dealTicket, DEAL_ENTRY);
         if(dealEntry != DEAL_ENTRY_IN && dealEntry != DEAL_ENTRY_INOUT)
            continue;

         const datetime dealTime = (datetime)HistoryDealGetInteger(dealTicket, DEAL_TIME);
         if(openTime == 0 || dealTime <= openTime)
         {
            openTime = dealTime;
            openPrice = HistoryDealGetDouble(dealTicket, DEAL_PRICE);
            volume = HistoryDealGetDouble(dealTicket, DEAL_VOLUME);
            const long inType = HistoryDealGetInteger(dealTicket, DEAL_TYPE);
            if(inType == DEAL_TYPE_BUY) direction = "BUY";
            else if(inType == DEAL_TYPE_SELL) direction = "SELL";
         }
      }
   }

   if(openTime == 0)
   {
      openPrice = closePrice;
      openTime = closeTime;
   }

   double sl = 0.0;
   double tp = 0.0;
   VyronisResolvePositionSlTp(positionId, sl, tp);

   string json = "{";
   json += "\"api_key\":\"" + VyronisJsonEscape(apiKey) + "\",";
   json += "\"ticket\":\"" + ticketId + "\",";
   json += "\"symbol\":\"" + VyronisJsonEscape(symbol) + "\",";
   json += "\"direction\":\"" + direction + "\",";
   json += StringFormat("\"profit\":%.2f,", profit + commission + swap);
   json += StringFormat("\"volume\":%.2f,", volume);
   if(openPrice > 0)
      json += StringFormat("\"open_price\":%.5f,", openPrice);
   if(closePrice > 0)
      json += StringFormat("\"close_price\":%.5f,", closePrice);
   if(sl > 0)
      json += StringFormat("\"sl\":%.5f,", sl);
   if(tp > 0)
      json += StringFormat("\"tp\":%.5f,", tp);
   json += StringFormat("\"commission\":%.2f,", commission);
   json += StringFormat("\"swap\":%.2f,", swap);
   json += StringFormat("\"magic\":%d,", (int)magic);
   if(openTime > 0)
      json += "\"open_time\":\"" + VyronisFormatDateTime(openTime) + "\",";
   json += "\"close_time\":\"" + VyronisFormatDateTime(closeTime) + "\",";
   json += "\"comment\":\"" + VyronisJsonEscape(comment) + "\",";
   json += "\"account_login\":\"" + IntegerToString((long)AccountInfoInteger(ACCOUNT_LOGIN)) + "\",";
   json += "\"broker\":\"" + VyronisJsonEscape(AccountInfoString(ACCOUNT_SERVER)) + "\",";
   json += StringFormat("\"balance\":%.2f,", AccountInfoDouble(ACCOUNT_BALANCE));
   json += "\"replace\":" + (replaceExisting ? "true" : "false");
   json += "}";

   return json;
}

//+------------------------------------------------------------------+
//| Legacy: build JSON from single deal (minimal)                     |
//+------------------------------------------------------------------+
string VyronisBuildDealJson(
   const ulong  dealTicket,
   const string apiKey,
   const bool   replaceExisting = false
)
{
   return VyronisBuildClosedTradeJson(dealTicket, apiKey, replaceExisting);
}

//+------------------------------------------------------------------+
//| POST JSON with retries and backoff                                |
//+------------------------------------------------------------------+
bool VyronisPostTradeJson(
   const string webhookUrl,
   const string apiKey,
   const string jsonBody,
   int &httpStatus,
   string &responseBody,
   const int maxRetries = VYRONIS_DEFAULT_RETRIES
)
{
   httpStatus = 0;
   responseBody = "";

   if(StringLen(webhookUrl) < 10 || StringLen(apiKey) < 8)
   {
      Print("Vyronis: missing webhook URL or API key");
      return false;
   }
   if(StringLen(jsonBody) < 2)
   {
      Print("Vyronis: empty JSON body");
      return false;
   }

   int attempts = MathMax(1, maxRetries);

   for(int attempt = 1; attempt <= attempts; attempt++)
   {
      char post[];
      char result[];
      string resultHeaders;

      int bodyLen = StringToCharArray(jsonBody, post, 0, WHOLE_ARRAY, CP_UTF8) - 1;
      if(bodyLen < 1)
      {
         Print("Vyronis: UTF-8 encode failed");
         return false;
      }
      ArrayResize(post, bodyLen);

      string headers =
         "Content-Type: application/json\r\n"
         "X-API-Key: " + apiKey + "\r\n";

      ResetLastError();
      int res = WebRequest(
         "POST",
         webhookUrl,
         headers,
         15000,
         post,
         result,
         resultHeaders
      );

      if(res == -1)
      {
         int err = GetLastError();
         Print("Vyronis WebRequest failed (attempt ", attempt, "/", attempts,
               "). Error=", err,
               " — whitelist URL in Tools → Options → Expert Advisors → WebRequest");
         if(attempt < attempts)
         {
            Sleep(VYRONIS_RETRY_DELAY_MS * attempt);
            continue;
         }
         return false;
      }

      responseBody = CharArrayToString(result, 0, WHOLE_ARRAY, CP_UTF8);

      int statusPos = StringFind(resultHeaders, "HTTP/");
      if(statusPos >= 0)
      {
         string line = resultHeaders;
         int space = StringFind(line, " ", statusPos);
         int nextSpace = StringFind(line, " ", space + 1);
         if(space > 0 && nextSpace > space)
            httpStatus = (int)StringToInteger(StringSubstr(line, space + 1, nextSpace - space - 1));
      }

      if(httpStatus >= 200 && httpStatus < 300)
         return true;

      Print("Vyronis HTTP ", httpStatus, " (attempt ", attempt, "/", attempts, ") ", responseBody);

      if(httpStatus == 401 || httpStatus == 403)
         return false;

      if(attempt < attempts)
         Sleep(VYRONIS_RETRY_DELAY_MS * attempt);
   }

   return false;
}

//+------------------------------------------------------------------+
//| Push closed trade with local dedupe + retries                     |
//+------------------------------------------------------------------+
bool VyronisPushClosedDeal(
   const string webhookUrl,
   const string apiKey,
   const ulong  exitDealTicket,
   const bool   replaceExisting = false,
   const bool   skipLocalDedupe = false
)
{
   string json = VyronisBuildClosedTradeJson(exitDealTicket, apiKey, replaceExisting);
   if(json == "")
      return false;

   string ticketKey = "";
   int ticketPos = StringFind(json, "\"ticket\":\"");
   if(ticketPos >= 0)
   {
      int start = ticketPos + 10;
      int end = StringFind(json, "\"", start);
      if(end > start)
         ticketKey = StringSubstr(json, start, end - start);
   }

   if(!skipLocalDedupe && ticketKey != "" && VyronisIsTicketAlreadySynced(ticketKey))
   {
      Print("Vyronis: ticket ", ticketKey, " already synced locally — skipped");
      return true;
   }

   int status = 0;
   string body = "";
   bool ok = VyronisPostTradeJson(webhookUrl, apiKey, json, status, body);

   if(ok && ticketKey != "")
      VyronisMarkTicketSynced(ticketKey);

   if(ok)
      Print("Vyronis: synced ticket ", ticketKey, " HTTP ", status);
   else
      Print("Vyronis: failed ticket ", ticketKey);

   return ok;
}

//+------------------------------------------------------------------+
//| Derive ping URL from trades webhook URL                           |
//+------------------------------------------------------------------+
string VyronisDerivePingUrl(const string webhookUrl)
{
   string url = webhookUrl;
   StringReplace(url, "/api/webhooks/mt5/scanner/state", "/api/webhooks/mt5/ping");
   StringReplace(url, "/api/webhooks/mt5/scanner", "/api/webhooks/mt5/ping");
   StringReplace(url, "/api/webhooks/mt5/trades", "/api/webhooks/mt5/ping");
   if(url == webhookUrl)
      StringReplace(url, "/scanner", "/ping");
   if(url == webhookUrl)
      StringReplace(url, "/trades", "/ping");
   return url;
}

//+------------------------------------------------------------------+
//| Connection ping — no trade ingest                                 |
//+------------------------------------------------------------------+
bool VyronisSendConnectionPing(
   const string webhookUrl,
   const string apiKey,
   int &httpStatus,
   string &responseBody
)
{
   string pingUrl = VyronisDerivePingUrl(webhookUrl);
   string json = "{";
   json += "\"api_key\":\"" + VyronisJsonEscape(apiKey) + "\",";
   json += "\"ping\":true,";
   json += "\"account_login\":\"" + IntegerToString((long)AccountInfoInteger(ACCOUNT_LOGIN)) + "\",";
   json += "\"broker\":\"" + VyronisJsonEscape(AccountInfoString(ACCOUNT_SERVER)) + "\",";
   json += StringFormat("\"balance\":%.2f,", AccountInfoDouble(ACCOUNT_BALANCE));
   json += StringFormat("\"equity\":%.2f,", AccountInfoDouble(ACCOUNT_EQUITY));
   json += "\"ea_version\":\"1.10\"";
   json += "}";

   return VyronisPostTradeJson(pingUrl, apiKey, json, httpStatus, responseBody, VYRONIS_DEFAULT_RETRIES);
}

//+------------------------------------------------------------------+
//| Store failed deal for timer retry                                 |
//+------------------------------------------------------------------+
void VyronisQueueFailedDeal(const ulong dealTicket)
{
   if(dealTicket > 0)
      GlobalVariableSet("VYRONIS_FAIL_DEAL", (double)dealTicket);
}

ulong VyronisPopFailedDeal()
{
   if(!GlobalVariableCheck("VYRONIS_FAIL_DEAL"))
      return 0;
   ulong ticket = (ulong)GlobalVariableGet("VYRONIS_FAIL_DEAL");
   GlobalVariableDel("VYRONIS_FAIL_DEAL");
   return ticket;
}

#endif // VYRONIS_TRADE_WEBHOOK_MQH
