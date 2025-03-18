import {
  MeowTokenMock__factory,
  ZNSAccessController,
  ZNSAccessController__factory,
  ZNSAddressResolver,
  ZNSAddressResolver__factory,
  ZNSCurvePricer,
  ZNSDomainToken,
  ZNSDomainToken__factory,
  ZNSFixedPricer__factory,
  ZNSCurvePricer__factory,
  ZNSRootRegistrar,
  ZNSRootRegistrar__factory,
  ZNSRegistry,
  ZNSRegistry__factory,
  ZNSSubRegistrar__factory,
  ZNSTreasury,
  ZNSTreasury__factory,
  ZNSFixedPricer,
  ZNSSubRegistrar,
  MeowTokenMock,
} from "../../../typechain";
import { DeployZNSParams, RegistrarConfig, IZNSContractsLocal } from "../types";
import * as hre from "hardhat";
import { ethers, upgrades } from "hardhat";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import {
  accessControllerName,
  addressResolverName,
  domainTokenName,
  erc1967ProxyName,
  fixedPricerName,
  DEFAULT_PRICE_CONFIG,
  curvePricerName,
  registrarName,
  registryName,
  subRegistrarName,
  treasuryName,
  meowTokenMockName,
  ZNS_DOMAIN_TOKEN_NAME,
  ZNS_DOMAIN_TOKEN_SYMBOL,
  DEFAULT_ROYALTY_FRACTION,
  DEFAULT_RESOLVER_TYPE,
} from "../constants";
import { REGISTRAR_ROLE } from "../../../src/deploy/constants";
import { getProxyImplAddress } from "../utils";
import { ICurvePriceConfig } from "../../../src/deploy/missions/types";
import { meowTokenName, meowTokenSymbol } from "../../../src/deploy/missions/contracts";
import { transparentProxyName } from "../../../src/deploy/missions/contracts/names";


export const deployAccessController = async ({
  deployer,
  governorAddresses,
  adminAddresses,
  isTenderlyRun = false,
} : {
  deployer : SignerWithAddress;
  governorAddresses : Array<string>;
  adminAddresses : Array<string>;
  isTenderlyRun ?: boolean;
}) : Promise<ZNSAccessController> => {
  const accessControllerFactory = new ZNSAccessController__factory(deployer);
  const controller = await accessControllerFactory.deploy(governorAddresses, adminAddresses);

  await controller.waitForDeployment();
  const proxyAddress = await controller.getAddress();

  if (isTenderlyRun) {
    await hre.tenderly.verify({
      name: accessControllerName,
      address: proxyAddress,
    });

    console.log(`AccessController deployed at: ${proxyAddress}`);
  }

  return controller as unknown as ZNSAccessController;
};

export const deployRegistry = async (
  deployer : SignerWithAddress,
  accessControllerAddress : string,
  isTenderlyRun = false,
) : Promise<ZNSRegistry> => {
  const registryFactory = new ZNSRegistry__factory(deployer);
  const registry = await hre.upgrades.deployProxy(
    registryFactory,
    [
      accessControllerAddress,
    ],
    {
      kind: "uups",
    });

  await registry.waitForDeployment();
  const proxyAddress = await registry.getAddress();

  if (isTenderlyRun) {
    await hre.tenderly.verify({
      name: erc1967ProxyName,
      address: proxyAddress,
    });

    const impl = await getProxyImplAddress(proxyAddress);

    await hre.tenderly.verify({
      name: registryName,
      address: impl,
    });

    console.log(`ZNSRegistry deployed at:
                proxy: ${proxyAddress}
                implementation: ${impl}`);
  }

  return registry as unknown as ZNSRegistry;
};

export const deployDomainToken = async (
  deployer : SignerWithAddress,
  accessControllerAddress : string,
  royaltyReceiverAddress : string,
  royaltyFraction : bigint,
  isTenderlyRun : boolean
) : Promise<ZNSDomainToken> => {
  const domainTokenFactory = new ZNSDomainToken__factory(deployer);
  const domainToken = await upgrades.deployProxy(
    domainTokenFactory,
    [
      accessControllerAddress,
      ZNS_DOMAIN_TOKEN_NAME,
      ZNS_DOMAIN_TOKEN_SYMBOL,
      royaltyReceiverAddress,
      royaltyFraction,
    ],
    {
      kind: "uups",
    }
  ) as unknown as ZNSDomainToken;

  await domainToken.waitForDeployment();

  const proxyAddress = await domainToken.getAddress();

  if (isTenderlyRun) {
    await hre.tenderly.verify({
      name: erc1967ProxyName,
      address: proxyAddress,
    });

    const impl = await getProxyImplAddress(proxyAddress);

    await hre.tenderly.verify({
      name: domainTokenName,
      address: impl,
    });

    console.log(`ZNSDomainToken deployed at:
                proxy: ${proxyAddress}
                implementation: ${impl}`);
  }

  return domainToken as unknown as ZNSDomainToken;
};

export const deployMeowToken = async (
  deployer : SignerWithAddress,
  isTenderlyRun : boolean
) : Promise<MeowTokenMock> => {
  const factory = new MeowTokenMock__factory(deployer);

  const meowToken = await hre.upgrades.deployProxy(
    factory,
    [
      meowTokenName,
      meowTokenSymbol,
    ],
    {
      kind: "transparent",
    }
  ) as unknown as MeowTokenMock;

  await meowToken.waitForDeployment();
  const proxyAddress = await meowToken.getAddress();

  if (isTenderlyRun) {
    await hre.tenderly.verify({
      name: transparentProxyName,
      address: proxyAddress,
    });

    const impl = await getProxyImplAddress(proxyAddress);

    await hre.tenderly.verify({
      name: meowTokenMockName,
      address: impl,
    });

    console.log(`${meowTokenMockName} deployed at:
                proxy: ${proxyAddress}
                implementation: ${impl}`);
  }

  // Mint 10,000 ZERO for self
  await meowToken.mint(proxyAddress, ethers.parseEther("10000"));

  return meowToken as unknown as MeowTokenMock;
};

export const deployAddressResolver = async (
  deployer : SignerWithAddress,
  accessControllerAddress : string,
  registryAddress : string,
  isTenderlyRun : boolean
) : Promise<ZNSAddressResolver> => {
  const addressResolverFactory = new ZNSAddressResolver__factory(deployer);

  const resolver = await upgrades.deployProxy(
    addressResolverFactory,
    [
      accessControllerAddress,
      registryAddress,
    ],
    {
      kind: "uups",
    }
  );

  await resolver.waitForDeployment();

  const proxyAddress = await resolver.getAddress();

  if (isTenderlyRun) {
    await hre.tenderly.verify({
      name: erc1967ProxyName,
      address: proxyAddress,
    });

    const impl = await getProxyImplAddress(proxyAddress);

    await hre.tenderly.verify({
      name: addressResolverName,
      address: impl,
    });

    console.log(`ZNSAddressResolver deployed at:
                proxy: ${proxyAddress}
                implementation: ${impl}`);
  }

  return resolver as unknown as ZNSAddressResolver;
};

export const deployCurvePricer = async ({
  deployer,
  accessControllerAddress,
  registryAddress,
  priceConfig,
  isTenderlyRun,
} : {
  deployer : SignerWithAddress;
  accessControllerAddress : string;
  registryAddress : string;
  priceConfig : ICurvePriceConfig;
  isTenderlyRun : boolean;
}) : Promise<ZNSCurvePricer> => {
  const curveFactory = new ZNSCurvePricer__factory(deployer);

  const curvePricer = await upgrades.deployProxy(
    curveFactory,
    [
      accessControllerAddress,
      registryAddress,
      priceConfig,
    ],
    {
      kind: "uups",
    }
  );

  await curvePricer.waitForDeployment();

  const proxyAddress = await curvePricer.getAddress();

  if (isTenderlyRun) {
    await hre.tenderly.verify({
      name: erc1967ProxyName,
      address: proxyAddress,
    });

    const impl = await getProxyImplAddress(proxyAddress);

    await hre.tenderly.verify({
      name: curvePricerName,
      address: impl,
    });

    console.log(`${curvePricerName} deployed at:
                proxy: ${proxyAddress}
                implementation: ${impl}`);
  }

  return curvePricer as unknown as ZNSCurvePricer;
};

export const deployTreasury = async ({
  deployer,
  accessControllerAddress,
  registryAddress,
  zTokenMockAddress,
  zeroVaultAddress,
  isTenderlyRun = false,
} : {
  deployer : SignerWithAddress;
  accessControllerAddress : string;
  registryAddress : string;
  zTokenMockAddress : string;
  zeroVaultAddress : string;
  isTenderlyRun : boolean;
}) : Promise<ZNSTreasury> => {
  const treasuryFactory = new ZNSTreasury__factory(deployer);
  const treasury = await upgrades.deployProxy(treasuryFactory,
    [
      accessControllerAddress,
      registryAddress,
      zTokenMockAddress,
      zeroVaultAddress,
    ],
    {
      kind: "uups",
    }
  );

  await treasury.waitForDeployment();
  const proxyAddress = await treasury.getAddress();

  if (isTenderlyRun) {
    await hre.tenderly.verify({
      name: erc1967ProxyName,
      address: proxyAddress,
    });

    const impl = await getProxyImplAddress(proxyAddress);

    await hre.tenderly.verify({
      name: treasuryName,
      address: impl,
    });

    console.log(`ZNSTreasury deployed at:
                proxy: ${proxyAddress}
                implementation: ${impl}`);
  }

  return treasury as unknown as ZNSTreasury;
};

export const deployRootRegistrar = async (
  deployer : SignerWithAddress,
  accessController : ZNSAccessController,
  config : RegistrarConfig,
  isTenderlyRun : boolean
) : Promise<ZNSRootRegistrar> => {
  const registrarFactory = new ZNSRootRegistrar__factory(deployer);

  const registrar = await upgrades.deployProxy(
    registrarFactory,
    [
      await accessController.getAddress(),
      config.registryAddress,
      config.curvePricerAddress,
      config.treasuryAddress,
      config.domainTokenAddress,
    ],
    {
      kind: "uups",
    }
  );

  await registrar.waitForDeployment();
  const proxyAddress = await registrar.getAddress();

  await accessController.connect(deployer).grantRole(REGISTRAR_ROLE, proxyAddress);

  if (isTenderlyRun) {
    await hre.tenderly.verify({
      name: erc1967ProxyName,
      address: proxyAddress,
    });

    const impl = await getProxyImplAddress(proxyAddress);

    await hre.tenderly.verify({
      name: registrarName,
      address: impl,
    });

    console.log(`ZNSRootRegistrar deployed at:
                proxy: ${proxyAddress}
                implementation: ${impl}`);
  }

  return registrar as unknown as ZNSRootRegistrar;
};

export const deployFixedPricer = async ({
  deployer,
  acAddress,
  regAddress,
  isTenderlyRun = false,
} : {
  deployer : SignerWithAddress;
  acAddress : string;
  regAddress : string;
  isTenderlyRun ?: boolean;
}) => {
  const pricerFactory = new ZNSFixedPricer__factory(deployer);
  const fixedPricer = await upgrades.deployProxy(
    pricerFactory,
    [
      acAddress,
      regAddress,
    ],
    {
      kind: "uups",
    }
  );

  await fixedPricer.waitForDeployment();
  const proxyAddress = await fixedPricer.getAddress();

  if (isTenderlyRun) {
    await hre.tenderly.verify({
      name: erc1967ProxyName,
      address: proxyAddress,
    });

    const impl = await getProxyImplAddress(proxyAddress);

    await hre.tenderly.verify({
      name: fixedPricerName,
      address: impl,
    });

    console.log(`${fixedPricerName} deployed at:
                proxy: ${proxyAddress}
                implementation: ${impl}`);
  }

  return fixedPricer as unknown as ZNSFixedPricer;
};

export const deploySubRegistrar = async ({
  deployer,
  accessController,
  registry,
  rootRegistrar,
  admin,
  isTenderlyRun = false,
} : {
  deployer : SignerWithAddress;
  accessController : ZNSAccessController;
  registry : ZNSRegistry;
  rootRegistrar : ZNSRootRegistrar;
  admin : SignerWithAddress;
  isTenderlyRun ?: boolean;
}) => {
  const subRegistrarFactory = new ZNSSubRegistrar__factory(deployer);
  const subRegistrar = await upgrades.deployProxy(
    subRegistrarFactory,
    [
      await accessController.getAddress(),
      await registry.getAddress(),
      await rootRegistrar.getAddress(),
    ],
    {
      kind: "uups",
    }
  );

  await subRegistrar.waitForDeployment();
  const proxyAddress = await subRegistrar.getAddress();

  // set SubRegistrar on RootRegistrar
  await rootRegistrar.setSubRegistrar(proxyAddress);

  // give SubRegistrar REGISTRAR_ROLE
  await accessController.connect(admin).grantRole(REGISTRAR_ROLE, proxyAddress);

  if (isTenderlyRun) {
    await hre.tenderly.verify({
      name: erc1967ProxyName,
      address: proxyAddress,
    });

    const impl = await getProxyImplAddress(proxyAddress);

    await hre.tenderly.verify({
      name: subRegistrarName,
      address: impl,
    });

    console.log(`${subRegistrarName} deployed at:
                proxy: ${proxyAddress}
                implementation: ${impl}`);
  }

  return subRegistrar as unknown as ZNSSubRegistrar;
};

/**
 * We use this script to aid in testing, NOT for anything more
 * such as deploying to live testnets or mainnet. Do not use any
 * of the code present for tasks other than testing behavior on a
 * local hardhat build
 */
export const deployZNS = async ({
  deployer,
  governorAddresses,
  adminAddresses,
  priceConfig = DEFAULT_PRICE_CONFIG,
  zeroVaultAddress = deployer.address,
  isTenderlyRun = false,
} : DeployZNSParams) : Promise<IZNSContractsLocal> => {
  // We deploy every contract as a UUPS proxy, but ZERO is already
  // deployed as a transparent proxy. This means that there is already
  // a proxy admin deployed to the network. Because future deployments
  // warn when this is the case, we silence the warning from hardhat here
  // to not clog the test output.
  await hre.upgrades.silenceWarnings();

  if (!zeroVaultAddress) {
    zeroVaultAddress = deployer.address;
  }

  const accessController = await deployAccessController({
    deployer,
    governorAddresses: [deployer.address, ...governorAddresses],
    adminAddresses: [deployer.address, ...adminAddresses],
    isTenderlyRun,
  });

  const registry = await deployRegistry(
    deployer,
    await accessController.getAddress(),
    isTenderlyRun
  );

  const domainToken = await deployDomainToken(
    deployer,
    await accessController.getAddress(),
    zeroVaultAddress,
    DEFAULT_ROYALTY_FRACTION,
    isTenderlyRun
  );

  // While we do use the real ZeroToken contract, it is only deployed as a mock here
  // for testing purposes that verify expected behavior of other contracts.
  // This should not be used in any other context than deploying to a local hardhat testnet.
  const meowTokenMock = await deployMeowToken(deployer, isTenderlyRun);

  const addressResolver = await deployAddressResolver(
    deployer,
    await accessController.getAddress(),
    await registry.getAddress(),
    isTenderlyRun
  );

  const curvePricer = await deployCurvePricer({
    deployer,
    accessControllerAddress: await accessController.getAddress(),
    registryAddress: await registry.getAddress(),
    priceConfig,
    isTenderlyRun,
  });

  const treasury = await deployTreasury({
    deployer,
    accessControllerAddress: await accessController.getAddress(),
    registryAddress: await registry.getAddress(),
    zTokenMockAddress: await meowTokenMock.getAddress(),
    zeroVaultAddress,
    isTenderlyRun,
  });

  const config : RegistrarConfig = {
    treasuryAddress: await treasury.getAddress(),
    registryAddress: await registry.getAddress(),
    curvePricerAddress: await curvePricer.getAddress(),
    domainTokenAddress: await domainToken.getAddress(),
  };

  const rootRegistrar = await deployRootRegistrar(
    deployer,
    accessController,
    config,
    isTenderlyRun
  );

  const fixedPricer = await deployFixedPricer({
    deployer,
    acAddress: await accessController.getAddress(),
    regAddress: await registry.getAddress(),
    isTenderlyRun,
  });

  const subRegistrar = await deploySubRegistrar({
    deployer,
    accessController,
    registry,
    rootRegistrar,
    admin: deployer,
    isTenderlyRun,
  });

  const znsContracts : IZNSContractsLocal = {
    accessController,
    registry,
    domainToken,
    meowToken: meowTokenMock,
    addressResolver,
    curvePricer,
    treasury,
    rootRegistrar,
    fixedPricer,
    subRegistrar,
    zeroVaultAddress,
  };

  // Give 15 ZERO to the deployer and allowance to the treasury
  await meowTokenMock.connect(deployer).approve(await treasury.getAddress(), ethers.MaxUint256);
  await meowTokenMock.mint(await deployer.getAddress(), ethers.parseEther("5000000"));

  await registry.connect(deployer).addResolverType(DEFAULT_RESOLVER_TYPE, await addressResolver.getAddress());

  return znsContracts;
};
