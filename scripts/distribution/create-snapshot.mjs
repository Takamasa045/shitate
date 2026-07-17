#!/usr/bin/env node
import path from "node:path";
import process from "node:process";

import { createDistributionSnapshot } from "./lib.mjs";

const destinationArg = process.argv.slice(2).find((argument) => argument !== "--");
if (!destinationArg) {
  console.error("Usage: pnpm distribution:create -- <new-destination-directory>");
  process.exitCode = 2;
} else {
  try {
    const result = await createDistributionSnapshot(
      process.cwd(),
      path.resolve(destinationArg),
      { allowedCharacterIds: ["washi-fox"] },
    );
    console.log(`distribution snapshot created: ${result.destination}`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
