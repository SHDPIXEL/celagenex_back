const { Queue } = require('bullmq');
require('dotenv').config();

// Create a queue
const connection = {
    host: 'clustercfg.celagenex-redis.bbhsdn.aps1.cache.amazonaws.com',
    port: 6379, // Replace with Redis details if needed
};

const videoQueue = new Queue('videoProcessing', { connection });

module.exports = videoQueue;
