//+------------------------------------------------------------------+
//| VyronisScannerWebhook.mqh — POST scanner signals to Vyronis       |
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
   if(grade == GRADE_A_PLUS_SNIPER) return "active";
   if(grade == GRADE_A_STRONG || grade == GRADE_B_WATCHLIST) return "watchlist";
   return "skip";
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
   if(signal.grade == GRADE_SKIP) return false;
   const string json = ScannerBuildSignalJson(signal, api_key);
   return VyronisPostTradeJson(webhook_url, api_key, json, http_status, response_body, 3);
}

string ScannerFormatAlertText(const ScannerSignal &signal)
{
   string text = "";
   text += "PAIR: " + signal.symbol + "\n";
   text += "DIRECTION: " + ScannerDirectionToString(signal.direction) + "\n";
   text += "GRADE: " + signal.grade_label + "\n";
   text += "SCORE: " + IntegerToString(signal.score) + "\n";
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
