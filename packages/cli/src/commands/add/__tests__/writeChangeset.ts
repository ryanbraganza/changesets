import { copyFixtureIntoTempDir } from "jest-fixtures";

import fs from "fs-extra";
import path from "path";
import parse from "@changesets/parse";
import { Release } from "@changesets/types";
import writeChangeset from "../writeChangeset";

import humanId from "human-id";

jest.mock("human-id");

const simpleChangeset: { summary: string; releases: Release[] } = {
  summary: "This is a summary",
  releases: [{ name: "pkg-a", type: "minor" }]
};

describe("simple project", () => {
  let cwd: string;

  beforeEach(async () => {
    cwd = await copyFixtureIntoTempDir(__dirname, "simple-project");
  });

  afterEach(() => {
    jest.clearAllMocks();
  });
  it("should write a changeset", async () => {
    const changesetID = "ascii";
    // @ts-ignore
    humanId.mockReturnValueOnce(changesetID);

    await writeChangeset(simpleChangeset, cwd);

    const mdPath = path.join(cwd, ".changeset", `${changesetID}.md`);

    const mdContent = await fs.readFile(mdPath, "utf-8");

    expect(parse(mdContent)).toEqual(simpleChangeset);
  });
});
