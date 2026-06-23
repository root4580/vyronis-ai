//+------------------------------------------------------------------+
//| VyronisScannerState.mqh — cooldown and dedupe per symbol          |
//+------------------------------------------------------------------+
#ifndef VYRONIS_SCANNER_STATE_MQH
#define VYRONIS_SCANNER_STATE_MQH

#include <VyronisScannerTypes.mqh>

int ScannerStringHash(const string text)
{
   int hash = 0;
   for(int i = 0; i < StringLen(text); i++)
      hash = hash * 31 + StringGetCharacter(text, i);
   return hash;
}

string ScannerStateKey(const string symbol, const string suffix)
{
   string clean = symbol;
   StringReplace(clean, ".", "_");
   return VYRONIS_SCANNER_PREFIX + clean + "_" + suffix;
}

double ScannerGetLastAlertedSweepLevel(const string symbol)
{
   const string key = ScannerStateKey(symbol, "SWEEP_LVL");
   if(!GlobalVariableCheck(key)) return 0;
   return GlobalVariableGet(key);
}

void ScannerMarkAlertedSweep(const string symbol, const double sweep_level)
{
   GlobalVariableSet(ScannerStateKey(symbol, "SWEEP_LVL"), sweep_level);
   GlobalVariableSet(ScannerStateKey(symbol, "ALERT_AT"), (double)TimeCurrent());
}

bool ScannerIsNewSweep(const string symbol, const double sweep_level)
{
   const double last = ScannerGetLastAlertedSweepLevel(symbol);
   if(last <= 0) return true;
   const double pip = ScannerPipSize(symbol);
   return MathAbs(sweep_level - last) >= pip * 0.5;
}

bool ScannerShouldFireAlert(
   const string symbol,
   const ScannerSignal &signal,
   const ScannerSweepResult &sweep
)
{
   if(signal.grade != GRADE_A_PLUS_SNIPER) return false;
   if(!ScannerIsNewSweep(symbol, sweep.level)) return false;

   const string key = ScannerStateKey(symbol, "LAST_SETUP_HASH");
   if(GlobalVariableCheck(key))
   {
      const int stored = (int)GlobalVariableGet(key);
      if(stored == ScannerStringHash(signal.setup_id)) return false;
   }
   return true;
}

void ScannerMarkSetupAlerted(const string symbol, const ScannerSignal &signal, const ScannerSweepResult &sweep)
{
   ScannerMarkAlertedSweep(symbol, sweep.level);
   GlobalVariableSet(ScannerStateKey(symbol, "LAST_SETUP_HASH"), (double)ScannerStringHash(signal.setup_id));
}

#endif // VYRONIS_SCANNER_STATE_MQH
