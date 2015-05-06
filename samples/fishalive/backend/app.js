/*******************************************************************************
 * Copyright (c) 2014 IBM Corporation and other Contributors.
 *
 * All rights reserved. This program and the accompanying materials
 * are made available under the terms of the Eclipse Public License v1.0
 * which accompanies this distribution, and is available at
 * http://www.eclipse.org/legal/epl-v10.html 
 *
 * Contributors:
 * IBM - Initial Contribution
 *******************************************************************************/

var SHARE_ID = "fishalive-workers";

var mqlightServiceName = "mqlight";

/*
 * Establish MQ credentials
 */
var opts = {};
var mqlightService = {};
if (process.env.VCAP_SERVICES) {
	var services = JSON.parse(process.env.VCAP_SERVICES);
	console.log( 'Running BlueMix');
	if (services[ mqlightServiceName ] == null) {
		throw 'Error - Check that app is bound to service';
	}
	mqlightService = services[mqlightServiceName][0];
	opts.service = mqlightService.credentials.connectionLookupURI;
	opts.user = mqlightService.credentials.username;
	opts.password = mqlightService.credentials.password;
} else {
	opts.service = 'amqp://localhost:5672';
}

var seneca = require('seneca')()
	.use('mqlight-transport', {
		user: opts.user,
		password: opts.password,
		service: opts.service
	})
	.add({service: 'uppercase'}, function(message, done) {
		done(null, processMessage(message))
	})
	.listen({type:'mqlight', share_id: SHARE_ID, credit: 5})

/*
 * Handle each message as it arrives
 */
function processMessage(data) {
	var word = data.word;
	try {
		// Convert JSON into an Object we can work with 
		data = JSON.parse(data);
		word = data.word;
	} catch (e) {
		// Expected if we already have a Javascript object
	}
	if (!word) {
		console.error("Bad data received: " + data);
	}
	else {
		console.log("Received data: " + JSON.stringify(data));
		// Upper case it and publish a notification
		var replyData = {
				"word" : word.toUpperCase(),
				"backend" : "Node.js:"
		};
		// Convert to JSON to give the same behaviour as Java
		// We could leave as an Object, but this is better for interop
		console.log("Sending response: " + JSON.stringify(replyData));
		return replyData
	}
}
