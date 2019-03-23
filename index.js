const aws = require('aws-sdk');

function LogScraper(region) {
    const cloudwatchlogs = new aws.CloudWatchLogs({region});
    
    return {
        getAllLogGroups: async function () {
            let response = await cloudwatchlogs.describeLogGroups().promise();
            let logGroups = response.logGroups.map(lg => lg.logGroupName);

            let nextToken = response.nextToken;

            while (nextToken) {
                response = await cloudwatchlogs.describeLogGroups( { nextToken } ).promise();
                logGroups = logGroups.concat(response.logGroups.map(lg => lg.logGroupName));
                let nextToken = response.nextToken;        
            }
            
            return logGroups;
        },

        getAllLogStreamsOfGroup: async function (group) {
            let response   = await cloudwatchlogs.describeLogStreams({ logGroupName: group }).promise();
            let logStreams = response.logStreams.map(ls => ls.logStreamName);
            let nextToken  = response.nextToken;
            
            while (nextToken) {
                response   = await cloudwatchlogs.describeLogStreams({ logGroupName: group }).promise();
                logStreams = logStreams.concat(response.logStreams.map(ls => ls.logStreamName));
                nextToken  = response.nextToken;
            }
            
            return logStreams;
        },

        getAllLogStreams: async function () {
            const lgs = await getAllLogGroups();
            
            let logStreams = []

            for (const lg of lgs) {
                const lss = await getAllLogStreamsOfGroup(lg);
                logStreams = logStreams.concat(lss);
            }

            return logStreams;
        },

        getAllLogItemsForStream: async function(group, stream) {
            let entries = []

            let logEvents = await cloudwatchlogs.getLogEvents({logGroupName: group , logStreamName: stream, startFromHead: true}).promise();
            
            entries = entries.concat(logEvents.events);

            let nextToken = logEvents.nextForwardToken;

            while (nextToken) {
                logEvents = await cloudwatchlogs.getLogEvents({logGroupName: group , logStreamName: stream, nextToken}).promise();
                
                if (logEvents.events.lenth > 0) {
                    nextToken = logEvents.nextForwardToken;
                    entries = entries.concat(logEvents.events);            
                } else {
                    nextToken = undefined;
                }
            }

            return entries;
        },
    }

}

module.exports.LogScraper = LogScraper;
