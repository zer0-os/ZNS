import { getConfig } from "./campaign/environments";
import { runZnsCampaign } from "./zns-campaign";
import { Defender } from "@openzeppelin/defender-sdk";
import * as hre from "hardhat";

import { getLogger } from "./logger/create-logger";
import { ethers } from "ethers";

const logger = getLogger();

const runCampaign = async () => {
  // const credentials = {
  //   apiKey: process.env.DEFENDER_KEY,
  //   apiSecret: process.env.DEFENDER_SECRET,
  //   relayerApiKey: process.env.RELAYER_KEY,
  //   relayerApiSecret: process.env.RELAYER_SECRET,
  // };
  //
  // const client = new Defender(credentials);
  //
  // const provider = client.relaySigner.getProvider();
  // const deployer = client.relaySigner.getSigner(provider, { speed: "fast" });

  const [ deployer ] = await hre.ethers.getSigners();
  const provider = new ethers.JsonRpcProvider(process.env.MOONWALKER_RPC_URL);

  const config = await getConfig({
    deployer,
  });

  await runZnsCampaign({
    config,
    provider,
  });
};

runCampaign().catch(error => {
  logger.error(error.stack);
  process.exit(1);
}).finally(() => {
  process.exit(0);
});
