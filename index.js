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
        
        getAllLogItemsForGroup: async function(group) {
            const streams = await this.getAllLogStreamsOfGroup(group);
            
            let items = []
            
            for (const stream of streams) {
                const tmpItems = await this.getAllLogItemsForStream(group, stream);
                items = items.concat(tmpItems);
            }
            
            return items;
            
        }
        
    }

}

module.exports.LogScraper = LogScraper;

if (require.main === module) {

    const scraper = new LogScraper('us-east-1');

    // getAllLogGroups()
    //     .then(a => console.log(a));

    // getAllLogStreamsOfGroup('/aws/lambda/realworld-dev-watchtower-monitor')
    //     .then(a => console.log(a));

    // getAllLogStreams()
    //     .then(a => console.log(a));

    // scraper.getAllLogItemsForStream('/aws/lambda/realworld-dev-watchtower-monitor', '2019/03/20/[$LATEST]1625d9ff778b4139ab0cef32963c5c70')
    //     .then(a => console.log(a));

    scraper.getAllLogItemsForGroup('/aws/lambda/realworld-dev-watchtower-monitor')
        .then(a => console.log(a));

}
