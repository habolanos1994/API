const { Controller } = require("st-ethernet-ip");
const fs = require("fs");
const path = require("path");
const encoder = new TextDecoder();
const { mqttpub } = require("./mqttpublish")

let values = {};

let PLC = new Controller({ timeout: 5000 });

let tagConfigsFile = path.join(__dirname, "tagConfigs2.json");
let tagConfigs = JSON.parse(fs.readFileSync(tagConfigsFile));

// Create an array of tags
let tags = tagConfigs.map((config) => PLC.newTag(config.name));

// Create an object to store the count for each tag group
const groupCounters = {};



async function readTagsAndUpdateValues() {
  Object.keys(groupCounters).forEach(group => {
    groupCounters[group] = 1;
  });

  const tagGroupUniqueAliases = {};

  for (let i = 0; i < tags.length; i++) {
    const tag = tags[i];
    const config = tagConfigs[i];
    const publishGroup = config.PublishGroup;
    const tagConvertion = config.tagConvertion;
    var tagvalue;

    if (!values.hasOwnProperty(publishGroup)) {
      values[publishGroup] = {};
    }

    try {
      // Read tag
      await PLC.readTag(tag);

      if (tagConvertion == 'Buffer') {
        const arr = new Uint8Array(tag.value);
        const slicedArr = arr.slice(1); // Slice the array starting from the second byte
        const filteredArr = slicedArr.filter(byte => byte !== 0); // Remove all null bytes (0x00)
        const srt = encoder.decode(filteredArr);
        tagvalue = srt;

      } else {
        tagvalue = tag.value;
      }

      // Store values
      const tagGroupName = config.taggroup;
      if (tagGroupName !== "") {
        // Initialize the counter for the tag group if it doesn't exist
        if (!groupCounters.hasOwnProperty(tagGroupName)) {
          groupCounters[tagGroupName] = 1;
        }

        if (!values[publishGroup].hasOwnProperty(tagGroupName)) {
          values[publishGroup][tagGroupName] = {};
        }

        // Initialize the Set for unique aliases within the tag group and publish group combination if it doesn't exist
        if (!tagGroupUniqueAliases.hasOwnProperty(publishGroup)) {
          tagGroupUniqueAliases[publishGroup] = {};
        }
        if (!tagGroupUniqueAliases[publishGroup].hasOwnProperty(tagGroupName)) {
          tagGroupUniqueAliases[publishGroup][tagGroupName] = new Set();
        }

        let aliasKey = config.alias;
        // If the alias is repeated within the tag group and publish group combination, add the counter to the alias
        if (tagGroupUniqueAliases[publishGroup][tagGroupName].has(aliasKey)) {
          aliasKey += groupCounters[tagGroupName];
        }

        // Store the tag value with the appropriate aliasKey
        values[publishGroup][tagGroupName][aliasKey] = tagvalue;

        // Add the original alias to the Set of unique aliases for the tag group and publish group combination
        tagGroupUniqueAliases[publishGroup][tagGroupName].add(config.alias);

        // Increment the counter for the tag group
        groupCounters[tagGroupName]++;
      } else {
        values[publishGroup][config.alias] = tagvalue;
      }
    } catch (error) {
      console.error(`Error reading tag '${config.name}': ${error.message}`);
    }
  }

  // Log values separately for each key
  Object.keys(values).forEach((key) => {

    if (key == 'Mark012') {
      const productionCounters = addProductionCounters(values[key]);
      //const data = {...values[key], ...productionCounters};
      const data = {
        OEE_Data: values[key],
        production: productionCounters,
      };
      mqttpub(`ELP/Returns/Bastian/${key}/DDATA`, data);
    } else {
      const data = {
        OEE_Data: values[key],
      };
    //console.log(`${key}:`, values[key]);
    mqttpub(`ELP/Returns/Bastian/${key}/DDATA`, data)
    }

  });

  // Reset the values object for the next iteration
  values = {};

  // Schedule the next cycle after a 1-second delay
  setTimeout(readTagsAndUpdateValues, 1000);
}




const plcIpAddress = "10.63.192.32";
PLC.connect(plcIpAddress, 0)
  .then(async () => {
    console.log("Connected to PLC");

    // Start reading tags
    await readTagsAndUpdateValues(); // Read tags initially
  })
  .catch((error) => console.error(error));


  function addProductionCounters(data) {
    try {
      const counters = JSON.parse(fs.readFileSync("counters.json"));
      return { ...counters };
    } catch (err) {
      console.error("Error reading counters.json:", err);
      const empty = []
      return {empty};
    }
  }
  