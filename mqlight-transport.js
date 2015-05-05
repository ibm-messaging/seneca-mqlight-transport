/*
 * Copyright (c) 2015 IBM Corp.
 *
 * All rights reserved. This program and the accompanying materials
 * are made available under the terms of the Eclipse Public License v1.0
 * which accompanies this distribution, and is available at
 * http://www.eclipse.org/legal/epl-v10.html
 *
 * Contributors:
 *    Allan Stockdill-Mander
 */

'use strict'

var buffer = require('buffer')
var util = require('util')
var net = require('net')
var stream = require('stream')

var _ = require('lodash')

var mqlight = require('mqlight')

module.exports = function(options) {
	var seneca = this
	var plugin = 'mqlight-transport'

	var so = seneca.options()

	options = seneca.util.deepextend({
		mqlight: {
			service: options.service || 'amqp://localhost:5672',
			id: options.id,
			user: options.user,
			password: options.password
		},
	}, so.transport, options)

	var tu = seneca.export('transport/utils')

	seneca.add({role:'transport', hook:'listen', type:'mqlight'}, hook_listen_mqlight)
	seneca.add({role:'transport', hook:'client', type:'mqlight'}, hook_client_mqlight)

	function hook_listen_mqlight(args, done) {
		var seneca = this
		var type = args.type
		var listen_options = seneca.util.clean(_.extend({}, options[type], args))
		var service_name = args.service
		var response_topic = args.outgoing || undefined
		var listen_topic = args.incoming || 'services'
		var share_id = args.share_id || null
		var listen_qos = args.qos || 0
		var auto_confirm = args.autoconfirm || true
		var credit = args.credit || 1024

		var mqlight_client = mqlight.createClient(listen_options, function(err) {
			if (err) {
				seneca.log.error(err)
				return
			}
		})
		
		mqlight_client.on('started', function() {
			seneca.log.info('client started', seneca)
			mqlight_client.subscribe(listen_topic, share_id, {
				credit: credit,
				autoConfirm: auto_confirm,
				qos: listen_qos},
				function(err) {
					if (err) {
						seneca.log.error(err)
						return
					} else {
						seneca.log.info('Subscribe success', 'topic: ' + listen_topic)
					}
				}
			)

			mqlight_client.on('message', function(data, delivery) {
				var input = tu.parseJSON(seneca, 'listen-'+type, data)

				tu.handle_request(seneca, input, listen_options, function(out) {
					var out_topic = input.act.response_topic || response_topic
					if (out != null && out_topic != undefined) {
						var output = tu.stringifyJSON(seneca, 'listen-'+type, out)
						mqlight_client.send(out_topic, output)
					}
				})
			})
			done()
		})

		seneca.add('role:seneca,cmd:close', function(close_args, done) {
			var closer = this

			mqlight_client.stop()
			closer.prior(close_args, done)
		})

		seneca.log.info('listen options', listen_options, seneca)
	}

	function hook_client_mqlight(args, clientdone) {
		var seneca = this
		var type = args.type
		var client_options = seneca.util.clean(_.extend({}, options[type], args))
		var response_topic = args.response_topic || undefined
		var request_topic = args.request_topic || undefined

		tu.make_client(make_send, client_options, clientdone)

		function make_send(spec, topic, send_done) {
			var mqlight_client = mqlight.createClient(client_options, function(err) {
				if (err) {
					seneca.log.error(err)
				}
			})

			mqlight_client.on('started', function() {
				response_topic = response_topic || 'response/' + mqlight_client.id
				mqlight_client.subscribe(response_topic)
				mqlight_client.on('message', function(data, delivery) {
					var input = tu.parseJSON(seneca, 'client-'+type, data)
        			tu.handle_response(seneca, input, client_options)
				})
				send_done(null, function(args, done) {
					args.response_topic = response_topic
					var outmsg = tu.prepare_request(this, args, done)
					var outstr = tu.stringifyJSON(seneca, 'client-'+type, outmsg)
					var out_topic = request_topic || 'services'

					mqlight_client.send(out_topic, outstr)
				})
			})

			seneca.add('role:seneca,cmd:close', function(close_args, done) {
				var closer = this

				mqlight_client.stop()
				closer.prior(close_args, done)
			})
		}

		seneca.log.info('client options', client_options, seneca)
	}

	return {
		name: plugin
	}
}
