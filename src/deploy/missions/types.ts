import { BaseDeployMission } from "./base-deploy-mission";
import { DeployCampaign } from "../campaign/deploy-campaign";
import { IDeployCampaignConfig, TLogger } from "../campaign/types";
import { BigNumber } from "ethers";


export interface IDeployMissionArgs {
  campaign : DeployCampaign;
  logger : TLogger;
  config : IDeployCampaignConfig;
}

export type TDeployMissionCtor = new (args : IDeployMissionArgs) => BaseDeployMission;

export type TDeployArg = string | Array<string> | BigNumber | ICurvePriceConfig;

export type TDeployArgs = Array<TDeployArg>;

export type TProxyKind = "uups" | "transparent" | "beacon" | undefined;

export interface IProxyKinds {
  uups : TProxyKind;
  transparent : TProxyKind;
  beacon : TProxyKind;
}

export interface IProxyData {
  isProxy : boolean;
  kind ?: TProxyKind;
}

export interface ICurvePriceConfig {
  maxPrice : BigNumber;
  minPrice : BigNumber;
  maxLength : BigNumber;
  baseLength : BigNumber;
  precisionMultiplier : BigNumber;
  feePercentage : BigNumber;
  isSet : boolean;
}
