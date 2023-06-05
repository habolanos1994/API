const { Controller } = require("st-ethernet-ip");
const fs = require("fs");
const path = require("path");

let plcIpAddress = "10.63.192.32";
let PLC = new Controller();

let tagConfigsFile = path.join(__dirname, "tagConfigs2.json");
let tagConfigs = JSON.parse(fs.readFileSync(tagConfigsFile));

const errorTags = [];
const validTags = [];

function validateTagConfig(tagConfig) {
  const { name, alias, PublishGroup } = tagConfig;

  // Check if tag name is empty
  if (!name) {
    errorTags.push({
      ...tagConfig,
      error: "Tag name is empty."
    });
    return false;
  }

  // Check if tag name contains invalid characters
  const invalidChars = /[^a-zA-Z0-9_.[\]]/.test(name);
  if (invalidChars) {
    errorTags.push({
      ...tagConfig,
      error: "Tag name contains invalid characters."
    });
    return false;
  }

  // Check if alias is unique within the publish group
  const aliasExists = validTags.some(
    (tag) => tag.alias === alias && tag.PublishGroup === PublishGroup
  );
  if (aliasExists) {
    errorTags.push({
      ...tagConfig,
      error: `Alias '${alias}' is not unique within the publish group '${PublishGroup}'.`
    });
    return false;
  }

  return true;
}

async function validateTagValues() {
  for (const config of tagConfigs) {
    if (!validateTagConfig(config)) {
      continue; // Skip this iteration if the tag config is not valid
    }

    const tag = PLC.newTag(config.name);
    try {
      await PLC.readTag(tag);
      // Add the tag value to the config and push it to validTags
      validTags.push({
        ...config,
        value: tag.value,
      });
    } catch (error) {
      errorTags.push({
        ...config,
        error: `Error reading tag '${config.name}': ${error.message}`
      });
    }
  }
}

async function validateTags() {
  try {
    await PLC.connect(plcIpAddress, 0);
    console.log("Connected to PLC");

    await validateTagValues();

    // Write the error tags to a json file
    fs.writeFileSync("errorTags.json", JSON.stringify(errorTags, null, 2));

    // Write the valid tags to a json file
    fs.writeFileSync("validTags.json", JSON.stringify(validTags, null, 2));

    console.log("Validation complete. See errorTags.json and validTags.json for details.");
  } catch (error) {
    console.error(`Failed to connect to PLC: ${error}`);
  }
}

validateTags();
