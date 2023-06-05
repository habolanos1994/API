const { MongoClient } = require('mongodb');
const os = require('os');

const hostname = `${os.hostname()}`;
const connectionString = "mongodb://CHY-ELPLABVEWP1:27017";

const client = new MongoClient(connectionString, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
});

let db;

async function connectDB() {
    try {
        await client.connect();
        db = client.db("ELP"); // Replace <your_database_name> with the name of your database
        console.log("Connected to MongoDB");
    } catch (error) {
        console.error("Error connecting to MongoDB", error);
    }
}

connectDB();

let seq = 0;
let currentDay = new Date().getDate();

async function saveToMongoDB(Station, message) {
    const today = new Date().getDate();

    if (today !== currentDay) {
        seq = 0;
        currentDay = today;
    }
    seq++;

    const metadata = {
        Plant: "ELP",
        Area: "Returns",
        Line: 'Bastian',
        Station: Station,
        DeviceID: hostname,
        seq: seq,
    };

    const payload = {
        bn: "PLC OEE READ",
        ts: new Date(),
        md: metadata,
        ...message,
    };

    try {
        const result = await db.collection('OEE').insertOne(payload);
        console.log(`Data saved with id: ${result.insertedId}`);
    } catch (error) {
        console.error("Error saving data to MongoDB", error);
    }
}

module.exports = { saveToMongoDB };
