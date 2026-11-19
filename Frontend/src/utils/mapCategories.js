// Final categories shown in "Category Performance vs Target" (fixed order)
export const CATEGORY_ORDER = ["Freezer", "Chocolate", "Visi Cooler", "SUS"];

// Keys MUST be UPPERCASE — incoming category names are normalised to uppercase
// before lookup. Anything not listed here is ignored.
export const CATEGORY_MAPPINGS = {
  // Freezer
  COOLER: "Freezer",
  "ICE LINED REFRIGERATOR": "Freezer",
  "COOLER AND FREEZER": "Freezer",
  "CHEST COOLER": "Freezer",
  MEDICAL: "Freezer",
  EUTECTIC: "Freezer",
  ILR: "Freezer",
  "VACCINE FREEZER": "Freezer",
  DUAL: "Freezer",
  FREEZER: "Freezer",
  "FOW MODELS": "Freezer",
  "EUTECTIC FOW FREEZER": "Freezer",

  // Chocolate
  "CHOC COOLER": "Chocolate",

  // Visi Cooler
  "VISI COOLER": "Visi Cooler",

  // SUS
  "2 GLASS DOOR UNDERCOUNTER REFRIGERATOR": "SUS",
  "1 DOOR UNDERCOUNTER REFRIGERATOR": "SUS",
  "2 DOOR UNDERCOUNTER REFRIGERATOR": "SUS",
  "3 DOOR UNDERCOUNTER REFRIGERATOR": "SUS",
  "STORAGE WATER COOLER": "SUS",
  COMPACT: "SUS",
  "REACH-IN": "SUS",
};
