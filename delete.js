const { MongoClient } = require('mongodb');

const uri = 'mongodb://localhost:27017';
const client = new MongoClient(uri);

async function clearOeeCollection() {
  try {
    await client.connect();
    const database = client.db('ELP');
    const collection = database.collection('OEE');

    let result;
    let deletedCount = 0;
    let idsToDelete;

    do {
      const cursor = collection.find({}).limit(100); // Modify the limit to a suitable number
      const docsToDelete = await cursor.toArray();
      idsToDelete = docsToDelete.filter(doc => {
        const date = new Date(doc.ts.$date);
        const minute = date.getUTCMinutes();
        return minute !== 0 && minute !== 30;
      }).map(doc => doc._id);

      if (idsToDelete.length > 0) {
        result = await collection.deleteMany({ _id: { $in: idsToDelete } });
        deletedCount += result.deletedCount;
      }
    } while (idsToDelete && idsToDelete.length > 0);

    console.log(`${deletedCount} documents deleted from the collection.`);
  } catch (err) {
    console.error(err);
  } finally {
    await client.close();
  }
}

clearOeeCollection();
