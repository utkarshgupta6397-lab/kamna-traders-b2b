/**
 * Configuration and helpers for DCR workflows.
 * 
 * Add new recommendation keywords here to future-proof the application.
 */

export const DCR_RECOMMENDATION_KEYWORDS = [
  "DCR",
  "Solar Panel",
  "Solar Panels",
  "Topcon",
  "Bifacial",
  // Optional keywords per requirements
  "Mono PERC",
  "N-Type",
  "N Type",
  "Panel",
  "Module",
  "PV Module"
];

/**
 * Checks if a given item name should be recommended for DCR tracking.
 * It performs a case-insensitive check against the DCR_RECOMMENDATION_KEYWORDS list.
 * Note: It explicitly avoids matching on just "Solar" to prevent false positives (e.g., Solar Cable, Solar Base Plate).
 * 
 * @param itemName The name of the item from the invoice
 * @returns boolean True if recommended, false otherwise
 */
export const isRecommendedForDcr = (itemName: string): boolean => {
  if (!itemName) return false;
  
  const upperName = itemName.toUpperCase();
  return DCR_RECOMMENDATION_KEYWORDS.some(keyword => upperName.includes(keyword.toUpperCase()));
};
