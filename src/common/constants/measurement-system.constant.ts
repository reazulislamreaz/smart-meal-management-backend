export enum SupportedMeasurementSystem {
  IMPERIAL = "IMPERIAL",
  METRIC = "METRIC",
}

export type MeasurementSystemType = "IMPERIAL" | "METRIC";

/**
 * Normalizes any measurement system string or infers from country:
 * - "IMPERIAL" / "US" / "USA" / "LBS" / "OZ" -> "IMPERIAL"
 * - "METRIC" / "SI" / "KG" / "GRAMS" -> "METRIC"
 * - If omitted, infers based on country (United States -> IMPERIAL, else METRIC).
 */
export function normalizeMeasurementSystem(
  inputSystem?: string | null,
  country?: string | null,
): "IMPERIAL" | "METRIC" {
  const systemStr = (inputSystem || "").trim().toUpperCase();

  if (
    systemStr === "IMPERIAL" ||
    systemStr === "US" ||
    systemStr === "USA" ||
    systemStr === "CUSTOMARY" ||
    systemStr === "LBS" ||
    systemStr === "OZ"
  ) {
    return SupportedMeasurementSystem.IMPERIAL;
  }

  if (
    systemStr === "METRIC" ||
    systemStr === "SI" ||
    systemStr === "KG" ||
    systemStr === "GRAMS"
  ) {
    return SupportedMeasurementSystem.METRIC;
  }

  // Infer based on country if provided
  const countryStr = (country || "").trim().toLowerCase();
  if (
    countryStr === "us" ||
    countryStr === "usa" ||
    countryStr === "united states" ||
    countryStr === "united states of america" ||
    countryStr === "america"
  ) {
    return SupportedMeasurementSystem.IMPERIAL;
  }

  // Default fallback is METRIC
  return SupportedMeasurementSystem.METRIC;
}
