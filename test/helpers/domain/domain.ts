import * as hre from "hardhat";
import { IZNSContracts } from "../../../src/deploy/campaign/types";
import { IFullDomainConfig } from "./types";
import {
  IDistributionConfig,
  IPaymentConfig,
} from "../types";
import {
  ICurvePriceConfig,
  IFixedPriceConfig,
} from "../../../src/deploy/missions/types";
import {
  AccessType,
  curvePriceConfigEmpty,
  distrConfigEmpty,
  fixedPriceConfigEmpty,
  paymentConfigEmpty,
  PaymentType,
} from "../constants";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { fundApprove } from "../register-setup";
import {
  Addressable,
  ContractTransactionResponse,
} from "ethers";
import { expect } from "chai";
import { encodePriceConfig } from "../pricing";


export default class Domain {
  // TODO dom: need to make a class with a method for every possible feature of ZNS contracts
  zns : IZNSContracts;

  hash : string;

  isRoot : boolean;
  owner : SignerWithAddress;
  tokenOwner : string;
  label : string;
  parentHash : string;
  distrConfig : IDistributionConfig;
  priceConfig : ICurvePriceConfig | IFixedPriceConfig;
  paymentConfig : IPaymentConfig;
  domainAddress : string;
  tokenURI : string;

  constructor ({
    zns,
    domainConfig,
  } : {
    zns : IZNSContracts;
    domainConfig : IFullDomainConfig;
  }) {
    // setting up all nessesary params for a Domain
    this.zns = zns;
    this.owner = domainConfig.owner;
    this.label = domainConfig.label;

    // setting up all optional params
    this.parentHash = domainConfig.parentHash || hre.ethers.ZeroHash;
    this.isRoot = this.parentHash === hre.ethers.ZeroHash;
    this.tokenOwner = domainConfig.tokenOwner || this.owner.address;
    this.distrConfig = domainConfig.distrConfig || distrConfigEmpty;

    if (!domainConfig.priceConfig) {
      switch (this.distrConfig.pricerContract) {
      case zns.curvePricer.target:
        this.priceConfig = curvePriceConfigEmpty;
        break;
      case zns.fixedPricer.target:
        this.priceConfig = fixedPriceConfigEmpty;
        break;
      default:
        this.priceConfig = {} as ICurvePriceConfig | IFixedPriceConfig;
      }
    } else {
      this.priceConfig = domainConfig.priceConfig;
    }

    if (!this.distrConfig.priceConfig) {
      this.distrConfig.priceConfig = encodePriceConfig(this.priceConfig);
    }

    this.paymentConfig = domainConfig.paymentConfig || paymentConfigEmpty;
    this.domainAddress = domainConfig.domainAddress || this.owner.address;
    this.tokenURI = domainConfig.tokenURI || "https://example.com/token-uri";

    this.hash = "";
  }

  get tokenId () : bigint {
    return BigInt(this.hash);
  }

  get ownerOfHash () : Promise<string> {
    return this.zns.registry.getDomainOwner(this.hash);
  }

  get ownerOfToken () : Promise<string> {
    return this.zns.domainToken.ownerOf(this.tokenId);
  }

  async getPaymentConfig () : Promise<IPaymentConfig> {
    return this.zns.treasury.getPaymentConfig(this.hash);
  }

  async isOwnerOrOperator (candidate : SignerWithAddress) : Promise<boolean> {
    return this.zns.registry.isOwnerOrOperator(this.hash, candidate.address);
  }

  private async getDomainHashFromEvent (domainOwner ?: SignerWithAddress) : Promise<string> {
    const latestBlock = await time.latestBlock();
    const filter = this.zns.rootRegistrar.filters.DomainRegistered(
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      domainOwner ? domainOwner : this.owner.address,
      this.tokenOwner === hre.ethers.ZeroAddress ? undefined : this.tokenOwner,
      undefined,
    );

    const events = await this.zns.rootRegistrar.queryFilter(filter, latestBlock - 2, latestBlock);
    const { args: { domainHash } } = events[events.length - 1];

    return domainHash;
  }

  async mintAndApproveForDomain (user ?: SignerWithAddress) : Promise<ContractTransactionResponse | undefined> {
    return (fundApprove({
      zns: this.zns,
      parentHash: this.parentHash,
      user: user ? user : this.owner,
      domainLabel: this.label,
    }));
  }

  async register (executor ?: SignerWithAddress) : Promise<ContractTransactionResponse> {
    const {
      zns,
      owner,
      label,
      parentHash,
      distrConfig,
      paymentConfig,
      tokenURI,
      tokenOwner,
      domainAddress,
      isRoot,
    } = this;

    let txPromise : ContractTransactionResponse;
    const caller = executor ? executor : owner;

    // mint and approve strict amount of tokens for domain registration
    await this.mintAndApproveForDomain(caller);

    if (isRoot) {
      txPromise = await zns.rootRegistrar.connect(caller).registerRootDomain({
        name: label,
        domainAddress: hre.ethers.isAddress(domainAddress) ? domainAddress : owner.address,
        tokenOwner,
        tokenURI,
        distrConfig,
        paymentConfig,
      });
    } else {
      txPromise = await zns.subRegistrar.connect(caller).registerSubdomain({
        parentHash,
        label,
        domainAddress: hre.ethers.isAddress(domainAddress) ? domainAddress : owner.address,
        tokenOwner,
        tokenURI,
        distrConfig,
        paymentConfig,
      });
    }

    this.hash = await this.getDomainHashFromEvent(caller);

    return txPromise;
  }

  async revoke (executor ?: SignerWithAddress) : Promise<ContractTransactionResponse> {
    return this.zns.rootRegistrar.connect(executor ? executor : this.owner).revokeDomain(this.hash);
  }

  async assignDomainToken ({
    to,
    executor,
  } : {
    to : string;
    executor ?: SignerWithAddress;
  }) : Promise<ContractTransactionResponse> {
    return this.zns.rootRegistrar.connect(executor ? executor : this.owner).assignDomainToken(
      this.hash,
      to
    );
  }

  async updateDomainRecord (
    resolverType ?: string,
    newOwner ?: string,
    executor ?: SignerWithAddress
  ) : Promise<ContractTransactionResponse> {
    return this.zns.registry.connect(executor ? executor : this.owner).updateDomainRecord(
      this.hash,
      newOwner ? newOwner : this.owner,
      resolverType ? resolverType : "address",
    );
  }

  async updateMintlistForDomain ({
    candidates,
    allowed,
    executor,
  } : {
    candidates : Array<string>;
    allowed : Array<boolean>;
    executor ?: SignerWithAddress;
  }) : Promise<ContractTransactionResponse> {
    if (candidates.length !== allowed.length)
      throw new Error("Domain Helper: Candidates and allowed arrays must have the same length");

    return this.zns.subRegistrar.connect(executor ? executor : this.owner).updateMintlistForDomain(
      this.hash,
      candidates,
      allowed,
    );
  }

  async setOwnersOperator (
    operator : string,
    allowed : boolean,
    executor ?: SignerWithAddress
  ) : Promise<ContractTransactionResponse> {
    return this.zns.registry.connect(executor ? executor : this.owner).setOwnersOperator(operator, allowed);
  }

  async setDistributionConfigForDomain (
    distrConfig : IDistributionConfig,
    executor ?: SignerWithAddress
  ) {
    const currentConfig = distrConfig ? distrConfig : this.distrConfig;

    await this.zns.subRegistrar.connect(executor ? executor : this.owner).setDistributionConfigForDomain(
      this.hash,
      currentConfig,
    );

    // updating local var
    this.distrConfig = currentConfig;
  }

  async setPricerDataForDomain (
    priceConfig ?: ICurvePriceConfig | IFixedPriceConfig,
    pricerContract ?: string | Addressable,
    executor ?: SignerWithAddress
  ) {
    if (priceConfig ||
      this.priceConfig !== undefined ||
      Object.keys(this.priceConfig).length === 0
    ) {
      await this.zns.subRegistrar.connect(executor ? executor : this.owner).setPricerDataForDomain(
        this.hash,
        priceConfig ? encodePriceConfig(priceConfig) : encodePriceConfig(this.priceConfig),
        pricerContract ? pricerContract : this.distrConfig.pricerContract
      );
    } else {
      throw new Error("Domain Helper: priceConfig is not specified");
    }

    // updating local var
    if (priceConfig) {
      this.priceConfig = priceConfig;
    }
  }

  async setPaymentTypeForDomain (
    paymentType : bigint,
    executor ?: SignerWithAddress
  ) : Promise<ContractTransactionResponse | undefined> {
    if (Object.values(PaymentType).includes(paymentType)) {
      return this.zns.subRegistrar.connect(executor ? executor : this.owner).setPaymentTypeForDomain(
        this.hash,
        paymentType,
      );
    }

    // updating local var
    this.distrConfig.paymentType = paymentType;
  }

  async setAccessTypeForDomain (
    accessType : bigint,
    executor ?: SignerWithAddress
  ) : Promise<ContractTransactionResponse | undefined> {
    if (!Object.values(AccessType).includes(accessType)) {
      return this.zns.subRegistrar.connect(executor ? executor : this.owner).setAccessTypeForDomain(
        this.hash,
        accessType,
      );
    }

    // updating local var
    this.distrConfig.accessType = accessType;
  }

  async setPaymentTokenForDomain ({
    tokenAddress,
    executor,
  } : {
    tokenAddress : string;
    executor ?: SignerWithAddress;
  }) : Promise<ContractTransactionResponse> {
    if (!hre.ethers.isAddress(tokenAddress)) {
      throw new Error("Domain Helper: Invalid token address provided");
    }

    return this.zns.treasury.connect(executor ? executor : this.owner).setPaymentToken(
      this.hash,
      tokenAddress
    );
  }

  // ------------------------------------------------------
  // VALIDATION
  // ------------------------------------------------------
  async registerAndValidateDomain (
    executor ?: SignerWithAddress,
    domainOwner ?: string,
    tokenOwner ?: string,
  ) : Promise<void> {
    const caller = executor ? executor : this.owner;
    const txPromise = await this.register(caller);

    if (!domainOwner) {
      domainOwner = caller.address;
    }
    if (!tokenOwner) {
      tokenOwner = caller.address;
    }

    // check domain existence with event
    await expect(txPromise)
      .to.emit(
        this.zns.rootRegistrar,
        "DomainRegistered"
      ).withArgs(
        this.parentHash,
        this.hash,
        this.label,
        BigInt(this.hash),
        this.tokenURI,
        domainOwner,
        tokenOwner,
        this.domainAddress
      );

    // check domain existence with registry
    const record = await this.zns.registry.getDomainRecord(this.hash);
    const resolverTypeReference = this.domainAddress === hre.ethers.ZeroAddress ? "" : "address";
    const resolverAddressReference = await this.zns.registry.getResolverType(resolverTypeReference);

    expect(
      await this.zns.registry.getDomainOwner(this.hash)
    ).to.equal(caller);
    expect(record.owner).to.equal(domainOwner);
    expect(record.resolver).to.equal(resolverAddressReference);

    expect(
      await this.zns.domainToken.tokenURI(this.hash)
    ).to.equal(this.tokenURI);
  }
}
