const aws = require('aws-sdk');

function LogScraper(region) {
    const cloudwatchlogs = new aws.CloudWatchLogs({region});

    const getAllLogItemsMatching = async function (params) {
        let data = await cloudwatchlogs.filterLogEvents(params).promise();

        let events = data.events;

        let nextToken = data.nextToken;

        while (nextToken) {
            params.nextToken = nextToken;

            data = await cloudwatchlogs.filterLogEvents(params).promise();
            events = events.concat(data.events);
            nextToken = data.nextToken;
        }

        return events;
    }

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
            const lgs = await this.getAllLogGroups();

            let logStreams = []

            for (const lg of lgs) {
                const lss = await this.getAllLogStreamsOfGroup(lg);
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

                if (logEvents.events.length > 0) {
                    nextToken = logEvents.nextForwardToken;
                    entries = entries.concat(logEvents.events);
                } else {
                    nextToken = undefined;
                }
            }

            return entries;
        },

        getAllLogItemsForStreamMatching: async function(group, stream, pattern) {
            const params = {
                logGroupName: group,
                filterPattern: pattern,
                stream: stream
            };
            return await getAllLogItemsMatching(params);
        },


        getAllLogItemsForGroup: async function(group) {
            const streams = await this.getAllLogStreamsOfGroup(group);

            let items = []

            for (const stream of streams) {
                const tmpItems = await this.getAllLogItemsForStream(group, stream);
                items = items.concat(tmpItems);
            }

            return items;

        },

        getAllLogItemsForGroupMatching: async function(group, pattern) {
            const params = {
                logGroupName: group,
                filterPattern: pattern,
            };
            return await getAllLogItemsMatching(params);
        },

        clearLogGroup: async function (group) {
            const streams = await this.getAllLogStreamsOfGroup(group)

            console.log(`Got the following streams for group ${group}:\n${streams}`)

            for (const stream of streams) {
                console.log(`Deleting stream ${stream} of group ${group}`)
                const resp = await cloudwatchlogs.deleteLogStream({logGroupName:group, logStreamName: stream}).promise()
            }
        }
    }

}

module.exports.LogScraper = LogScraper;

if (require.main === module) {

    const scraper = new LogScraper('eu-west-1');

    // getAllLogGroups()
    //     .then(a => console.log(a));

    // getAllLogStreamsOfGroup('/aws/lambda/realworld-dev-watchtower-monitor')
    //     .then(a => console.log(a));

    // getAllLogStreams()
    //     .then(a => console.log(a));

    // scraper.getAllLogItemsForStream('/aws/lambda/realworld-dev-watchtower-monitor', '2019/03/20/[$LATEST]1625d9ff778b4139ab0cef32963c5c70')
    //     .then(a => console.log(a));

    // scraper.getAllLogItemsForGroup('/aws/lambda/realworld-dev-watchtower-monitor')
    //     .then(a => console.log(a));

    // const pattern = 'WT_PROF VIOLATION REPORT DELAY';

    // const notificationDelayRE = /@@@@WT_PROF: VIOLATION REPORT DELAY: ([0-9]*)\(ms\)/;
//    const notificationDelayRE = '\"VIOLATION REPORT DELAY\"';

    // const logGroup = '/aws/lambda/wt-full-flow-test-watchtower-monitor';
    //
    // scraper.getAllLogItemsForGroupMatching(logGroup, pattern)
    //     .then(res => console.log(res));

    const group = '/aws/lambda/wt-collision-count-test-watchtower-monitor'
    scraper.clearLogGroup(group)
}
