import { ProxyKinds } from "../../constants";
import { TDeployArgs } from "../types";
import { BaseDeployMission } from "../base-deploy-mission";
import { znsNames } from "./names";


export class ZNSFixedPricerDM extends BaseDeployMission {
  proxyData = {
    isProxy: true,
    kind: ProxyKinds.uups,
  };

  contractName = znsNames.fixedPricer.contract;
  instanceName = znsNames.fixedPricer.instance;

  deployArgs () : TDeployArgs {
    const {
      accessController,
      registry,
    } = this.campaign;

    return [ accessController.address, registry.address ];
  }
}
