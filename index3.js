const { ControllerManager, TagGroup, TagList } = require("st-ethernet-ip");
const pcname = require('os');
const encoder = new TextDecoder('utf-8')
const cm = new ControllerManager();
const { counter } = require("./counter")
const fs = require("fs");
const path = require("path");
const schedule = require("node-schedule");
const { sendsmtp } = require("./smtp")

const countersFile = path.join(__dirname, "counters.json");

const cont32 = cm.addController("10.63.192.32", 0, 300, true, 1000, {});

cont32.on("Connected", () => {
  console.log("connect to bastian success")
});

cont32.on("Disconnected", () => {
  console.log("Disconnected from bastian. Attempting to reconnect in 30 seconds...");
  setTimeout(() => {
    cont32.connect();
  }, 30000);
});

cont32.on("Error", (err) => {
  sendsmtp(`Error Divert Counter ${err}`)
  console.log("Error encountered. Attempting to reconnect in 30 seconds...");
  console.log(err)
  setTimeout(() => {
    cont32.connect();
  }, 30000);
});

cont32.on("TagChanged", (tag, prevValue) => {
  if (tag.name == "WebAPI_DivertConfimData_strBarcode") {
    

  } else if (tag.name == "WebAPI_DivertConfirm_strLane") {
    if (!tag.value.startsWith('ELP_') || tag.value === '00') {
      console.log(`Ignoring value: ${tag.value}`);
      return;
    }
    counter('Spur',tag.value)
  }
});

schedule.scheduleJob("0 3 * * *", () => {
  counters = {};
  fs.writeFileSync(countersFile, JSON.stringify(counters));
});

cont32.connect();

cont32.addTag("WebAPI_DivertConfimData");

sendsmtp(`Divert confirm counter service plc Start`)


