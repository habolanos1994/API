const fs = require("fs");
const path = require("path");

const countersFile = path.join(__dirname, "counters.json");
let counters = {};

// Read the counters from the JSON file if it exists and is valid JSON
if (fs.existsSync(countersFile)) {
  try {
    const data = fs.readFileSync(countersFile);
    counters = JSON.parse(data);
    if (typeof counters !== "object") {
      counters = {};
    }
  } catch (err) {
    console.error(`Error reading counters from file: ${err.message}`);
  }
}

function counter(name, count) {
  // Define the regular expression for the valid format


  // Ignore values that do not match the valid format
  if (count === null || count === '' ) {
    return;
  }

  if (!counters[name]) {
    counters[name] = {};
  }

  if (!counters[name][count]) {
    counters[name][count] = 0;
  }

  counters[name][count]++;
  fs.writeFileSync(countersFile, JSON.stringify(counters));
}

module.exports = { counter };
