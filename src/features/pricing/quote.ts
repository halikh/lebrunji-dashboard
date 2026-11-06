import type { Band } from "./api/pricing";

/**
 * What the ladder charges for one ride — the preview beside the ladder.
 *
 * Mirrors the database rather than inventing a rule:
 *
 * - `delivery_fee_for_km` (`0059`): the first band whose ceiling is at or
 *   above the distance. `<=`, so 3 km on a "up to 3 km" band is that band.
 * - Past the top band there is no price: one shop's leg is out of range
 *   (`refuse_out_of_range`), and a multi-shop ride longer than the radius is
 *   refused with `ROUTE` (`0193`, `max_route_km()`).
 * - Several shops: the ride's band plus `extra_store_fee` for every shop after
 *   the first (`0193`). The real bill is also capped at what separate orders
 *   would cost, which needs each shop's own leg — the screen says so in words
 *   rather than pretending to know the legs.
 */
export type Quote =
  | { kind: "none" }
  | { kind: "out"; radiusKm: number }
  | {
      kind: "priced";
      band: Band;
      ride: number;
      stops: number;
      total: number;
    };

export function quoteDelivery(
  ladder: readonly Band[],
  km: number,
  shops: number,
  extraStoreFee: number,
): Quote {
  const bands = ladder
    .filter((band) => band.upToKm > 0 && band.amount >= 0)
    .sort((a, b) => a.upToKm - b.upToKm);
  if (bands.length === 0 || !Number.isFinite(km) || km < 0) {
    return { kind: "none" };
  }

  const band = bands.find((one) => km <= one.upToKm);
  if (!band) return { kind: "out", radiusKm: bands[bands.length - 1].upToKm };

  const stops = Math.max(0, Math.round(shops) - 1) * Math.max(0, extraStoreFee);
  return {
    kind: "priced",
    band,
    ride: band.amount,
    stops,
    total: band.amount + stops,
  };
}
