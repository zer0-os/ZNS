import { ethers } from "ethers";

export const getSubnodeHash = (
  parentHash: string,
  labelHash: string
): string => {
  const calculatedHash = ethers.utils.keccak256(
    ethers.utils.defaultAbiCoder.encode(
      ["bytes32", "bytes32"],
      [ethers.utils.arrayify(parentHash), ethers.utils.arrayify(labelHash)]
    )
  );

  return calculatedHash;
};