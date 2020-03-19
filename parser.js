
const fs = require("fs");

const tsv = fs.readFileSync("photo-finish-snapshot-20200204-1822.tsv", "utf-8");
const lines = tsv.split("\n").slice(1);
const output = [];
for (const line of lines) {
    const cols = line.split("\t");
    if (cols[1] === "6") {
        const z = parseFloat(cols[5]);
        const x = -parseFloat(cols[3]);
        output.push(`${z}\t${x}`);
    }
}
fs.writeFileSync("scenario.tsv", output.join("\n"));
