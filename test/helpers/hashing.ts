import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { Coupon } from "./types";

/* eslint-disable @typescript-eslint/no-var-requires */
const ensjs = require("@ensdomains/ensjs");
const namehash = require("eth-ens-namehash");


export const normalizeName = (name : string) => namehash.normalize(name);

/**
 * The ens lib takes the inverse of our domain name format to
 * produce the same namehash as the one produced from our
 * registrar contract, so we need to inverse the input here.
 *
 */
export const reverseInputName = (name : string) => {
  const splitName = name.split(".");
  const reversedName = splitName.reverse();
  return reversedName.join(".");
};

/**
 * Hashes full domain path.
 */
export const hashSubdomainName = (name : string) => {
  // ens namehash lib expects child.parent for hashing algorithm as opposed to our format: parent.child
  // TODO sub: how do we deal with this? since the hash would be the reverse of what we expect
  // TODO sub: figure this out!
  const reversedInputName = reverseInputName(name);
  return ensjs.namehash(reversedInputName);
};

/**
 * Hashes last name label only.
 */
export const hashDomainLabel = (label : string) => ensjs.labelhash(label);

export const createCouponSignature = async (
  parentHash : string,
  registrantAddress : string,
  label : string,
  verifyingContract : string, // Address of the contract that verifies the coupon
  signer : SignerWithAddress
): Promise<string> => {
  const domain = {
    name: "ZNS",
    version: "1",
    chainId: (await signer.provider.getNetwork()).chainId,
    verifyingContract: verifyingContract,
  }

  const types = {
    Coupon: [ 
      { name: "parentHash", type: "bytes32" },
      { name: "registrantAddress", type: "address" },
      { name: "domainLabel", type: "string" },
    ]
  }

  const coupon : Coupon = {
    parentHash: parentHash,
    registrantAddress: registrantAddress,
    domainLabel: label,
  };

  const signedCoupon = await signer.signTypedData(
    domain,
    types,
    coupon
  );

  return signedCoupon;
}
