
if (process.argv.length < 3) {
    console.error("Missing filename");
    process.exit(1);
}


const fs = require("fs");

const fileName = process.argv[2];
const tsv = fs.readFileSync(fileName, "utf-8");
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
