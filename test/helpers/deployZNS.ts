import {
  ZeroTokenMock,
  ZeroTokenMock__factory,
  ZNSAccessController,
  ZNSAddressResolver,
  ZNSAddressResolver__factory,
  ZNSDomainToken,
  ZNSDomainToken__factory,
  ZNSRegistrar,
  ZNSRegistrar__factory,
  ZNSPriceOracle,
  ZNSPriceOracle__factory,
  ZNSRegistry,
  ZNSRegistry__factory,
  ZNSTreasury,
  ZNSTreasury__factory,
  ZeroToken,
  ZeroToken__factory,
} from "../../typechain";
import { DeployZNSParams, PriceParams, RegistrarConfig, ZNSContracts } from "./types";
import { ethers, upgrades } from "hardhat";
import * as hre from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import {
  priceConfigDefault,
  registrationFeePercDefault,
  ZNS_DOMAIN_TOKEN_NAME,
  ZNS_DOMAIN_TOKEN_SYMBOL,
} from "./constants";
import { deployAccessController, REGISTRAR_ROLE } from "./access";
import { BigNumber } from "ethers";
import { getProxyImplAddress } from "./utils";

export const deployZeroToken = async (
  deployer : SignerWithAddress,
  logAddress : boolean
) => {
  const factory = new ZeroToken__factory(deployer);

  const zeroToken = await hre.upgrades.deployProxy(
    factory,
    [
      "ZERO",
      "ZERO",
    ],
    {
      kind: "transparent",
    }
  ) as ZeroToken;

  await zeroToken.deployed();

  if (logAddress) {
    const impl = await getProxyImplAddress(zeroToken.address);

    console.log(`ZeroToken deployed at:
                proxy: ${zeroToken.address}
                implementation: ${impl}`);
  }

  return zeroToken;
};

export const deployRegistry = async (
  deployer : SignerWithAddress,
  accessControllerAddress : string,
  logAddress : boolean
) : Promise<ZNSRegistry> => {
  const registryFactory = new ZNSRegistry__factory(deployer);
  const registry = await hre.upgrades.deployProxy(
    registryFactory,
    [
      accessControllerAddress,
    ],
    {
      kind: "uups",
    }) as ZNSRegistry;

  await registry.deployed();

  if (logAddress) {
    const impl = await getProxyImplAddress(registry.address);

    console.log(`ZNSRegistry deployed at:
                proxy: ${registry.address}
                implementation: ${impl}`);
  }

  return registry;
};

export const deployAddressResolver = async (
  deployer : SignerWithAddress,
  accessControllerAddress : string,
  registryAddress : string,
  logAddress : boolean
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
  ) as ZNSAddressResolver;

  await resolver.deployed();

  if (logAddress) {
    const impl = await getProxyImplAddress(resolver.address);

    console.log(`ZNSAddressResolver deployed at:
                proxy: ${resolver.address}
                implementation: ${impl}`);
  }

  return resolver;
};

export const deployPriceOracle = async ({
  deployer,
  accessControllerAddress,
  priceConfig,
  registrationFee,
  logAddress,
} : {
  deployer : SignerWithAddress;
  accessControllerAddress : string;
  priceConfig : PriceParams;
  registrationFee : BigNumber;
  logAddress : boolean;
}) : Promise<ZNSPriceOracle> => {
  const priceOracleFactory = new ZNSPriceOracle__factory(deployer);

  const priceOracle = await upgrades.deployProxy(
    priceOracleFactory,
    [
      accessControllerAddress,
      priceConfig,
      registrationFee,
    ],
    {
      kind: "uups",
    }
  ) as ZNSPriceOracle;

  await priceOracle.deployed();

  if (logAddress) {
    const impl = await getProxyImplAddress(priceOracle.address);

    console.log(`ZNSPriceOracle deployed at:
                proxy: ${priceOracle.address}
                implementation: ${impl}`);
  }

  return priceOracle;
};

export const deployDomainToken = async (
  deployer : SignerWithAddress,
  accessControllerAddress : string,
  logAddress : boolean
) : Promise<ZNSDomainToken> => {
  const domainTokenFactory = new ZNSDomainToken__factory(deployer);
  const domainToken = await upgrades.deployProxy(
    domainTokenFactory,
    [
      accessControllerAddress,
      ZNS_DOMAIN_TOKEN_NAME,
      ZNS_DOMAIN_TOKEN_SYMBOL,
    ],
    {
      kind: "uups",
    }
  ) as ZNSDomainToken;

  await domainToken.deployed();

  if (logAddress) {
    const impl = await getProxyImplAddress(domainToken.address);

    console.log(`ZNSDomainToken deployed at:
                proxy: ${domainToken.address}
                implementation: ${impl}`);
  }

  return domainToken;
};

export const deployZeroTokenMock = async (
  deployer : SignerWithAddress,
  logAddress : boolean
) : Promise<ZeroTokenMock> => {
  const zTokenMockMockFactory = new ZeroTokenMock__factory(deployer);
  const token = await zTokenMockMockFactory.deploy(deployer.address);

  await token.deployed();

  if (logAddress) {
    console.log(`ZeroTokenMock deployed at: ${token.address}`);
  }

  return token;
};

export const deployTreasury = async (
  deployer : SignerWithAddress,
  accessControllerAddress : string,
  priceOracleAddress : string,
  zTokenMockAddress : string,
  zeroVaultAddress : string,
  logAddress : boolean
) : Promise<ZNSTreasury> => {
  const treasuryFactory = new ZNSTreasury__factory(deployer);
  const treasury : ZNSTreasury = await upgrades.deployProxy(treasuryFactory,
    [
      accessControllerAddress,
      priceOracleAddress,
      zTokenMockAddress,
      zeroVaultAddress,
    ],
    {
      kind: "uups",
    }
  ) as ZNSTreasury;

  await treasury.deployed();

  if (logAddress) {
    const impl = await getProxyImplAddress(treasury.address);

    console.log(`ZNSTreasury deployed at:
                proxy: ${treasury.address}
                implementation: ${impl}`);
  }

  return treasury;
};

export const deployRegistrar = async (
  deployer : SignerWithAddress,
  accessController : ZNSAccessController,
  config : RegistrarConfig,
  logAddress : boolean
) : Promise<ZNSRegistrar> => {
  const registrarFactory = new ZNSRegistrar__factory(deployer);

  const registrar = await upgrades.deployProxy(
    registrarFactory,
    [
      accessController.address,
      config.registryAddress,
      config.treasury.address,
      config.domainTokenAddress,
      config.addressResolverAddress,
    ],
    {
      kind: "uups",
    }
  ) as ZNSRegistrar;

  await registrar.deployed();

  await accessController.connect(deployer).grantRole(REGISTRAR_ROLE, registrar.address);

  if (logAddress) {
    const impl = await getProxyImplAddress(registrar.address);

    console.log(`ZNSRegistrar deployed at:
                proxy: ${registrar.address}
                implementation: ${impl}`);
  }

  return registrar;
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
  priceConfig = priceConfigDefault,
  registrationFeePerc = registrationFeePercDefault,
  zeroVaultAddress = deployer.address,
  logAddresses = false,
} : DeployZNSParams) : Promise<ZNSContracts> => {
  // We deploy every contract as a UUPS proxy, but ZERO is already
  // deployed as a transparent proxy. This means that there is already
  // a proxy admin deployed to the network. Because future deployments
  // warn when this is the case, we silence the warning from hardhat here
  // to not clog the test output.
  await hre.upgrades.silenceWarnings();

  const accessController = await deployAccessController({
    deployer,
    governorAddresses: [deployer.address, ...governorAddresses],
    adminAddresses: [deployer.address, ...adminAddresses],
    logAddress: logAddresses,
  });

  const registry = await deployRegistry(deployer, accessController.address, logAddresses);

  const domainToken = await deployDomainToken(deployer, accessController.address, logAddresses);

  // While we do use the real ZeroToken contract, it is only deployed as a mock here
  // for testing purposes that verify expected behavior of other contracts.
  // This should not be used in any other context than deploying to a local hardhat testnet.
  const zeroTokenMock = await deployZeroToken(deployer, logAddresses);

  const addressResolver = await deployAddressResolver(
    deployer,
    accessController.address,
    registry.address,
    logAddresses
  );

  const priceOracle = await deployPriceOracle({
    deployer,
    accessControllerAddress: accessController.address,
    priceConfig,
    registrationFee: registrationFeePerc,
    logAddress: logAddresses,
  });

  const treasury = await deployTreasury(
    deployer,
    accessController.address,
    priceOracle.address,
    zeroTokenMock.address,
    zeroVaultAddress,
    logAddresses
  );

  const config : RegistrarConfig = {
    treasury,
    registryAddress: registry.address,
    domainTokenAddress: domainToken.address,
    addressResolverAddress: addressResolver.address,
  };

  const registrar = await deployRegistrar(deployer, accessController, config, logAddresses);

  const znsContracts : ZNSContracts = {
    accessController,
    registry,
    domainToken,
    zeroToken: zeroTokenMock,
    addressResolver,
    priceOracle,
    treasury,
    registrar,
  };

  // Give ZERO to the deployer and allowance to the treasury
  await zeroTokenMock.connect(deployer).approve(treasury.address, ethers.constants.MaxUint256);
  await zeroTokenMock.mint(deployer.address, priceConfigDefault.maxPrice.mul("10"));

  return znsContracts;
};
