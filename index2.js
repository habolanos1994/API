const { Controller } = require("st-ethernet-ip");
const fs = require("fs");
const path = require("path");
const schedule = require('node-schedule');
const encoder = new TextDecoder();
const { saveToMongoDB } = require("./mongo")
let plcIpAddress = "10.63.192.32";
const { sendsmtp } = require("./smtp")

let PLC = new Controller({ timeout: 5000 });

let tagConfigsFile = path.join(__dirname, "tagConfigs2.json");
let tagConfigs = JSON.parse(fs.readFileSync(tagConfigsFile));

// Create an array of tags
let tags = tagConfigs.map((config) => PLC.newTag(config.name));

// Create an object to store the count for each tag group
const groupCounters = {};

let reconnectAttempts = 0;
const maxReconnectDelay = 120000; // 120 seconds

let reconnectJob;

function reconnectAfterDelay() {
  let delay = Math.min(60000 * (reconnectAttempts + 1), maxReconnectDelay); 
  console.log(`Attempting to reconnect in ${delay / 1000} seconds...`);
  setTimeout(() => {
    reconnectAttempts++;
    if (reconnectAttempts > 10) {
      process.exit(1);
    }
    connectToPLC();
    reconnectAttempts = 0;
  }, delay);
}

function getTotalUnits() {
  try {
    const totalUnits = JSON.parse(fs.readFileSync("TotalUnits.json"));
    return { ...totalUnits};
  } catch (err) {
    console.error("Error reading TotalUnits.json:", err);
    return null;
  }
}

PLC.on('Disconnected', () => {
  sendsmtp(`MongoDB service plc Report Plc disconnected`)
  console.log('Disconnected from PLC.');
  reconnectAfterDelay(); 
});

PLC.on('Error', (err) => {
  sendsmtp(`MongoDB service plc Report Plc Error: ${err}`)
  console.log('Error encountered:', err);
  reconnectAfterDelay();
});

async function readTagsAndUpdateValues() {
  let values = {};
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

    if (!values[publishGroup]) {
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
      if (error.message.includes("TIMEOUT")) {
        sendsmtp(`MongoDB service plc Report Plc Error: ${error}`)
        console.error(`Error reading tag '${config.name}': ${error.message}`);
        reconnectAfterDelay();
        return; // stop execution if a TIMEOUT error occurs
      } else {
        console.error(`Error reading tag '${config.name}': ${error.message}`);
      }
    }
  }

  if (Object.keys(values).length === 0) {
    console.log('No tags were read. Attempting to reconnect...');
    reconnectAttempts++;
    reconnectAfterDelay();
    return;
  }

  //console.log(values)

  // Log values separately for each key
  Object.keys(values).forEach((key) => {
    if (key == 'Mark012') {
      const totalUnits = getTotalUnits();
      //const productionCounters = addProductionCounters();
      const data = {
        OEE_Data: values[key],
        Production: {
          ...totalUnits,
        },

      };
      //console.log(data)
      saveToMongoDB(`${key}`, data)
    } else {
      const data = {
        OEE_Data: values[key],
      };
      //console.log(`${key}:`, values[key]);
      saveToMongoDB(`${key}`, data)
    }

  });
  

  // Reset the values object for the next iteration
  values = {};

  // Schedule the next cycle after a 1-second delay
  setTimeout(readTagsAndUpdateValues, 1000);
}

async function connectToPLC() {
  PLC.connect(plcIpAddress, 0)
    .then(async () => {
      console.log("Connected to PLC");

      // Read tags initially
      await readTagsAndUpdateValues(); 
      reconnectAttempts = 0; // Reset attempts after a successful connection
      // Clear any existing schedule before creating a new one
      if (reconnectJob) {
        reconnectJob.cancel();
      }
      // Schedule readTagsAndUpdateValues to run every 10 seconds and at 0,15 minutes past every hour
      reconnectJob = schedule.scheduleJob("*/10 * * * * *", readTagsAndUpdateValues);
      reconnectJob = schedule.scheduleJob("0,15 * * * *", readTagsAndUpdateValues);

    })
    .catch(error => {
      sendsmtp(`Mongo service plc Report Plc Error: ${error}`)
      console.error(`Failed to connect to PLC: ${error}`);
      reconnectAfterDelay();
    });
}


connectToPLC();

  
process.on('uncaughtException', (err) => {
  console.log('Uncaught exception:', err);
  reconnectAfterDelay();
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.log('Unhandled rejection at:', promise, 'reason:', reason);
  reconnectAfterDelay();
  process.exit(1);
});

sendsmtp(`MongoDB service plc Start, Display name: Bastian MongoDB server`)
