import { DEFAULT_PERCENTAGE_BASIS, DEFAULT_PRICE_CONFIG } from "./constants";
import { IFixedPriceConfig } from "./types";
import { ICurvePriceConfig } from "../../src/deploy/missions/types";


/**
 * Get the domain name price base on its length when given
 * an already deployed contract
 *
 * @param name Length of the domain name
 * @param priceConfig Object with all the pricing props
 * @returns The expected price for that domain
 */
export const getCurvePrice = (
  name : string,
  priceConfig = DEFAULT_PRICE_CONFIG,
) : bigint => {
  // Get price configuration for contract
  const {
    maxPrice,
    minPrice,
    baseLength,
    maxLength,
    precisionMultiplier,
  } = priceConfig;

  if (baseLength === 0n) return maxPrice;

  if (BigInt(name.length) <= baseLength) {
    return maxPrice;
  }

  if (BigInt(name.length) > maxLength) {
    return minPrice;
  }

  const base = baseLength * maxPrice / BigInt(name.length);

  return base / precisionMultiplier * precisionMultiplier;
};

export const getStakingOrProtocolFee = (
  forAmount : bigint,
  feePercentage : bigint = DEFAULT_PRICE_CONFIG.feePercentage,
) => forAmount * feePercentage / DEFAULT_PERCENTAGE_BASIS;

/**
 * Get the domain name price, the registration fee and the total
 * based on name length when given an already deployed contract
 *
 * @param name Length of the domain name
 * @param priceConfig Object with all the pricing props
 * @returns The full expected price object for that domain
 */
export const getPriceObject = (
  name : string,
  priceConfig : Partial<ICurvePriceConfig> | Partial<IFixedPriceConfig> = DEFAULT_PRICE_CONFIG,
) : {
  totalPrice : bigint;
  expectedPrice : bigint;
  stakeFee : bigint;
} => {
  let expectedPrice;
  const configLen = Object.keys(priceConfig).length;
  if (configLen === 7 || configLen === 6) {
    expectedPrice = getCurvePrice(name, priceConfig as ICurvePriceConfig);
  } else if (configLen === 3 || configLen === 2) {
    ({ price: expectedPrice } = priceConfig as IFixedPriceConfig);
  } else {
    throw new Error("Invalid price config");
  }

  const { feePercentage } = priceConfig;

  const stakeFee = getStakingOrProtocolFee(expectedPrice, feePercentage);

  const totalPrice = expectedPrice + stakeFee;

  return {
    totalPrice,
    expectedPrice,
    stakeFee,
  };
};