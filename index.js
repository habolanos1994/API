const { Controller } = require("st-ethernet-ip");
const fs = require("fs");
const path = require("path");
const encoder = new TextDecoder();
const { mqttpub } = require("./mqttpublish")
let plcIpAddress = "10.63.192.32";
let values = {};
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

function reconnectAfterDelay() {

  let delay = Math.min(60000 * (reconnectAttempts + 1), maxReconnectDelay); // Increase delay up to a maximum
  console.log(`Attempting to reconnect in ${delay / 1000} seconds...`);
  setTimeout(() => {
    
    reconnectAttempts++;

    if (reconnectAttempts > 10) {
      process.exit(1);
    }

    connectToPLC();
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

// Handle the Disconnected event
PLC.on('Disconnected', () => {
  sendsmtp(`Mqtt service plc Report Plc disconnected`)
  console.log('Disconnected from PLC.');
  reconnectAfterDelay(); // Attempt to reconnect after 30 seconds
});

// Handle the Error event
PLC.on('Error', (err) => {
  sendsmtp(`Mqtt service plc Report Plc Error: ${err}`)
  console.log('Error encountered:', err);
  reconnectAfterDelay(); // Attempt to reconnect after 30 seconds
});

async function readTagsAndUpdateValues() {
  values = {};
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
        if (!groupCounters.hasOwnProperty(tagGroupName)) {
          groupCounters[tagGroupName] = 1;
        }

        if (!values[publishGroup].hasOwnProperty(tagGroupName)) {
          values[publishGroup][tagGroupName] = {};
        }

        if (!tagGroupUniqueAliases.hasOwnProperty(publishGroup)) {
          tagGroupUniqueAliases[publishGroup] = {};
        }
        if (!tagGroupUniqueAliases[publishGroup].hasOwnProperty(tagGroupName)) {
          tagGroupUniqueAliases[publishGroup][tagGroupName] = new Set();
        }

        let aliasKey = config.alias;
        if (tagGroupUniqueAliases[publishGroup][tagGroupName].has(aliasKey)) {
          aliasKey += groupCounters[tagGroupName];
        }

        values[publishGroup][tagGroupName][aliasKey] = tagvalue;
        tagGroupUniqueAliases[publishGroup][tagGroupName].add(config.alias);
        groupCounters[tagGroupName]++;
      } else {
        values[publishGroup][config.alias] = tagvalue;
      }
    } catch (error) {
      sendsmtp(`Mqtt service plc Report Plc Error: ${error}`)
      console.error(`Error reading tag '${config.name}': ${error.message}`);
      reconnectAfterDelay();
    }
  }

  if (Object.keys(values).length === 0) {
    console.log('No tags were read. Attempting to reconnect...');
    reconnectAttempts++;
    reconnectAfterDelay();
  }
  //console.log(values)

  Object.keys(values).forEach((key) => {
    if (key === 'Mark012') {
      const totalUnits = getTotalUnits();
      const data = {
        OEE_Data: values[key],
        Production: {
          ...totalUnits,
        },
      };
      mqttpub(`ELP/Returns/Bastian/${key}/DDATA`, data);
    } else {
      const data = {
        OEE_Data: values[key],
      };
      mqttpub(`ELP/Returns/Bastian/${key}/DDATA`, data);
    }
  });

  values = {};
  setTimeout(readTagsAndUpdateValues, 1000);
}

async function connectToPLC() {
  try {
    await PLC.connect(plcIpAddress, 0);
    console.log("Connected to PLC");
    reconnectAttempts = 0; 
    await readTagsAndUpdateValues();
  } catch (error) {
    sendsmtp(`Mqtt service plc Report Plc Error: ${error}`)
    console.error(`Failed to connect to PLC: ${error}`);
    reconnectAfterDelay();
  }
}

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

connectToPLC();

sendsmtp(`Mqtt service plc Start, Display name: Bastian Mqtt server`)
