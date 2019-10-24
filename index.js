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

        },

	getAllLogItemsForGroupMatching: async function(group, regex, startTime) {
	    const queryParams = {
		logGroupName: group,
		queryString: `fields @message | filter @message like "VIOLATION"`,// ${regex}`,
		startTime: Math.ceil(Date.now()/1000)-(startTime ? startTime : 86400),
		endTime: Math.ceil(Date.now()/1000),
	    };
	    const queryId = (await cloudwatchlogs.startQuery(queryParams).promise()).queryId;

	    let wait = 50;

	    while (true) {
		const res = await cloudwatchlogs.getQueryResults({queryId}).promise();
		if (res.status === 'Complete') {
		    return res.results.map(event => event[0].value);
		} else if (res.status === 'Running' || res.status === 'Scheduled') {
		    if (wait < 5000) wait = wait * 2;
		} else {
		    throw "Unexpected result from query."
		}
	    }
	},
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

    const notificationDelayRE = /@@@@WT_PROF: VIOLATION REPORT DELAY: ([0-9]*)\(ms\)/;
//    const notificationDelayRE = '\"VIOLATION REPORT DELAY\"';

    const logGroup = '/aws/lambda/wt-full-flow-test-watchtower-monitor';

    scraper.getAllLogItemsForGroupMatching(logGroup, notificationDelayRE)
	.then(res => console.log(res));

}
