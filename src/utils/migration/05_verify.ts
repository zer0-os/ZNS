import * as hre from "hardhat";
import { ROOT_COLL_NAME, SUB_COLL_NAME } from "./constants";
import { getZNS } from "./zns-contract-data";
import { connectToDb } from "./helpers";
import { getZnsLogger } from "../../deploy/get-logger";
import { Domain } from "./types";

import * as fs from "fs";

const logger = getZnsLogger();

const verify = async () => {
  const [ migrationAdmin ] = await hre.ethers.getSigners();
  
  const zns = await getZNS(migrationAdmin);

    const client = await connectToDb();
  

  const rootDomains = await client.collection(ROOT_COLL_NAME).find().toArray() as unknown as Array<Domain>;
  const subdomains = await client.collection(
    SUB_COLL_NAME
  ).find().sort({ depth: 1, _id: 1 }).toArray() as unknown as Array<Domain>;

  const incorrectDomains : Array<Domain> = [];

  for (const [i,d] of [...rootDomains, ...subdomains].entries()) {
    const owner = await zns.registry.getDomainOwner(d.id);

    if (!d.isRevoked && d.owner.id !== owner) {
      incorrectDomains.push(d);

      logger.debug(`
        Incorrect owner for domain: ${d.id}
        Found: ${owner}
        Expected: ${d.owner.id}
      `);
    }

    if (i % 50 === 0) {
      logger.info(`Processed ${i} domains...`)
    }
  }

  if (incorrectDomains.length > 0) {
    logger.error(`Found ${incorrectDomains.length} non-revokd domains with incorrect owners`);
    fs.writeFileSync("incorrect_domains.json", JSON.stringify(incorrectDomains, undefined, 2));
  }
}

verify().catch(error => {
  getZnsLogger().error("Migration script failed:", error);
  process.exitCode = 1;
}).finally(() => {
  process.exit(0);
});