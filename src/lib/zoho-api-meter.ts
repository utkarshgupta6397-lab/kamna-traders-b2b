const globalAny: any = global;

if (!globalAny.zohoApiUsage) {
  globalAny.zohoApiUsage = {
    today: 0,
    breakdown: {},
    lastResetDate: new Date().toDateString()
  };
}

// Reset if it's a new day
const resetIfNewDay = () => {
  const lastResetDate = globalAny.zohoApiUsage.lastResetDate;
  const todayStr = new Date().toDateString();
  if (lastResetDate !== todayStr) {
    globalAny.zohoApiUsage.today = 0;
    globalAny.zohoApiUsage.breakdown = {};
    globalAny.zohoApiUsage.lastResetDate = todayStr;
  }
};

export function trackZohoApiCall(type: string) {
  resetIfNewDay();
  
  globalAny.zohoApiUsage.today += 1;
  if (!globalAny.zohoApiUsage.breakdown[type]) {
    globalAny.zohoApiUsage.breakdown[type] = 0;
  }
  globalAny.zohoApiUsage.breakdown[type] += 1;
}

export function getZohoApiUsage() {
  resetIfNewDay();
  return {
    today: globalAny.zohoApiUsage.today,
    breakdown: globalAny.zohoApiUsage.breakdown
  };
}
