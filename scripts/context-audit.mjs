import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const repoRoot = process.cwd();
const instructionFile = "AGENTS.md";
const hardLimits = {
    instructionsChars: 3000,
    sourceLines: 800,
    testLines: 500
};
const reportLimits = {
    docsChars: 3000
};
const artifactPrefixes = [
    "apps/channel-web/dist/",
    "coverage/",
    "playwright-report/",
    "test-results/",
    ".vercel/"
];
const secondarySurfacePrefixes = [
    "apps/king-angel-mini/",
    "prototypes/",
    "docs/ai-handover/",
    "supabase/.temp/",
    "apps/channel-web/e2e/"
];

const readText = (relativePath) => fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
const countLines = (text) => text.split(/\r?\n/).length;
const toPosix = (filePath) => filePath.split(path.sep).join("/");

const listTrackedFiles = () => {
    const output = execFileSync("rg", ["--files", "."], {
        cwd: repoRoot,
        encoding: "utf8"
    });

    return output
        .split(/\r?\n/)
        .map((entry) => entry.trim())
        .filter(Boolean)
        .map((entry) => entry.replace(/^\.\//, ""));
};

const formatIssues = (items, formatter) => {
    if (!items.length) {
        return ["  - none"];
    }

    return items.map((item) => `  - ${formatter(item)}`);
};

const fileList = listTrackedFiles();
const instructionText = readText(instructionFile);
const instructionStats = {
    lines: countLines(instructionText),
    chars: instructionText.length
};

const oversizedSourceFiles = fileList
    .filter((file) => file.startsWith("apps/channel-web/src/") && file.endsWith(".js") && !file.includes("/test/"))
    .map((file) => ({
        file,
        lines: countLines(readText(file))
    }))
    .filter((entry) => entry.lines > hardLimits.sourceLines)
    .sort((a, b) => b.lines - a.lines);

const oversizedTestFiles = fileList
    .filter((file) => file.startsWith("apps/channel-web/src/test/") && file.endsWith(".js"))
    .map((file) => ({
        file,
        lines: countLines(readText(file))
    }))
    .filter((entry) => entry.lines > hardLimits.testLines)
    .sort((a, b) => b.lines - a.lines);

const oversizedDocs = fileList
    .filter((file) => file.startsWith("docs/") && file.endsWith(".md"))
    .map((file) => ({
        file,
        chars: readText(file).length
    }))
    .filter((entry) => entry.chars > reportLimits.docsChars)
    .sort((a, b) => b.chars - a.chars);

const visibleArtifacts = fileList
    .filter((file) => artifactPrefixes.some((prefix) => file.startsWith(prefix)))
    .sort();

const visibleSecondarySurfaces = fileList
    .filter((file) => secondarySurfacePrefixes.some((prefix) => file.startsWith(prefix)))
    .sort();

const hardFailures = [];

if (instructionStats.chars > hardLimits.instructionsChars) {
    hardFailures.push(`AGENTS.md exceeds ${hardLimits.instructionsChars} chars`);
}
if (oversizedSourceFiles.length) {
    hardFailures.push(`source files exceed ${hardLimits.sourceLines} LOC`);
}
if (oversizedTestFiles.length) {
    hardFailures.push(`test files exceed ${hardLimits.testLines} LOC`);
}
if (visibleArtifacts.length) {
    hardFailures.push("generated artifacts still appear in default rg search");
}
if (visibleSecondarySurfaces.length) {
    hardFailures.push("secondary app / prototype surfaces still appear in default rg search");
}

console.log("Context audit");
console.log("");
console.log(`AGENTS.md: ${instructionStats.lines} lines, ${instructionStats.chars} chars`);
console.log(...formatIssues(
    instructionStats.chars > hardLimits.instructionsChars
        ? [{ file: instructionFile, chars: instructionStats.chars }]
        : [],
    (item) => `${item.file}: ${item.chars} chars`
));
console.log("");
console.log(`Oversized source files (> ${hardLimits.sourceLines} LOC):`);
console.log(...formatIssues(oversizedSourceFiles, (item) => `${item.file}: ${item.lines} lines`));
console.log("");
console.log(`Oversized test files (> ${hardLimits.testLines} LOC):`);
console.log(...formatIssues(oversizedTestFiles, (item) => `${item.file}: ${item.lines} lines`));
console.log("");
console.log(`Oversized docs (> ${reportLimits.docsChars} chars, warning only):`);
console.log(...formatIssues(oversizedDocs, (item) => `${item.file}: ${item.chars} chars`));
console.log("");
console.log("Generated artifacts visible to default rg:");
console.log(...formatIssues(visibleArtifacts, (item) => item));
console.log("");
console.log("Secondary surfaces visible to default rg:");
console.log(...formatIssues(visibleSecondarySurfaces, (item) => item));

if (hardFailures.length) {
    console.error("");
    console.error("Audit failed:");
    hardFailures.forEach((failure) => {
        console.error(`- ${failure}`);
    });
    process.exit(1);
}
