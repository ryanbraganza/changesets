// @flow

import chalk from "chalk";

import semver from "semver";

import * as cli from "../../utils/cli";
import logger from "../../utils/logger";
import getWorkspaces from "../../utils/getWorkspaces";
import { Release, Workspace } from "@changesets/types";

const { green, yellow, red, bold, blue, cyan } = chalk;

async function getPackagesToRelease(
  changedPackages: Array<string>,
  allPackages: Array<Workspace>
) {
  function askInitialReleaseQuestion(defaultChoiceList: Array<any>) {
    return cli.askCheckboxPlus(
      // TODO: Make this wording better
      // TODO: take objects and be fancy with matching
      `Which packages would you like to include?`,
      defaultChoiceList,
      x => {
        // this removes changed packages and unchanged packages from the list
        // of packages shown after selection
        if (Array.isArray(x)) {
          return x
            .filter(x => x !== "changed packages" && x !== "unchanged packages")
            .map(x => cyan(x))
            .join(", ");
        }
        return x;
      }
    );
  }

  if (allPackages.length > 1) {
    const unchangedPackagesNames = allPackages
      .map(({ name }) => name)
      .filter(name => !changedPackages.includes(name));

    const defaultChoiceList = [
      {
        name: "changed packages",
        choices: changedPackages
      },
      {
        name: "unchanged packages",
        choices: unchangedPackagesNames
      }
    ].filter(({ choices }) => choices.length !== 0);

    let packagesToRelease = await askInitialReleaseQuestion(defaultChoiceList);

    if (packagesToRelease.length === 0) {
      do {
        logger.error("You must select at least one package to release");
        logger.error("(You most likely hit enter instead of space!)");

        packagesToRelease = await askInitialReleaseQuestion(defaultChoiceList);
      } while (packagesToRelease.length === 0);
    }
    return packagesToRelease.filter(
      pkgName =>
        pkgName !== "changed packages" && pkgName !== "unchanged packages"
    );
  }
  return [allPackages[0].name];
}

function formatPkgNameAndVersion(pkgName: string, version: string) {
  return `${bold(pkgName)}@${bold(version)}`;
}

export default async function createChangeset(
  changedPackages: Array<string>,
  cwd: string
): Promise<{ summary: string; releases: Array<Release> }> {
  const allPackages = await getWorkspaces({ cwd });
  const packagesToRelease = await getPackagesToRelease(
    changedPackages,
    allPackages
  );

  let pkgJsonsByName = new Map(
    allPackages.map(({ name, config }) => [name, config])
  );

  const releases: Array<Release> = [];

  let pkgsLeftToGetBumpTypeFor = new Set(packagesToRelease);

  let pkgsThatShouldBeMajorBumped = await cli.askCheckboxPlus(
    bold(`Which packages should have a ${red("major")} bump?`),
    packagesToRelease.map(pkgName => {
      return {
        name: pkgName,
        message: formatPkgNameAndVersion(
          pkgName,
          pkgJsonsByName.get(pkgName)!.version
        )
      };
    })
  );

  for (const pkgName of pkgsThatShouldBeMajorBumped) {
    // for packages that are under v1, we want to make sure major releases are intended,
    // as some repo-wide sweeping changes have mistakenly release first majors
    // of packages.
    let { version } = pkgJsonsByName.get(pkgName)!;
    if (semver.lt(version, "1.0.0")) {
      // prettier-ignore
      logger.log(yellow(`WARNING: Releasing a major version for ${green(pkgName)} will be its ${red('first major release')}.`))
      logger.log(
        yellow(
          `If you are unsure if this is correct, contact the package's maintainers$ ${red(
            "before committing this changeset"
          )}.`
        )
      );

      let shouldReleaseFirstMajor = await cli.askConfirm(
        bold(
          `Are you sure you want still want to release the ${red(
            "first major release"
          )} of ${pkgName}?`
        )
      );
      if (!shouldReleaseFirstMajor) {
        continue;
      }
    }
    pkgsLeftToGetBumpTypeFor.delete(pkgName);

    releases.push({ name: pkgName, type: "major" });
  }

  if (pkgsLeftToGetBumpTypeFor.size !== 0) {
    let pkgsThatShouldBeMinorBumped = await cli.askCheckboxPlus(
      bold(`Which packages should have a ${green("minor")} bump?`),
      [...pkgsLeftToGetBumpTypeFor].map(pkgName => {
        return {
          name: pkgName,
          message: formatPkgNameAndVersion(
            pkgName,
            pkgJsonsByName.get(pkgName)!.version
          )
        };
      })
    );

    for (const pkgName of pkgsThatShouldBeMinorBumped) {
      pkgsLeftToGetBumpTypeFor.delete(pkgName);

      releases.push({ name: pkgName, type: "minor" });
    }
  }

  if (pkgsLeftToGetBumpTypeFor.size !== 0) {
    logger.log(`The following packages will be ${blue("patch")} bumped:`);
    pkgsLeftToGetBumpTypeFor.forEach(pkgName => {
      logger.log(
        formatPkgNameAndVersion(pkgName, pkgJsonsByName.get(pkgName)!.version)
      );
    });

    for (const pkgName of pkgsLeftToGetBumpTypeFor) {
      releases.push({ name: pkgName, type: "patch" });
    }
  }

  logger.log(
    "Please enter a summary for this change (this will be in the changelogs)"
  );

  let summary = await cli.askQuestion("Summary");
  while (summary.length === 0) {
    logger.error("A summary is required for the changelog! 😪");
    summary = await cli.askQuestion("Summary");
  }

  return {
    summary,
    releases
  };
}
