# zNS Access Roles and Their Privileges

## `GOVERNOR_ROLE` privileges:
- The UUPS function `upgradeToAndCall()` allows governors to update the implementation used and invoke a call in upgradeable
contracts. 
- The UUPS function `upgradeTo()` allows governors to update the implementation used in upgradeable contracts. 
- The governors can grant `GOVERNOR_ROLE` to addresses. 
- The governors can grant `ADMIN_ROLE` to addresses. 
- The governors can grant any role to any address through the function `ZNSAccessController.setRoleAdmin()` .

## `ADMIN_ROLE` privileges:
- The function `setRegistry()` allows admins to update the registry address for contracts inheriting `ARegistryWired`:
  - `ZNSCurvePricer` 
  - `ZNSRootRegistrar` 
  - `ZNSSubRegistrar` 
  - `ZNSAddressResolver` 
  - `ZNSDomainToken` 
  - `ZNSTreasury`
- The function `ZNSRootRegistrar.setRootPricerAndConfig()` allows admins to set the root pricer and validate/store the root price configuration for root domains.
- The function `ZNSRootRegistrar.setRootPriceConfig()` allows admins to update the price configuration for the currently set root pricer.
- The function `ZNSRootRegistrar.setTreasury()` allows admins to update the `ZNSTreasury` contract used to store protocol fees
and staked funds.
- The function `ZNSRootRegistrar.setDomainToken()` allows admins to update the domain token contract used to validate domain
ownership.
- The function `ZNSRootRegistrar.setSubRegistrar()` allows admins to update the subdomain registrar contract.
- The functions `ZNSRegistry.addResolverType()` and `ZNSRegistry.deleteResolverType()` allow admins to manage resolver implementations mapped by resolver type strings (e.g., "address"). Root resolvers are not set on `ZNSRootRegistrar`; resolver selection is performed via the `ZNSRegistry` resolver type mapping.
- The function `ZNSRootRegistrar.setRootPaymentType()` allows admins to set the root payment modality (`DIRECT` or `STAKE`) used by `registerRootDomain()`.
- The admins can grant `REGISTRAR_ROLE` to addresses.

## `REGISTRAR_ROLE` privileges:
- The function `ZNSRootRegistrar.coreRegister()` allows registrars to register domains.
- The function `ZNSRegistry.createDomainRecord()` allows registrars to register domain records which track ownership and address
resolver. 
- The function `ZNSDomainToken.register()` allows registrars to mint tokens which are used to validate domain ownership. 
- The function `ZNSDomainToken.revoke()` allows registrars to burn tokens to revoke domain ownership. 
- The function `ZNSTreasury.stakeForDomain()` allows registrars to process registration fee to beneficiaries and stake domain funds
in the treasury. The staked funds are returned to the domain owner when the domain is revoked. 
- The function `ZNSTreasury.unstakeForDomain()` allows registrars to unstake domain registration funds in the treasury during the
domain revocation process. 
- The function `ZNSTreasury.processDirectPayment()` allows registrars to process registration fees to beneficiaries directly.
>The `REGISTRAR_ROLE` is reserved for contracts ZNSRootRegistrar and ZNSSubRegistrar only.

## `DOMAIN_TOKEN_ROLE` privileges:
- The function `ZNSRegistry.updateDomainOwner` allows the domain token to update the domain owner in the registry upon Domain Token transfer to fully transfer all right to the domain by transferring the token.

>`EXECUTOR_ROLE` does not have any privileges. This role may be used for future implementations and additions.
