import {
  NewChangesetWithCommit,
  VersionType,
  ChangelogFunctions,
  ModCompWithWorkspace
} from "@changesets/types";

const getReleaseLine = async (
  changeset: NewChangesetWithCommit,
  _type: VersionType
) => {
  const [firstLine, ...futureLines] = changeset.summary
    .split("\n")
    .map(l => l.trimRight());

  let returnVal = `- ${
    changeset.commit ? `${changeset.commit}: ` : ""
  }${firstLine}\n${futureLines.map(l => `  ${l}`).join("\n")}`;

  return returnVal;
};

const getDependencyReleaseLine = async (
  changesets: NewChangesetWithCommit[],
  dependenciesUpdated: ModCompWithWorkspace[]
) => {
  if (dependenciesUpdated.length === 0) return "";

  const changesetLinks = changesets.map(
    changeset => `- Updated dependencies [${changeset.commit}]`
  );

  const updatedDepenenciesList = dependenciesUpdated.map(
    dependency => `  - ${dependency.name}@${dependency.newVersion}`
  );

  return [...changesetLinks, ...updatedDepenenciesList].join("\n");
};

const defaultChangelogFunctions: ChangelogFunctions = {
  getReleaseLine,
  getDependencyReleaseLine
};

export default defaultChangelogFunctions;
