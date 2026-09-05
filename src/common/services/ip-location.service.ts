import { Injectable, Logger } from "@nestjs/common";
import { Request } from "express";
import {
  normalizeCountryAndCurrency,
  SupportedCountry,
  SupportedCurrency,
  DEFAULT_REGION,
} from "../constants/country-currency.constant";

export interface LocationResult {
  country: string;
  city: string;
  currency: string;
  isDetected: boolean;
  ip?: string;
}

export const DEFAULT_FALLBACK_LOCATION: LocationResult = {
  country: DEFAULT_REGION.country,
  city: "London",
  currency: DEFAULT_REGION.currency,
  isDetected: false,
};

@Injectable()
export class IpLocationService {
  private readonly logger = new Logger(IpLocationService.name);

  /**
   * Extracts clean client IP address from Express request headers.
   */
  extractClientIp(req?: Request): string | undefined {
    if (!req) return undefined;

    const xForwardedFor = req.headers["x-forwarded-for"];
    if (typeof xForwardedFor === "string") {
      const firstIp = xForwardedFor.split(",")[0].trim();
      if (firstIp) return firstIp;
    } else if (Array.isArray(xForwardedFor) && xForwardedFor.length > 0) {
      return xForwardedFor[0].trim();
    }

    const cfIp = req.headers["cf-connecting-ip"];
    if (typeof cfIp === "string" && cfIp.trim()) {
      return cfIp.trim();
    }

    const realIp = req.headers["x-real-ip"];
    if (typeof realIp === "string" && realIp.trim()) {
      return realIp.trim();
    }

    return req.ip || req.socket?.remoteAddress;
  }

  /**
   * Checks if an IP is local, loopback, or private range.
   */
  isPrivateOrLocalIp(ip?: string): boolean {
    if (!ip) return true;
    const cleanIp = ip.replace(/^::ffff:/, "").trim();

    return (
      cleanIp === "127.0.0.1" ||
      cleanIp === "::1" ||
      cleanIp === "localhost" ||
      cleanIp.startsWith("10.") ||
      cleanIp.startsWith("192.168.") ||
      cleanIp.startsWith("172.16.") ||
      cleanIp.startsWith("172.17.") ||
      cleanIp.startsWith("172.18.") ||
      cleanIp.startsWith("172.19.") ||
      cleanIp.startsWith("172.20.") ||
      cleanIp.startsWith("172.21.") ||
      cleanIp.startsWith("172.22.") ||
      cleanIp.startsWith("172.23.") ||
      cleanIp.startsWith("172.24.") ||
      cleanIp.startsWith("172.25.") ||
      cleanIp.startsWith("172.26.") ||
      cleanIp.startsWith("172.27.") ||
      cleanIp.startsWith("172.28.") ||
      cleanIp.startsWith("172.29.") ||
      cleanIp.startsWith("172.30.") ||
      cleanIp.startsWith("172.31.") ||
      cleanIp.startsWith("fc00:") ||
      cleanIp.startsWith("fe80:")
    );
  }

  /**
   * Resolves country, city, and currency from express request or IP address.
   * Strictly enforces US (USD) or UK (GBP).
   */
  async resolveLocation(
    req?: Request,
    ipOverride?: string,
  ): Promise<LocationResult> {
    // 1. Check Cloudflare / CDN proxy geolocation headers first (instant, zero network latency)
    if (req?.headers) {
      const cfCountry = req.headers["cf-ipcountry"];
      const cfCity = req.headers["cf-ipcity"];
      if (
        typeof cfCountry === "string" &&
        cfCountry.trim() &&
        cfCountry !== "XX"
      ) {
        const rawCountry = cfCountry.trim();
        const normalized = normalizeCountryAndCurrency(rawCountry);
        const city =
          typeof cfCity === "string" && cfCity.trim()
            ? decodeURIComponent(cfCity.trim())
            : normalized.country === SupportedCountry.UNITED_STATES
              ? "New York"
              : "London";
        return {
          country: normalized.country,
          city,
          currency: normalized.currency,
          isDetected: true,
          ip: this.extractClientIp(req),
        };
      }
    }

    const ip = ipOverride || this.extractClientIp(req);

    // 2. If IP is private/local, fallback directly to default (United Kingdom / GBP)
    if (!ip || this.isPrivateOrLocalIp(ip)) {
      this.logger.debug(
        `Client IP (${ip || "unknown"}) is local/private. Defaulting country to ${DEFAULT_REGION.country}.`,
      );
      return {
        ...DEFAULT_FALLBACK_LOCATION,
        ip,
      };
    }

    // 3. Query external IP Geolocation API with timeout
    try {
      const cleanIp = ip.replace(/^::ffff:/, "").trim();
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 1500);

      const response = await fetch(
        `https://ip-api.com/json/${cleanIp}?fields=status,country,countryCode,city,currency`,
        { signal: controller.signal },
      );
      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        if (data.status === "success" && data.country) {
          const normalized = normalizeCountryAndCurrency(
            data.country,
            data.currency,
          );
          const city =
            data.city ||
            (normalized.country === SupportedCountry.UNITED_STATES
              ? "New York"
              : "London");

          this.logger.log(
            `Detected location for IP ${cleanIp}: ${city}, ${normalized.country} (${normalized.currency})`,
          );
          return {
            country: normalized.country,
            city,
            currency: normalized.currency,
            isDetected: true,
            ip: cleanIp,
          };
        }
      }
    } catch (err: any) {
      this.logger.warn(
        `IP Geolocation lookup failed (${err.message}). Defaulting country to ${DEFAULT_REGION.country}.`,
      );
    }

    // Fallback: Default to United Kingdom (GBP)
    return {
      ...DEFAULT_FALLBACK_LOCATION,
      ip,
    };
  }

  mapCountryCodeToName(code: string): string {
    return normalizeCountryAndCurrency(code).country;
  }

  mapCountryToCurrency(country: string): string {
    return normalizeCountryAndCurrency(country).currency;
  }
}
