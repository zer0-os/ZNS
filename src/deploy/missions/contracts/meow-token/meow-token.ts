import {
  BaseDeployMission,
  IDeployMissionArgs,
  TDeployArgs,
} from "@zero-tech/zdc";
import { ProxyKinds } from "../../../constants";
import { ethers } from "ethers";
import { znsNames } from "../names";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { DefenderRelayProvider } from "@openzeppelin/defender-sdk-relay-signer-client/lib/ethers";
import { IZNSContracts } from "../../../campaign/types";


export const meowTokenName = "MEOW";
export const meowTokenSymbol = "MEOW";


export class MeowTokenDM extends BaseDeployMission<
HardhatRuntimeEnvironment,
SignerWithAddress,
DefenderRelayProvider,
IZNSContracts
> {
  proxyData = {
    isProxy: true,
    kind: ProxyKinds.transparent,
  };

  contractName = znsNames.meowToken.contract;
  instanceName = znsNames.meowToken.instance;

  constructor (args : IDeployMissionArgs<
  HardhatRuntimeEnvironment,
  SignerWithAddress,
  DefenderRelayProvider,
  IZNSContracts
  >) {
    super(args);

    if (this.config.mockMeowToken) {
      this.contractName = znsNames.meowToken.contractMock;
    } else {
      this.contractName = znsNames.meowToken.contract;
    }
  }

  async deploy () {
    if (!this.config.mockMeowToken) {
      this.logger.info("Using MEOW token from Mainnet");

      // TODO dep: add proper bytecode comparison here and throw if different!
      // const bytecodeFromChain = await this.campaign.deployer.getBytecodeFromChain(this.config.stakingTokenAddress);

      // const {
      //   bytecode,
      // } = this.getArtifact();

      // if (!compareBytecodeStrict(bytecode, bytecodeFromChain)) {
      //   this.logger.error("MEOW token bytecode compiled in this module differs from Mainnet");
      //   throw new Error(
      //     "MEOW token bytecode compiled in this module differs from Mainnet"
      //   );
      // }

      this.logger.debug(`Writing ${this.contractName} to DB...`);

      const baseContract = await this.campaign.deployer.getContractObject(
        this.contractName,
        this.config.stakingTokenAddress as string,
      );

      await this.saveToDB(baseContract);

      this.campaign.updateStateContract(this.instanceName, this.contractName, baseContract);

      // eslint-disable-next-line max-len
      this.logger.info(`Successfully created ${this.contractName} contract from Mainnet data at ${await baseContract.getAddress()}`);
    } else {
      await super.deploy();
    }
  }

  async deployArgs () : Promise<TDeployArgs> {
    return [meowTokenName, meowTokenSymbol];
  }

  async needsPostDeploy () {
    const msg = this.config.mockMeowToken ? "needs" : "doesn't need";

    this.logger.debug(`${this.contractName} ${msg} post deploy sequence`);

    return this.config.mockMeowToken as boolean;
  }

  async postDeploy () {
    const {
      meowToken,
      config: {
        deployAdmin,
      },
    } = this.campaign;

    // Mint 100,000 MEOW to the deployer
    await meowToken.connect(deployAdmin).mint(
      await deployAdmin.getAddress?.(),
      ethers.parseEther("100000")
    );

    this.logger.debug(`${this.contractName} post deploy sequence completed`);
  }
}
