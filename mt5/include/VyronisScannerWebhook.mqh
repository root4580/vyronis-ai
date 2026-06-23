//+------------------------------------------------------------------+
//| VyronisScannerWebhook.mqh — POST scanner signals + state to Vyronis|
//+------------------------------------------------------------------+
#ifndef VYRONIS_SCANNER_WEBHOOK_MQH
#define VYRONIS_SCANNER_WEBHOOK_MQH

#include <VyronisScannerTypes.mqh>
#include <VyronisTradeWebhook.mqh>

string ScannerJsonEscape(const string value)
{
   return VyronisJsonEscape(value);
}

string ScannerSignalStatus(const ENUM_SCANNER_GRADE grade)
{
   if(grade == GRADE_A_PLUS_SNIPER || grade == GRADE_A_STRONG) return "active";
   return "skip";
}

bool ScannerShouldPublishSignal(const ENUM_SCANNER_GRADE grade)
{
   return grade == GRADE_A_PLUS_SNIPER || grade == GRADE_A_STRONG;
}

string ScannerBuildSignalJson(
   const ScannerSignal &signal,
   const string api_key
)
{
   const int digits = (int)SymbolInfoInteger(signal.symbol, SYMBOL_DIGITS);
   string json = "{";
   json += "\"api_key\":\"" + ScannerJsonEscape(api_key) + "\",";
   json += "\"setup_id\":\"" + ScannerJsonEscape(signal.setup_id) + "\",";
   json += "\"pair\":\"" + ScannerJsonEscape(signal.symbol) + "\",";
   json += "\"direction\":\"" + ScannerDirectionToString(signal.direction) + "\",";
   json += "\"grade\":\"" + ScannerJsonEscape(signal.grade_label) + "\",";
   json += StringFormat("\"score\":%d,", signal.score);
   json += "\"weekly_bias\":\"" + ScannerBiasToString(signal.weekly_bias) + "\",";
   json += "\"daily_bias\":\"" + ScannerBiasToString(signal.daily_bias) + "\",";
   json += "\"h4_bias\":\"" + ScannerBiasToString(signal.h4_bias) + "\",";
   json += "\"zone_type\":\"" + ScannerJsonEscape(signal.zone_type) + "\",";
   json += "\"sweep\":\"" + ScannerJsonEscape(signal.sweep_label) + "\",";
   json += "\"choch\":\"" + ScannerJsonEscape(signal.choch_label) + "\",";
   json += "\"confirmation_type\":\"" + ScannerJsonEscape(signal.confirmation_type) + "\",";
   json += StringFormat("\"risk_reward\":%.2f,", signal.rr);
   json += "\"session\":\"" + ScannerJsonEscape(signal.session) + "\",";
   json += "\"status\":\"" + ScannerSignalStatus(signal.grade) + "\",";
   json += StringFormat("\"entry\":%.*f,", digits, signal.risk.entry);
   json += StringFormat("\"stop_loss\":%.*f,", digits, signal.risk.sl);
   json += StringFormat("\"take_profit\":%.*f,", digits, signal.risk.tp);
   json += "\"detected_at\":\"" + VyronisFormatDateTime(TimeGMT()) + "\",";
   json += "\"bos_bonus\":" + (signal.bos_bonus ? "true" : "false");
   json += "}";
   return json;
}

bool ScannerPostSignal(
   const string webhook_url,
   const string api_key,
   const ScannerSignal &signal,
   int &http_status,
   string &response_body
)
{
   if(!ScannerShouldPublishSignal(signal.grade)) return false;
   const string json = ScannerBuildSignalJson(signal, api_key);
   return VyronisPostTradeJson(webhook_url, api_key, json, http_status, response_body, 3);
}

string ScannerBuildStatePairJson(const SymbolPanelRow &row)
{
   string json = "{";
   json += "\"pair\":\"" + ScannerJsonEscape(row.symbol) + "\",";
   json += "\"weekly_bias\":\"" + ScannerBiasToString(row.weekly_bias) + "\",";
   json += "\"daily_bias\":\"" + ScannerBiasToString(row.daily_bias) + "\",";
   json += "\"h4_bias\":\"" + ScannerBiasToString(row.h4_bias) + "\",";
   json += "\"scan_state\":\"" + ScannerDisplayStateToApi(row.display_state) + "\",";
   json += "\"grade\":\"" + ScannerJsonEscape(row.grade_text) + "\",";
   json += "\"zone_type\":\"" + ScannerJsonEscape(row.zone_text) + "\",";
   json += "\"session\":\"" + ScannerJsonEscape(row.session_text) + "\",";
   json += StringFormat("\"score\":%d,", row.score);
   if(row.direction == ORDER_TYPE_BUY || row.direction == ORDER_TYPE_SELL)
      json += "\"direction\":\"" + ScannerDirectionToString(row.direction) + "\"";
   else
      json += "\"direction\":null";
   json += "}";
   return json;
}

string ScannerBuildStateSyncJson(
   const SymbolPanelRow &rows[],
   const string api_key
)
{
   string json = "{";
   json += "\"api_key\":\"" + ScannerJsonEscape(api_key) + "\",";
   json += "\"scanned_at\":\"" + VyronisFormatDateTime(TimeGMT()) + "\",";
   json += "\"pairs\":[";
   for(int i = 0; i < ArraySize(rows); i++)
   {
      if(i > 0) json += ",";
      json += ScannerBuildStatePairJson(rows[i]);
   }
   json += "]}";
   return json;
}

bool ScannerPostStateSync(
   const string state_url,
   const string api_key,
   const SymbolPanelRow &rows[],
   int &http_status,
   string &response_body
)
{
   const string json = ScannerBuildStateSyncJson(rows, api_key);
   return VyronisPostTradeJson(state_url, api_key, json, http_status, response_body, 2);
}

string ScannerFormatAlertText(const ScannerSignal &signal)
{
   string text = "";
   text += "PAIR: " + signal.symbol + "\n";
   text += "DIRECTION: " + ScannerDirectionToString(signal.direction) + "\n";
   text += "GRADE: " + signal.grade_label + "\n";
   text += "SCORE: " + IntegerToString(signal.score) + "\n";
   text += "WEEKLY BIAS: " + ScannerBiasToString(signal.weekly_bias) + "\n";
   text += "DAILY BIAS: " + ScannerBiasToString(signal.daily_bias) + "\n";
   text += "H4 BIAS: " + ScannerBiasToString(signal.h4_bias) + "\n";
   text += "ZONE: " + signal.zone_type + "\n";
   text += "SWEEP: " + signal.sweep_label + "\n";
   text += "CHOCH: " + signal.choch_label + "\n";
   text += "CONFIRMATION: " + signal.confirmation_type + "\n";
   text += StringFormat("RR: 1:%.1f\n", signal.rr);
   text += "SESSION: " + signal.session;
   return text;
}

#endif // VYRONIS_SCANNER_WEBHOOK_MQH
