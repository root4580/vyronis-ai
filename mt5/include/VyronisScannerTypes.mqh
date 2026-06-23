//+------------------------------------------------------------------+
//| VyronisScannerTypes.mqh — shared types for A+ Scanner V1          |
//+------------------------------------------------------------------+
#ifndef VYRONIS_SCANNER_TYPES_MQH
#define VYRONIS_SCANNER_TYPES_MQH

#define VYRONIS_SCANNER_PREFIX "VYRONIS_SCAN_"
#define VYRONIS_SCANNER_VERSION "1.30"

enum ENUM_SCANNER_GRADE
{
   GRADE_SKIP = 0,
   GRADE_B_WATCHLIST = 1,
   GRADE_A_STRONG = 2,
   GRADE_A_PLUS_SNIPER = 3
};

enum ENUM_SCANNER_BIAS
{
   BIAS_NEUTRAL = 0,
   BIAS_BULLISH = 1,
   BIAS_BEARISH = 2
};

enum ENUM_SCANNER_SESSION
{
   SESSION_NONE = 0,
   SESSION_LONDON = 1,
   SESSION_NEW_YORK = 2
};

enum ENUM_SWEEP_SOURCE
{
   SWEEP_NONE = 0,
   SWEEP_PDH = 1,
   SWEEP_PDL = 2,
   SWEEP_EQH = 3,
   SWEEP_EQL = 4
};

enum ENUM_CONFIRM_TYPE
{
   CONF_NONE = 0,
   CONF_ENGULF = 1,
   CONF_REJECTION = 2
};

enum ENUM_SCANNER_PHASE
{
   PHASE_IDLE = 0,
   PHASE_BIAS_OK = 1,
   PHASE_SWEPT = 2,
   PHASE_IN_FVG = 3,
   PHASE_CHOCH = 4,
   PHASE_CONFIRMED = 5,
   PHASE_SCORED = 6
};

enum ENUM_SCANNER_DISPLAY_STATE
{
   DISPLAY_IDLE = 0,
   DISPLAY_BUILDING = 1,
   DISPLAY_WAITING = 2,
   DISPLAY_CONFIRMED = 3,
   DISPLAY_ALERTED = 4
};

struct ScannerBiasResult
{
   ENUM_SCANNER_BIAS weekly;
   ENUM_SCANNER_BIAS daily;
   ENUM_SCANNER_BIAS h4;
   bool              aligned;
   int               direction;
};

struct ScannerSweepResult
{
   bool              valid;
   ENUM_SWEEP_SOURCE source;
   double            level;
   datetime          bar_time;
   double            wick_extreme;
};

struct ScannerFvgResult
{
   bool     valid;
   double   top;
   double   bottom;
   datetime formed_at;
   string   id;
};

struct ScannerAoiResult
{
   bool     valid;
   double   top;
   double   bottom;
   datetime formed_at;
   string   id;
   string   zone_type;
};

struct ScannerChochResult
{
   bool     choch;
   bool     bos;
   datetime bar_time;
};

struct ScannerConfirmResult
{
   bool              valid;
   ENUM_CONFIRM_TYPE type;
   datetime          bar_time;
   string            label;
};

struct ScannerRiskResult
{
   double entry;
   double sl;
   double tp;
   double rr;
   bool   meets_min_rr;
};

struct ScannerSignal
{
   string            symbol;
   string            pair_display;
   int               direction;
   ENUM_SCANNER_GRADE grade;
   string            grade_label;
   int               score;
   ENUM_SCANNER_BIAS weekly_bias;
   ENUM_SCANNER_BIAS daily_bias;
   ENUM_SCANNER_BIAS h4_bias;
   string            zone_type;
   string            sweep_label;
   string            choch_label;
   string            confirmation_type;
   double            rr;
   string            session;
   string            setup_id;
   ScannerRiskResult risk;
   bool              bos_bonus;
};

struct SymbolPanelRow
{
   string                    symbol;
   string                    bias_text;
   string                    session_text;
   string                    state_text;
   string                    grade_text;
   string                    zone_text;
   datetime                  last_scan;
   ENUM_SCANNER_PHASE        phase;
   ENUM_SCANNER_DISPLAY_STATE display_state;
   ENUM_SCANNER_BIAS         weekly_bias;
   ENUM_SCANNER_BIAS         daily_bias;
   ENUM_SCANNER_BIAS         h4_bias;
   int                       score;
   int                       direction;
};

string ScannerBiasToString(const ENUM_SCANNER_BIAS bias)
{
   if(bias == BIAS_BULLISH) return "Bullish";
   if(bias == BIAS_BEARISH) return "Bearish";
   return "Neutral";
}

string ScannerGradeToLabel(const ENUM_SCANNER_GRADE grade)
{
   if(grade == GRADE_A_PLUS_SNIPER) return "A+ Sniper";
   if(grade == GRADE_A_STRONG) return "A Strong";
   if(grade == GRADE_B_WATCHLIST) return "B Watchlist";
   return "Skip";
}

string ScannerPhaseToString(const ENUM_SCANNER_PHASE phase)
{
   switch(phase)
   {
      case PHASE_BIAS_OK: return "BIAS_OK";
      case PHASE_SWEPT: return "SWEPT";
      case PHASE_IN_FVG: return "IN_AOI";
      case PHASE_CHOCH: return "CHOCH";
      case PHASE_CONFIRMED: return "CONFIRMED";
      case PHASE_SCORED: return "SCORED";
      default: return "IDLE";
   }
}

string ScannerDisplayStateToString(const ENUM_SCANNER_DISPLAY_STATE state)
{
   switch(state)
   {
      case DISPLAY_BUILDING: return "Building";
      case DISPLAY_WAITING: return "Waiting Confirmation";
      case DISPLAY_CONFIRMED: return "Confirmed";
      case DISPLAY_ALERTED: return "Alerted";
      default: return "Idle";
   }
}

string ScannerDisplayStateToApi(const ENUM_SCANNER_DISPLAY_STATE state)
{
   switch(state)
   {
      case DISPLAY_BUILDING: return "building";
      case DISPLAY_WAITING: return "waiting_confirmation";
      case DISPLAY_CONFIRMED: return "confirmed";
      case DISPLAY_ALERTED: return "alerted";
      default: return "idle";
   }
}

string ScannerSweepSourceToString(const ENUM_SWEEP_SOURCE source)
{
   if(source == SWEEP_PDH) return "PDH";
   if(source == SWEEP_PDL) return "PDL";
   if(source == SWEEP_EQH) return "EQH";
   if(source == SWEEP_EQL) return "EQL";
   return "None";
}

string ScannerDirectionToString(const int direction)
{
   return (direction == ORDER_TYPE_BUY) ? "BUY" : "SELL";
}

string ScannerFormatPairDisplay(const string symbol)
{
   string s = symbol;
   StringReplace(s, ".sim", "");
   if(StringLen(s) == 6)
      return StringSubstr(s, 0, 3) + "/" + StringSubstr(s, 3, 3);
   return s;
}

double ScannerPipSize(const string symbol)
{
   const int digits = (int)SymbolInfoInteger(symbol, SYMBOL_DIGITS);
   if(StringFind(symbol, "JPY") >= 0)
      return (digits >= 3) ? 0.001 : 0.01;
   return (digits >= 4) ? 0.0001 : 0.00001;
}

#endif // VYRONIS_SCANNER_TYPES_MQH
