import { copyFile, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const packageRoot = join(projectRoot, "node_modules", "stockfish");
const outputRoot = join(projectRoot, "public", "stockfish");
const expectedPackageVersion = "18.0.8";
const packageMetadata = JSON.parse(
  await readFile(join(packageRoot, "package.json"), "utf8"),
);

if (packageMetadata.version !== expectedPackageVersion) {
  throw new Error(
    `Expected stockfish ${expectedPackageVersion}, found ${packageMetadata.version}. Update the versioned asset URL and provenance before building.`,
  );
}

const outputDirectory = join(outputRoot, expectedPackageVersion);

const files = [
  "bin/stockfish-18-lite-single.js",
  "bin/stockfish-18-lite-single.wasm",
  "Copying.txt",
];

await rm(outputRoot, { recursive: true, force: true });
await mkdir(outputDirectory, { recursive: true });

for (const file of files) {
  await copyFile(
    join(packageRoot, file),
    join(outputDirectory, file.split("/").at(-1)),
  );
}

await writeFile(
  join(outputDirectory, "SOURCE.txt"),
  `Stockfish browser engine distribution\n\n` +
    `npm package: stockfish@18.0.8\n` +
    `npm package archive:\n` +
    `https://registry.npmjs.org/stockfish/-/stockfish-18.0.8.tgz\n` +
    `npm package integrity (sha512, package-lock.json):\n` +
    `z+f2UMPXLylDBGjv9e9zU8QulY7hUl8MYHesLRrdddewlOXjJrUSmtNmbtID1/F72EPhq0CCkCNxgWS5MQVWtQ==\n\n` +
    `Engine: Stockfish.js 18, lite single-threaded WebAssembly build\n` +
    `Stockfish.js release: v18.0.0\n` +
    `Upstream Stockfish release: Stockfish 18\n` +
    `The distributed engine files are copied unchanged from the npm package.\n\n` +
    `Licence: GNU GPL version 3 (see Copying.txt in this directory)\n\n` +
    `Stockfish.js corresponding source (immutable release archive):\n` +
    `https://github.com/nmrugg/stockfish.js/archive/refs/tags/v18.0.0.tar.gz\n` +
    `Stockfish corresponding source (immutable release archive):\n` +
    `https://github.com/official-stockfish/Stockfish/archive/refs/tags/sf_18.tar.gz\n`,
);
