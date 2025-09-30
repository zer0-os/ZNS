import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { expect } from "chai";
import hre, { ethers } from "hardhat";
import { IZNSContracts } from "../src/deploy/campaign/types";
import {
  AC_UNAUTHORIZED_ERR,
  AC_WRONGADDRESS_ERR,
  AccessType,
  ADMIN_ROLE, DEFAULT_CURVE_PRICE_CONFIG_BYTES, DEFAULT_FIXED_PRICER_CONFIG_BYTES, DEFAULT_TOKEN_URI, deployZNS,
  distrConfigEmpty,
  encodePriceConfig,
  getProxyImplAddress,
  GOVERNOR_ROLE,
  IDistributionConfig,
  IFixedPriceConfig,
  INITIALIZED_ERR,
  ISubRegistrarConfig,
  NOT_AUTHORIZED_ERR,
  PAUSE_SAME_VALUE_ERR,
  paymentConfigEmpty,
  PaymentType,
  REGISTRATION_PAUSED_ERR,
  ZERO_ADDRESS_ERR,
  ZERO_PARENTHASH_ERR,
} from "./helpers";
import { ZNSSubRegistrar, ZNSSubRegistrar__factory } from "../typechain";
import Domain from "./helpers/domain/domain";
import { getDomainRegisteredEvents } from "./helpers/events";
import { registrationWithSetup } from "./helpers/register-setup";
import { IFullDomainConfig } from "./helpers/domain/types";


describe.only("ZNSSubRegistrar Unit Tests", () => {
  let deployer : SignerWithAddress;
  let rootOwner : SignerWithAddress;
  let specificRootOwner : SignerWithAddress;
  let specificSubOwner : SignerWithAddress;
  let admin : SignerWithAddress;
  let lvl2SubOwner : SignerWithAddress;
  let lvl3SubOwner : SignerWithAddress;
  let random : SignerWithAddress;
  let operator : SignerWithAddress;

  let zns : IZNSContracts;

  let rootPriceConfig : IFixedPriceConfig;
  let defaultDistrConfig : IDistributionConfig;
  const subTokenURI = "https://token-uri.com/8756a4b6f";

  let fixedFeePercentage : bigint;
  let fixedPrice : bigint;
  let priceConfigBytes : string;

  let domainConfigs : Array<IFullDomainConfig>;
  const registeredDomainHashes : Array<string> = [];
  const domains : Array<Domain> = [];

  before (async () => {
    [
      deployer,
      admin,
      random,
      lvl2SubOwner,
      rootOwner,
      lvl3SubOwner,
      specificRootOwner,
      specificSubOwner,
      operator,
    ] = await hre.ethers.getSigners();

    zns = await deployZNS({
      deployer,
      governorAddresses: [deployer.address],
      adminAddresses: [admin.address],
    });

    rootPriceConfig = {
      price: ethers.parseEther("1375.612"),
      feePercentage: BigInt(0),
    };

    defaultDistrConfig = {
      pricerContract: zns.fixedPricer.target,
      paymentType: PaymentType.DIRECT,
      accessType: AccessType.OPEN,
      priceConfig: encodePriceConfig(rootPriceConfig),
    };

    await Promise.all(
      [
        deployer,
        admin,
        random,
        lvl2SubOwner,
        rootOwner,
        lvl3SubOwner,
        specificRootOwner,
        specificSubOwner,
      ].map(async ({ address }) =>
        zns.meowToken.mint(address, ethers.parseEther("1000000000000000000000000")))
    );
  });

  it("Should NOT let initialize the implementation contract", async () => {
    const factory = new ZNSSubRegistrar__factory(deployer);
    const impl = await getProxyImplAddress(await zns.subRegistrar.getAddress());
    const implContract = factory.attach(impl) as ZNSSubRegistrar;

    await expect(
      implContract.initialize(
        deployer.address,
        deployer.address,
        deployer.address,
      )
    ).to.be.revertedWithCustomError(implContract, INITIALIZED_ERR);
  });

  describe("Bulk Subdomain Registration", () => {
    let defaultDomain : Domain;

    before(async () => {
      defaultDomain = new Domain({
        zns,
        domainConfig: {
          owner: rootOwner,
          label: "root1bulk",
          parentHash: ethers.ZeroHash,
          tokenOwner: rootOwner.address,
          tokenURI: DEFAULT_TOKEN_URI,
          distrConfig: defaultDistrConfig,
          paymentConfig: {
            token: await zns.meowToken.getAddress(),
            beneficiary: rootOwner.address,
          },
        },
      });

      await defaultDomain.register();
    });

    it("Should #registerSubdomainBulk and the event must be triggered", async () => {
      const registrations : Array<ISubRegistrarConfig> = [];

      for (let i = 0; i < 5; i++) {
        const isOdd = i % 2 !== 0;

        const subdomainObj : ISubRegistrarConfig = {
          parentHash: defaultDomain.hash,
          label: `subdomain${i + 1}`,
          domainAddress: admin.address,
          tokenOwner: ethers.ZeroAddress,
          tokenURI: `0://tokenURI_${i + 1}`,
          distrConfig: {
            pricerContract: await zns.curvePricer.getAddress(),
            paymentType: isOdd ? PaymentType.STAKE : PaymentType.DIRECT,
            accessType: isOdd ? AccessType.LOCKED : AccessType.OPEN,
            priceConfig: DEFAULT_CURVE_PRICE_CONFIG_BYTES,
          },
          paymentConfig: {
            token: await zns.meowToken.getAddress(),
            beneficiary: isOdd ? admin.address : lvl2SubOwner.address,
          },
        };

        registrations.push(subdomainObj);
      }

      // Add allowance
      await zns.meowToken.connect(lvl2SubOwner).approve(await zns.treasury.getAddress(), ethers.MaxUint256);

      await zns.subRegistrar.connect(lvl2SubOwner).registerSubdomainBulk(registrations);

      // get by `registrant`
      const logs = await getDomainRegisteredEvents({
        zns,
        registrant: lvl2SubOwner.address,
      });

      // eslint-disable-next-line @typescript-eslint/prefer-for-of
      for (let i = logs.length - 1; i === 0; i--) {
        const subdomain = registrations[i];

        const domainHashExpected = await zns.subRegistrar.hashWithParent(
          subdomain.parentHash,
          subdomain.label
        );

        // "DomainRegistered" event log
        const { parentHash, domainHash, label, tokenOwner, tokenURI, domainOwner, domainAddress } = logs[i].args;

        expect(parentHash).to.eq(defaultDomain.hash);
        expect(domainHashExpected).to.eq(domainHash);
        expect(label).to.eq(subdomain.label);
        expect(tokenURI).to.eq(subdomain.tokenURI);
        expect(tokenOwner).to.eq(domainOwner);
        expect(domainOwner).to.eq(lvl2SubOwner.address);
        expect(domainAddress).to.eq(subdomain.domainAddress);
      }
    });

    it("Should register multiple NESTED subdomains using #registerSubdomainBulk", async () => {
      const registrations : Array<ISubRegistrarConfig> = [];
      const parentHashes : Array<string> = [];

      // how many nested domains (0://root.sub1.sub2.sub3....)
      const domainLevels = 15;

      for (let i = 0; i < domainLevels; i++) {
        const isOdd = i % 2 !== 0;

        const subdomainObj : ISubRegistrarConfig = {
          parentHash: defaultDomain.hash,
          label: `sub${i + 1}`,
          domainAddress: lvl3SubOwner.address,
          tokenOwner: ethers.ZeroAddress,
          tokenURI: `0://tokenURI_${i + 1}`,
          distrConfig: {
            pricerContract: await zns.curvePricer.getAddress(),
            paymentType: isOdd ? PaymentType.STAKE : PaymentType.DIRECT,
            accessType: isOdd ? AccessType.LOCKED : AccessType.OPEN,
            priceConfig: DEFAULT_CURVE_PRICE_CONFIG_BYTES,
          },
          paymentConfig: {
            token: await zns.meowToken.getAddress(),
            beneficiary: isOdd ? lvl3SubOwner.address : lvl2SubOwner.address,
          },
        };

        if (i > 0) subdomainObj.parentHash = ethers.ZeroHash;

        registrations.push(subdomainObj);

        // first goes with rootHash
        parentHashes.push(
          await zns.subRegistrar.hashWithParent(
            i === 0 ? defaultDomain.hash : parentHashes[i - 1],
            subdomainObj.label
          )
        );
      }

      // Add allowance
      await zns.meowToken.connect(lvl3SubOwner).approve(await zns.treasury.getAddress(), ethers.MaxUint256);

      await zns.subRegistrar.connect(lvl3SubOwner).registerSubdomainBulk(registrations);

      const logs = await getDomainRegisteredEvents({
        zns,
        registrant: lvl3SubOwner.address,
      });

      for (let i = 0; i < domainLevels; i++) {
        const subdomain = registrations[i];

        // "DomainRegistered" event log
        const { parentHash, domainHash, label, tokenURI, tokenOwner, domainOwner, domainAddress } = logs[i].args;

        i > 0 ?
          expect(parentHash).to.eq(parentHashes[i - 1]) :
          expect(parentHash).to.eq(defaultDomain.hash);
        expect(domainHash).to.eq(parentHashes[i]);
        expect(label).to.eq(subdomain.label);
        expect(tokenURI).to.eq(subdomain.tokenURI);
        expect(domainOwner).to.eq(lvl3SubOwner.address);
        expect(tokenOwner).to.eq(lvl3SubOwner.address);
        expect(domainAddress).to.eq(subdomain.domainAddress);
      }
    });

    it("Should revert when register the same domain twice using #registerSubdomainBulk", async () => {
      const subdomainObj : ISubRegistrarConfig = {
        parentHash: defaultDomain.hash,
        label: "subdomain1",
        domainAddress: admin.address,
        tokenOwner: ethers.ZeroAddress,
        tokenURI: "0://tokenURI",
        distrConfig: {
          pricerContract: await zns.curvePricer.getAddress(),
          paymentType: PaymentType.STAKE,
          accessType: AccessType.LOCKED,
          priceConfig: DEFAULT_CURVE_PRICE_CONFIG_BYTES,
        },
        paymentConfig: {
          token: await zns.meowToken.getAddress(),
          beneficiary: admin.address,
        },
      };

      // Add allowance
      await zns.meowToken.connect(lvl2SubOwner).approve(await zns.treasury.getAddress(), ethers.MaxUint256);

      await expect(
        zns.subRegistrar.connect(lvl2SubOwner).registerSubdomainBulk([subdomainObj, subdomainObj])
      ).to.be.revertedWithCustomError(zns.rootRegistrar, "DomainAlreadyExists");
    });

    it("Should revert with 'ZeroAddressPassed' error when 1st subdomain in the array has zerohash", async () => {
      const subdomainObj : ISubRegistrarConfig = {
        parentHash: ethers.ZeroHash,
        label: "subdomainzeroaAddresspassed",
        domainAddress: admin.address,
        tokenOwner: ethers.ZeroAddress,
        tokenURI: "0://tokenURI",
        distrConfig: {
          pricerContract: await zns.curvePricer.getAddress(),
          paymentType: PaymentType.STAKE,
          accessType: AccessType.LOCKED,
          priceConfig: DEFAULT_CURVE_PRICE_CONFIG_BYTES,
        },
        paymentConfig: {
          token: await zns.meowToken.getAddress(),
          beneficiary: admin.address,
        },
      };

      // Add allowance
      await zns.meowToken.connect(lvl2SubOwner).approve(await zns.treasury.getAddress(), ethers.MaxUint256);

      await expect(
        zns.subRegistrar.connect(lvl2SubOwner).registerSubdomainBulk([subdomainObj])
      ).to.be.revertedWithCustomError(zns.subRegistrar, ZERO_PARENTHASH_ERR);
    });

    it("Should register a mix of nested and non-nested subdomains and validates hashes", async () => {
    // Structure of domains (- rootDomain; + subdomain):
    //
    // - rootHash
    //   + nested0
    //    + nested1
    //     + nested2
    //      + nested3
    // - specific0parent
    //   + non0nested0with0specific0parent0
    //   + non0nested0with0specific0parent1
    //   + non0nested0with0specific0parent2

      const subRegistrations : Array<ISubRegistrarConfig> = [];
      const expectedHashes : Array<string> = [];
      const labels = [
        "nested0",
        "nested1",
        "nested2",
        "nested3",
        "non0nested0with0specific0parent0",
        "non0nested0with0specific0parent1",
        "non0nested0with0specific0parent2",
      ];

      const specificParentHash = await registrationWithSetup({
        zns,
        user: specificRootOwner,
        domainLabel: "specific0parent",
        fullConfig: {
          distrConfig: {
            accessType: AccessType.OPEN,
            pricerContract: await zns.fixedPricer.getAddress(),
            paymentType: PaymentType.DIRECT,
            priceConfig: DEFAULT_FIXED_PRICER_CONFIG_BYTES,
          },
          paymentConfig: {
            token: await zns.meowToken.getAddress(),
            beneficiary: specificRootOwner.address,
          },
        },
      });

      for (let i = 0; i < labels.length; i++) {
        let parentHash;
        let referenceParentHash;

        if (i === 0) {
          parentHash = defaultDomain.hash;
          referenceParentHash = parentHash;
        } else if (i > 0 && i < 5) {
          parentHash = ethers.ZeroHash;
          referenceParentHash = expectedHashes[i - 1];
        } else {
          parentHash = specificParentHash;
          referenceParentHash = parentHash;
        }

        expectedHashes.push(
          await zns.subRegistrar.hashWithParent(referenceParentHash, labels[i])
        );

        subRegistrations.push({
          parentHash,
          label: labels[i],
          domainAddress: ethers.ZeroAddress,
          tokenOwner: ethers.ZeroAddress,
          tokenURI: `uri${i}`,
          distrConfig: {
            pricerContract: ethers.ZeroAddress,
            paymentType: 0n,
            accessType: 0n,
            priceConfig: hre.ethers.ZeroHash,
          },
          paymentConfig: {
            token: ethers.ZeroAddress,
            beneficiary: ethers.ZeroAddress,
          },
        });
      }

      const tx = await zns.subRegistrar.connect(specificSubOwner).registerSubdomainBulk(subRegistrations);
      await tx.wait();

      const subRegEventsLog = await getDomainRegisteredEvents({
        zns,
        registrant: specificSubOwner.address,
      });

      // check with the events
      expect(subRegEventsLog.length).to.equal(expectedHashes.length);

      for (let i = 0; i < labels.length; i++) {
        const {
          args: {
            domainHash,
            label,
            tokenURI,
            domainOwner,
            tokenOwner,
          },
        } = subRegEventsLog[i];

        expect(domainHash).to.equal(expectedHashes[i]);
        expect(label).to.equal(labels[i]);
        expect(tokenURI).to.equal(subRegistrations[i].tokenURI);
        expect(domainOwner).to.equal(specificSubOwner.address);
        expect(tokenOwner).to.equal(specificSubOwner.address);
      }

      // check with the records
      for (let i = 0; i < subRegistrations.length; i++) {
        let record;
        // check, does a record exist
        try {
          record = await zns.registry.getDomainRecord(expectedHashes[i]);
        } catch (e) {
          expect.fail(`Domain record for hash ${expectedHashes[i]} not found`);
        }

        // check the owner
        expect(record.owner).to.eq(specificSubOwner.address);
      }
    });

    it("Should revert when registering during a registration pause using #registerSubdomainBulk", async () => {
    // pause the sub registrar
      await zns.subRegistrar.connect(admin).pauseRegistration();
      expect(await zns.subRegistrar.registrationPaused()).to.be.true;

      const registrations : Array<ISubRegistrarConfig> = [
        {
          parentHash: defaultDomain.hash,
          label: "subpaused",
          domainAddress: lvl2SubOwner.address,
          tokenOwner: ethers.ZeroAddress,
          tokenURI: subTokenURI,
          distrConfig: distrConfigEmpty,
          paymentConfig: paymentConfigEmpty,
        },
      ];

      // try to register a subdomain
      await expect(
        zns.subRegistrar.connect(lvl2SubOwner).registerSubdomainBulk(registrations)
      ).to.be.revertedWithCustomError(
        zns.subRegistrar,
        REGISTRATION_PAUSED_ERR,
      );

      // unpause the sub registrar
      await zns.subRegistrar.connect(admin).unpauseRegistration();
      expect(await zns.subRegistrar.registrationPaused()).to.be.false;
    });
  });

  describe("State setters", () => {
    before (async () => {
      fixedPrice = ethers.parseEther("397");
      fixedFeePercentage = BigInt(200);
      priceConfigBytes = encodePriceConfig({ price: fixedPrice, feePercentage: fixedFeePercentage });

      domainConfigs = [
        {
          owner: rootOwner,
          tokenOwner: rootOwner.address,
          label: "root",
          distrConfig: {
            pricerContract: await zns.fixedPricer.getAddress(),
            priceConfig: encodePriceConfig({ price: fixedPrice, feePercentage: fixedFeePercentage }),
            paymentType: PaymentType.STAKE,
            accessType: AccessType.OPEN,
          },
          paymentConfig: {
            token: await zns.meowToken.getAddress(),
            beneficiary: rootOwner.address,
          },
        },
        {
          owner: lvl2SubOwner,
          tokenOwner: lvl2SubOwner.address,
          label: "leveltwo",
          tokenURI: "http://example.com/leveltwo",
          distrConfig: {
            pricerContract: await zns.fixedPricer.getAddress(),
            priceConfig: priceConfigBytes,
            paymentType: PaymentType.DIRECT,
            accessType: AccessType.OPEN,
          },
          paymentConfig: {
            token: await zns.meowToken.getAddress(),
            beneficiary: lvl2SubOwner.address,
          },
        },
        {
          owner: lvl3SubOwner,
          tokenOwner: lvl3SubOwner.address,
          label: "lvlthree",
          tokenURI: "http://example.com/lvlthree",
          distrConfig: {
            pricerContract: await zns.curvePricer.getAddress(),
            priceConfig: DEFAULT_CURVE_PRICE_CONFIG_BYTES,
            paymentType: PaymentType.DIRECT,
            accessType: AccessType.OPEN,
          },
          paymentConfig: {
            token: await zns.meowToken.getAddress(),
            beneficiary: lvl3SubOwner.address,
          },
        },
      ];

      for (const element of domainConfigs) {
        const domain = new Domain({ zns, domainConfig: element });
        await domain.register();

        registeredDomainHashes.push(domain.hash);
        domains.push(domain);
      }
    });

    describe("#setDistributionConfigForDomain()", () => {
      it("should re-set distribution config for an existing subdomain", async () => {
        const domainHash = registeredDomainHashes[2];

        const distrConfigBefore = await zns.subRegistrar.distrConfigs(domainHash);
        expect(distrConfigBefore.accessType).to.not.eq(AccessType.MINTLIST);
        expect(distrConfigBefore.pricerContract).to.not.eq(await zns.fixedPricer.getAddress());
        expect(
          distrConfigBefore.paymentType
        ).to.not.eq(
          PaymentType.STAKE
        );

        const newConfig = {
          pricerContract: await zns.fixedPricer.getAddress(),
          paymentType: PaymentType.STAKE,
          accessType: AccessType.MINTLIST,
          priceConfig: DEFAULT_FIXED_PRICER_CONFIG_BYTES,
        };

        await domains[2].setDistributionConfigForDomain(newConfig);

        const distrConfigAfter = await zns.subRegistrar.distrConfigs(domainHash);
        expect(distrConfigAfter.accessType).to.eq(newConfig.accessType);
        expect(distrConfigAfter.pricerContract).to.eq(newConfig.pricerContract);
        expect(distrConfigAfter.paymentType).to.eq(newConfig.paymentType);

        // assign operator in registry
        await zns.registry.connect(lvl3SubOwner).setOwnersOperator(
          operator.address,
          true,
        );

        // reset it back
        await zns.subRegistrar.connect(operator).setDistributionConfigForDomain(
          domainHash,
          domainConfigs[2].distrConfig,
        );
        const origConfigAfter = await zns.subRegistrar.distrConfigs(domainHash);
        expect(origConfigAfter.accessType).to.eq(domainConfigs[2].distrConfig.accessType);
        expect(origConfigAfter.pricerContract).to.eq(domainConfigs[2].distrConfig.pricerContract);
        expect(
          origConfigAfter.paymentType
        ).to.eq(
          domainConfigs[2].distrConfig.paymentType
        );

        // remove operator
        await zns.registry.connect(lvl3SubOwner).setOwnersOperator(
          operator.address,
          false,
        );
      });

      it("should NOT allow to set distribution config for a non-authorized account", async () => {
        const domainHash = registeredDomainHashes[1];

        const newConfig = {
          pricerContract: await zns.curvePricer.getAddress(),
          priceConfig: DEFAULT_CURVE_PRICE_CONFIG_BYTES,
          paymentType: PaymentType.STAKE,
          accessType: AccessType.MINTLIST,
        };

        await expect(
          zns.subRegistrar.connect(deployer).setDistributionConfigForDomain(
            domainHash,
            newConfig
          )
        ).to.be.revertedWithCustomError(
          zns.subRegistrar,
          NOT_AUTHORIZED_ERR
        );
      });

      it("should revert if pricerContract is passed as 0x0 address", async () => {
        const domainHash = registeredDomainHashes[2];

        const newConfig = {
          pricerContract: ethers.ZeroAddress,
          priceConfig: DEFAULT_FIXED_PRICER_CONFIG_BYTES,
          paymentType: PaymentType.STAKE,
          accessType: AccessType.MINTLIST,
        };

        await expect(
          zns.subRegistrar.connect(lvl3SubOwner).setDistributionConfigForDomain(
            domainHash,
            newConfig
          )
        ).to.be.revertedWithCustomError(
          zns.subRegistrar,
          ZERO_ADDRESS_ERR
        );
      });
    });

    describe("#setPricerDataForDomain()", () => {
      it("should re-set pricer contract for an existing subdomain", async () => {
        const domainHash = registeredDomainHashes[2];

        const pricerContractBefore = await zns.subRegistrar.distrConfigs(domainHash);
        expect(pricerContractBefore.pricerContract).to.eq(domainConfigs[2].distrConfig.pricerContract);

        await zns.subRegistrar.connect(lvl3SubOwner).setPricerDataForDomain(
          domainHash,
          DEFAULT_CURVE_PRICE_CONFIG_BYTES,
          await zns.curvePricer.getAddress(),
        );

        const pricerContractAfter = await zns.subRegistrar.distrConfigs(domainHash);
        expect(pricerContractAfter.pricerContract).to.eq(await zns.curvePricer.getAddress());

        // reset it back
        await zns.subRegistrar.connect(lvl3SubOwner).setPricerDataForDomain(
          domainHash,
          domainConfigs[2].distrConfig.priceConfig,
          domainConfigs[2].distrConfig.pricerContract,
        );
      });

      it("should NOT allow setting for non-authorized account", async () => {
        const domainHash = registeredDomainHashes[2];

        await expect(
          zns.subRegistrar.connect(lvl2SubOwner).setPricerDataForDomain(
            domainHash,
            DEFAULT_CURVE_PRICE_CONFIG_BYTES,
            await zns.curvePricer.getAddress()
          )
        ).to.be.revertedWithCustomError(
          zns.subRegistrar,
          NOT_AUTHORIZED_ERR
        );
      });

      it("should NOT set pricerContract to 0x0 address", async () => {
        const domainHash = registeredDomainHashes[2];

        await expect(
          zns.subRegistrar.connect(lvl3SubOwner).setPricerDataForDomain(
            domainHash,
            DEFAULT_FIXED_PRICER_CONFIG_BYTES,
            ethers.ZeroAddress
          )
        ).to.be.revertedWithCustomError(
          zns.subRegistrar,
          ZERO_ADDRESS_ERR
        );
      });
    });

    describe("#setPaymentTypeForDomain()", () => {
      it("should re-set payment type for an existing subdomain", async () => {
        const domainHash = registeredDomainHashes[2];

        const { paymentType: paymentTypeBefore } = await zns.subRegistrar.distrConfigs(domainHash);
        expect(paymentTypeBefore).to.eq(domainConfigs[2].distrConfig.paymentType);

        await zns.subRegistrar.connect(lvl3SubOwner).setPaymentTypeForDomain(
          domainHash,
          PaymentType.STAKE,
        );

        const { paymentType: paymentTypeAfter } = await zns.subRegistrar.distrConfigs(domainHash);
        expect(paymentTypeAfter).to.eq(PaymentType.STAKE);

        // reset it back
        await zns.subRegistrar.connect(lvl3SubOwner).setPaymentTypeForDomain(
          domainHash,
          domainConfigs[2].distrConfig.paymentType,
        );
      });

      it("should NOT allow setting for non-authorized account", async () => {
        const domainHash = registeredDomainHashes[2];

        await expect(
          zns.subRegistrar.connect(lvl2SubOwner).setPaymentTypeForDomain(domainHash, PaymentType.STAKE)
        ).to.be.revertedWithCustomError(
          zns.subRegistrar,
          NOT_AUTHORIZED_ERR
        );
      });

      it("should emit #PaymentTypeSet event with correct params", async () => {
        const domainHash = registeredDomainHashes[2];

        await expect(
          zns.subRegistrar.connect(lvl3SubOwner).setPaymentTypeForDomain(
            domainHash,
            PaymentType.STAKE,
          )
        ).to.emit(zns.subRegistrar, "PaymentTypeSet").withArgs(
          domainHash,
          PaymentType.STAKE,
        );

        // reset back
        await zns.subRegistrar.connect(lvl3SubOwner).setPaymentTypeForDomain(
          domainHash,
          domainConfigs[2].distrConfig.paymentType,
        );
      });
    });

    describe("#setAccessController", () => {
      it("should allow ADMIN to set a valid AccessController", async () => {
        await zns.subRegistrar.connect(deployer).setAccessController(zns.accessController.target);

        const currentAccessController = await zns.subRegistrar.getAccessController();

        expect(currentAccessController).to.equal(zns.accessController.target);
      });

      it("should allow re-setting the AccessController to another valid contract", async () => {
        expect(
          await zns.subRegistrar.getAccessController()
        ).to.equal(
          zns.accessController.target
        );

        const ZNSAccessControllerFactory = await ethers.getContractFactory("ZNSAccessController", deployer);
        const newAccessController = await ZNSAccessControllerFactory.deploy(
          [deployer.address],
          [deployer.address]
        );

        // then change the AccessController
        await zns.subRegistrar.connect(deployer).setAccessController(newAccessController.target);

        expect(
          await zns.subRegistrar.getAccessController()
        ).to.equal(
          newAccessController.target
        );
      });

      it("should emit AccessControllerSet event when setting a valid AccessController", async () => {
        await expect(
          zns.subRegistrar.connect(deployer).setAccessController(zns.accessController.target)
        ).to.emit(
          zns.subRegistrar,
          "AccessControllerSet"
        ).withArgs(zns.accessController.target);
      });

      it("should revert when a non-ADMIN tries to set AccessController", async () => {
        await expect(
          zns.subRegistrar.connect(lvl2SubOwner).setAccessController(zns.accessController.target)
        ).to.be.revertedWithCustomError(
          zns.subRegistrar,
          AC_UNAUTHORIZED_ERR
        ).withArgs(lvl2SubOwner.address, GOVERNOR_ROLE);
      });

      it("should revert when setting an AccessController as EOA address", async () => {
        await expect(
          zns.subRegistrar.connect(deployer).setAccessController(lvl2SubOwner.address)
        ).to.be.revertedWithCustomError(
          zns.subRegistrar,
          AC_WRONGADDRESS_ERR
        ).withArgs(lvl2SubOwner.address);
      });

      it("should revert when setting an AccessController as another non-AC contract address", async () => {
        await expect(
          zns.subRegistrar.connect(deployer).setAccessController(zns.subRegistrar.target)
        ).to.be.revertedWithCustomError(
          zns.subRegistrar,
          AC_WRONGADDRESS_ERR
        ).withArgs(zns.subRegistrar.target);
      });

      it("should revert when setting a zero address as AccessController", async () => {
      // deployer is the governor
        await expect(
          zns.subRegistrar.connect(deployer).setAccessController(ethers.ZeroAddress)
        ).to.be.revertedWithCustomError(
          zns.subRegistrar,
          AC_WRONGADDRESS_ERR
        ).withArgs(ethers.ZeroAddress);
      });
    });

    describe("#setRootRegistrar()", () => {
      it("should set the new root registrar correctly and emit #RootRegistrarSet event", async () => {
        const tx = await zns.subRegistrar.connect(admin).setRootRegistrar(random.address);

        await expect(tx).to.emit(zns.subRegistrar, "RootRegistrarSet").withArgs(random.address);

        expect(await zns.subRegistrar.rootRegistrar()).to.equal(random.address);
      });

      it("should NOT be callable by anyone other than ADMIN_ROLE", async () => {
        await expect(zns.subRegistrar.connect(random).setRootRegistrar(random.address))
          .to.be.revertedWithCustomError(zns.accessController, AC_UNAUTHORIZED_ERR)
          .withArgs(random.address, ADMIN_ROLE);
      });

      it("should NOT set registrar as 0x0 address", async () => {
        await expect(
          zns.subRegistrar.connect(admin).setRootRegistrar(ethers.ZeroAddress)
        ).to.be.revertedWithCustomError(
          zns.subRegistrar,
          ZERO_ADDRESS_ERR
        );
      });
    });

    describe("#setRegistry()", () => {
      it("should set the new registry correctly and emit #RegistrySet event", async () => {
        const tx = await zns.subRegistrar.connect(admin).setRegistry(random.address);

        await expect(tx).to.emit(zns.subRegistrar, "RegistrySet").withArgs(random.address);

        expect(await zns.subRegistrar.registry()).to.equal(random.address);
      });

      it("should not be callable by anyone other than ADMIN_ROLE", async () => {
        await expect(zns.subRegistrar.connect(random).setRegistry(random.address))
          .to.be.revertedWithCustomError(zns.accessController, AC_UNAUTHORIZED_ERR)
          .withArgs(random.address, ADMIN_ROLE);
      });
    });

    describe("#pauseRegistration()", () => {
      it("should pause the registration process and emit #RegistrationPauseSet event", async () => {
        const tx = await zns.subRegistrar.connect(admin).pauseRegistration();

        await expect(tx).to.emit(zns.subRegistrar, "RegistrationPauseSet").withArgs(true);

        expect(await zns.subRegistrar.registrationPaused()).to.equal(true);
      });

      it("should not be callable by anyone other than ADMIN_ROLE", async () => {
        await expect(zns.subRegistrar.connect(random).pauseRegistration())
          .to.be.revertedWithCustomError(zns.accessController, AC_UNAUTHORIZED_ERR)
          .withArgs(random.address, ADMIN_ROLE);
      });

      it("should not allow to pause if already paused", async () => {
        await expect(zns.subRegistrar.connect(admin).pauseRegistration())
          .to.be.revertedWithCustomError(zns.subRegistrar, PAUSE_SAME_VALUE_ERR);
      });
    });

    describe("#unpauseRegistration()", () => {
      it("should unpause the registration process and emit #RegistrationPauseSet event", async () => {
        const tx = await zns.subRegistrar.connect(admin).unpauseRegistration();

        await expect(tx).to.emit(zns.subRegistrar, "RegistrationPauseSet").withArgs(false);

        expect(await zns.subRegistrar.registrationPaused()).to.equal(false);
      });

      it("should not be callable by anyone other than ADMIN_ROLE", async () => {
        await expect(zns.subRegistrar.connect(random).unpauseRegistration())
          .to.be.revertedWithCustomError(zns.accessController, AC_UNAUTHORIZED_ERR)
          .withArgs(random.address, ADMIN_ROLE);
      });

      it("should not allow to unpause if already unpaused", async () => {
        await expect(zns.subRegistrar.connect(admin).unpauseRegistration())
          .to.be.revertedWithCustomError(zns.subRegistrar, PAUSE_SAME_VALUE_ERR);
      });
    });
  });
});