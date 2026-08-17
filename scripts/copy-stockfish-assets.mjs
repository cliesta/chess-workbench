import { copyFile, mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const packageRoot = join(projectRoot, "node_modules", "stockfish");
const outputDirectory = join(projectRoot, "public", "stockfish");

const files = [
  "bin/stockfish-18-lite-single.js",
  "bin/stockfish-18-lite-single.wasm",
  "Copying.txt",
];

await mkdir(outputDirectory, { recursive: true });

for (const file of files) {
  await copyFile(
    join(packageRoot, file),
    join(outputDirectory, file.split("/").at(-1)),
  );
}

await writeFile(
  join(outputDirectory, "SOURCE.txt"),
  `Stockfish.js 18.0.8 / Stockfish 18\n\n` +
    `Licence: GNU GPL version 3 (see Copying.txt)\n` +
    `Stockfish.js corresponding source:\n` +
    `https://github.com/nmrugg/stockfish.js/archive/refs/tags/v18.0.0.tar.gz\n` +
    `Stockfish corresponding source:\n` +
    `https://github.com/official-stockfish/Stockfish/archive/refs/tags/sf_18.tar.gz\n`,
);
