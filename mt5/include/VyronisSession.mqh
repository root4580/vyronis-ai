//+------------------------------------------------------------------+
//| VyronisSession.mqh — GMT session gate for A+ Scanner              |
//+------------------------------------------------------------------+
#ifndef VYRONIS_SESSION_MQH
#define VYRONIS_SESSION_MQH

#include <VyronisScannerTypes.mqh>

ENUM_SCANNER_SESSION ScannerGetActiveSessionGMT()
{
   MqlDateTime dt;
   TimeToStruct(TimeGMT(), dt);
   const int hour = dt.hour;

   if(hour >= 7 && hour < 10)
      return SESSION_LONDON;
   if(hour >= 13 && hour < 16)
      return SESSION_NEW_YORK;
   return SESSION_NONE;
}

string ScannerSessionLabel(const ENUM_SCANNER_SESSION session)
{
   if(session == SESSION_LONDON) return "London";
   if(session == SESSION_NEW_YORK) return "New York";
   return "Off";
}

bool ScannerIsInSession()
{
   return ScannerGetActiveSessionGMT() != SESSION_NONE;
}

#endif // VYRONIS_SESSION_MQH
