import {
  SupportedMeasurementSystem,
  normalizeMeasurementSystem,
} from "./measurement-system.constant";

describe("measurement-system.constant", () => {
  describe("normalizeMeasurementSystem", () => {
    it("should return IMPERIAL when input is explicitly IMPERIAL or variants", () => {
      expect(normalizeMeasurementSystem("IMPERIAL")).toBe(
        SupportedMeasurementSystem.IMPERIAL,
      );
      expect(normalizeMeasurementSystem("imperial")).toBe(
        SupportedMeasurementSystem.IMPERIAL,
      );
      expect(normalizeMeasurementSystem("US")).toBe(
        SupportedMeasurementSystem.IMPERIAL,
      );
      expect(normalizeMeasurementSystem("USA")).toBe(
        SupportedMeasurementSystem.IMPERIAL,
      );
      expect(normalizeMeasurementSystem("lbs")).toBe(
        SupportedMeasurementSystem.IMPERIAL,
      );
      expect(normalizeMeasurementSystem("oz")).toBe(
        SupportedMeasurementSystem.IMPERIAL,
      );
    });

    it("should return METRIC when input is explicitly METRIC or variants", () => {
      expect(normalizeMeasurementSystem("METRIC")).toBe(
        SupportedMeasurementSystem.METRIC,
      );
      expect(normalizeMeasurementSystem("metric")).toBe(
        SupportedMeasurementSystem.METRIC,
      );
      expect(normalizeMeasurementSystem("SI")).toBe(
        SupportedMeasurementSystem.METRIC,
      );
      expect(normalizeMeasurementSystem("kg")).toBe(
        SupportedMeasurementSystem.METRIC,
      );
      expect(normalizeMeasurementSystem("grams")).toBe(
        SupportedMeasurementSystem.METRIC,
      );
    });

    it("should infer IMPERIAL for US country when input system is empty", () => {
      expect(normalizeMeasurementSystem(undefined, "United States")).toBe(
        SupportedMeasurementSystem.IMPERIAL,
      );
      expect(normalizeMeasurementSystem(null, "US")).toBe(
        SupportedMeasurementSystem.IMPERIAL,
      );
      expect(normalizeMeasurementSystem("", "USA")).toBe(
        SupportedMeasurementSystem.IMPERIAL,
      );
      expect(normalizeMeasurementSystem(undefined, "America")).toBe(
        SupportedMeasurementSystem.IMPERIAL,
      );
    });

    it("should infer METRIC for non-US countries or default when system is empty", () => {
      expect(normalizeMeasurementSystem(undefined, "United Kingdom")).toBe(
        SupportedMeasurementSystem.METRIC,
      );
      expect(normalizeMeasurementSystem(undefined, "UK")).toBe(
        SupportedMeasurementSystem.METRIC,
      );
      expect(normalizeMeasurementSystem(undefined, undefined)).toBe(
        SupportedMeasurementSystem.METRIC,
      );
      expect(normalizeMeasurementSystem(null, null)).toBe(
        SupportedMeasurementSystem.METRIC,
      );
    });
  });
});
