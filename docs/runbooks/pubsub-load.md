# Pub/Sub Load Test

This script is used to generate a configurable load on a Pub/Sub topic.

## Usage

1. **Set up authentication:**

    Make sure you have authenticated with Google Cloud CLI and have the necessary
    permissions to publish messages to the target Pub/Sub topic.

    ```bash
    gcloud auth application-default login
    ```

1. **Set environment variables:**

* `PUBSUB_TOPIC`: The name or ID of the Pub/Sub topic to publish to.
  Defaults to `my-topic`.
* `MESSAGE_COUNT`: The number of messages to publish. Defaults to `100`.

1. **Run the script:**

    ```bash
    node scripts/load/pubsub-load.js
    ```

    Example:

    ```bash
    PUBSUB_TOPIC=my-project/my-topic MESSAGE_COUNT=1000 node scripts/load/pubsub-load.js
    ```
