import chalk from "chalk";
import table from "tty-table";
import fs from "fs-extra";
import path from "path";
import getReleasePlan from "@changesets/get-release-plan";
import {
  VersionType,
  Release,
  ComprehensiveRelease,
  Config
} from "@changesets/types";
import logger from "../../utils/logger";

export default async function getStatus(
  cwd: string,
  {
    sinceMaster,
    verbose,
    output
  }: { sinceMaster?: boolean; verbose?: boolean; output?: string },
  config: Config
) {
  // TODO: Check if we are no master and give a different error message if we are
  const releasePlan = await getReleasePlan(cwd, sinceMaster, config);

  const { changesets, releases } = releasePlan;

  if (changesets.length < 1) {
    logger.error("No changesets present");
    process.exit(1);
  }

  if (output) {
    await fs.writeFile(
      path.join(cwd, output),
      JSON.stringify(releasePlan, undefined, 2)
    );
    return;
  }

  const print = verbose ? verbosePrint : SimplePrint;
  print("patch", releases);
  logger.log("---");
  print("minor", releases);
  logger.log("---");
  print("major", releases);

  return releasePlan;
}

function SimplePrint(type: VersionType, releases: Array<Release>) {
  const packages = releases.filter(r => r.type === type);
  if (packages.length) {
    logger.info(chalk`Packages to be bumped at {green ${type}}:\n`);

    const pkgs = packages.map(({ name }) => `- ${name}`).join("\n");
    logger.log(chalk.green(pkgs));
  } else {
    logger.info(chalk`{red NO} packages to be bumped at {green ${type}}`);
  }
}

function verbosePrint(
  type: VersionType,
  releases: Array<ComprehensiveRelease>
) {
  const packages = releases.filter(r => r.type === type);
  if (packages.length) {
    logger.info(chalk`Packages to be bumped at {green ${type}}`);

    const columns = packages.map(
      ({ name, newVersion: version, changesets }) => [
        chalk.green(name),
        version,
        changesets
          .map(c => chalk.blue(` .changeset/${c}/changes.md`))
          .join(" +")
      ]
    );

    const t1 = table(
      [
        { value: "Package Name", width: 20 },
        { value: "New Version", width: 20 },
        { value: "Related Changeset Summaries", width: 70 }
      ],
      columns,
      { paddingLeft: 1, paddingRight: 0, headerAlign: "center", align: "left" }
    );
    logger.log(t1.render() + "\n");
  } else {
    logger.info(
      chalk`Running release would release {red NO} packages as a {green ${type}}`
    );
  }
}
