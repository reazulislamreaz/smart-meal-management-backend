import {
  normalizeCountryAndCurrency,
  getCurrencyForCountry,
  getCurrencySymbol,
  SupportedCountry,
  SupportedCurrency,
  SupportedCountryCode,
  SupportedCurrencySymbol,
} from "./country-currency.constant";

describe("Country & Currency Selection (US/UK Only)", () => {
  describe("normalizeCountryAndCurrency", () => {
    it("should map United States inputs strictly to US and USD", () => {
      const usInputs = [
        "United States",
        "united states",
        "US",
        "us",
        "USA",
        "usa",
        "United States of America",
        "America",
      ];

      for (const input of usInputs) {
        const result = normalizeCountryAndCurrency(input);
        expect(result.country).toBe(SupportedCountry.UNITED_STATES);
        expect(result.countryCode).toBe(SupportedCountryCode.US);
        expect(result.currency).toBe(SupportedCurrency.USD);
        expect(result.symbol).toBe(SupportedCurrencySymbol.USD);
      }
    });

    it("should map United Kingdom inputs strictly to UK and GBP", () => {
      const ukInputs = [
        "United Kingdom",
        "united kingdom",
        "UK",
        "uk",
        "GB",
        "gb",
        "GBR",
        "Great Britain",
        "Britain",
        "England",
        "Scotland",
        "Wales",
      ];

      for (const input of ukInputs) {
        const result = normalizeCountryAndCurrency(input);
        expect(result.country).toBe(SupportedCountry.UNITED_KINGDOM);
        expect(result.countryCode).toBe(SupportedCountryCode.UK);
        expect(result.currency).toBe(SupportedCurrency.GBP);
        expect(result.symbol).toBe(SupportedCurrencySymbol.GBP);
      }
    });

    it("should map currency codes directly to their respective country and currency", () => {
      const usdResult = normalizeCountryAndCurrency(undefined, "USD");
      expect(usdResult.country).toBe(SupportedCountry.UNITED_STATES);
      expect(usdResult.currency).toBe(SupportedCurrency.USD);

      const gbpResult = normalizeCountryAndCurrency(undefined, "GBP");
      expect(gbpResult.country).toBe(SupportedCountry.UNITED_KINGDOM);
      expect(gbpResult.currency).toBe(SupportedCurrency.GBP);
    });

    it("should prevent invalid combinations and fallback to default (UK/GBP)", () => {
      const fallbackResult = normalizeCountryAndCurrency("Germany", "EUR");
      expect(fallbackResult.country).toBe(SupportedCountry.UNITED_KINGDOM);
      expect(fallbackResult.currency).toBe(SupportedCurrency.GBP);

      const emptyResult = normalizeCountryAndCurrency(null, null);
      expect(emptyResult.country).toBe(SupportedCountry.UNITED_KINGDOM);
      expect(emptyResult.currency).toBe(SupportedCurrency.GBP);
    });
  });

  describe("getCurrencyForCountry & getCurrencySymbol", () => {
    it("should return USD for US and GBP for UK", () => {
      expect(getCurrencyForCountry("US")).toBe(SupportedCurrency.USD);
      expect(getCurrencyForCountry("United States")).toBe(
        SupportedCurrency.USD,
      );
      expect(getCurrencyForCountry("UK")).toBe(SupportedCurrency.GBP);
      expect(getCurrencyForCountry("United Kingdom")).toBe(
        SupportedCurrency.GBP,
      );
    });

    it("should return correct currency symbols", () => {
      expect(getCurrencySymbol("USD")).toBe("$");
      expect(getCurrencySymbol("GBP")).toBe("£");
      expect(getCurrencySymbol("$")).toBe("$");
      expect(getCurrencySymbol("£")).toBe("£");
    });
  });
});
