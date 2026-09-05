export enum SupportedCountry {
  UNITED_STATES = "United States",
  UNITED_KINGDOM = "United Kingdom",
}

export enum SupportedCountryCode {
  US = "US",
  UK = "UK",
}

export enum SupportedCurrency {
  USD = "USD",
  GBP = "GBP",
}

export enum SupportedCurrencySymbol {
  USD = "$",
  GBP = "£",
}

export interface RegionConfig {
  country: SupportedCountry;
  countryCode: SupportedCountryCode;
  currency: SupportedCurrency;
  symbol: SupportedCurrencySymbol;
  label: string;
}

export const SUPPORTED_REGIONS: Record<SupportedCountryCode, RegionConfig> = {
  [SupportedCountryCode.US]: {
    country: SupportedCountry.UNITED_STATES,
    countryCode: SupportedCountryCode.US,
    currency: SupportedCurrency.USD,
    symbol: SupportedCurrencySymbol.USD,
    label: "🇺🇸 United States — USD ($)",
  },
  [SupportedCountryCode.UK]: {
    country: SupportedCountry.UNITED_KINGDOM,
    countryCode: SupportedCountryCode.UK,
    currency: SupportedCurrency.GBP,
    symbol: SupportedCurrencySymbol.GBP,
    label: "🇬🇧 United Kingdom — GBP (£)",
  },
};

export const DEFAULT_REGION = SUPPORTED_REGIONS[SupportedCountryCode.UK];

/**
 * Normalizes any country name, code, or currency into one of the two supported country/currency pairings:
 * - United States -> USD ($)
 * - United Kingdom -> GBP (£)
 */
export function normalizeCountryAndCurrency(
  inputCountry?: string | null,
  inputCurrency?: string | null,
): RegionConfig {
  const countryStr = (inputCountry || "").trim().toLowerCase();
  const currencyStr = (inputCurrency || "").trim().toUpperCase();

  // Check if US
  if (
    countryStr === "us" ||
    countryStr === "usa" ||
    countryStr === "united states" ||
    countryStr === "united states of america" ||
    countryStr === "america" ||
    currencyStr === "USD" ||
    currencyStr === "$"
  ) {
    return SUPPORTED_REGIONS[SupportedCountryCode.US];
  }

  // Check if UK
  if (
    countryStr === "uk" ||
    countryStr === "gb" ||
    countryStr === "gbr" ||
    countryStr === "united kingdom" ||
    countryStr === "great britain" ||
    countryStr === "britain" ||
    countryStr === "england" ||
    countryStr === "scotland" ||
    countryStr === "wales" ||
    currencyStr === "GBP" ||
    currencyStr === "£"
  ) {
    return SUPPORTED_REGIONS[SupportedCountryCode.UK];
  }

  // If a country was provided with "united states", match US
  if (countryStr.includes("united states") || countryStr.includes("america")) {
    return SUPPORTED_REGIONS[SupportedCountryCode.US];
  }

  // Default fallback is United Kingdom (GBP)
  return DEFAULT_REGION;
}

/**
 * Returns the strictly mapped currency for a given country.
 */
export function getCurrencyForCountry(
  country?: string | null,
): SupportedCurrency {
  return normalizeCountryAndCurrency(country).currency;
}

/**
 * Returns the currency symbol for a currency code.
 */
export function getCurrencySymbol(
  currency?: string | null,
): SupportedCurrencySymbol {
  return normalizeCountryAndCurrency(undefined, currency).symbol;
}
