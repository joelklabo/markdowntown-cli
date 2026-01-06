// Imports the Google Cloud client library
const { PubSub } = require('@google-cloud/pubsub');

// Creates a client; cache this for further use
const pubSubClient = new PubSub();

async function publishMessage(topicNameOrId, data) {
  // Publishes the message as a string, e.g. "Hello, world!" or JSON.stringify(someObject)
  const dataBuffer = Buffer.from(data);

  try {
    const messageId = await pubSubClient
      .topic(topicNameOrId)
      .publishMessage({ data: dataBuffer });
    console.log(`Message ${messageId} published.`);
  } catch (error) {
    console.error(`Received error while publishing: ${error.message}`);
    process.exitCode = 1;
  }
}

async function main() {
  const topicNameOrId = process.env.PUBSUB_TOPIC || 'my-topic';
  const messageCount = parseInt(process.env.MESSAGE_COUNT, 10) || 100;
  const message = {
    data: 'Hello, world!',
    attributes: {
      source: 'load-test-script',
    },
  };
  const messageStr = JSON.stringify(message);

  console.log(`Publishing ${messageCount} messages to ${topicNameOrId}...`);

  const start = Date.now();
  for (let i = 0; i < messageCount; i++) {
    await publishMessage(topicNameOrId, messageStr);
  }
  const end = Date.now();

  console.log(
    `Published ${messageCount} messages in ${end - start}ms.`,
  );
}

main().catch(console.error);