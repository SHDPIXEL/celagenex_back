const { Queue } = require('bullmq');
require('dotenv').config();

// Create a queue
const connection = {
    host: '127.0.0.1',
    port: 6379, // Replace with Redis details if needed
};

const videoQueue = new Queue('videoProcessing', { connection });

module.exports = videoQueue;