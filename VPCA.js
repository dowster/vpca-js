//TODO: Connection Keep-Alive
//TODO: Automatic Re-Connect
//TODO: Connection Error Handling

var MAX_RETRIES = 10;

/**
 * Sister object/library to the server side VPCA service. This provides get
 * and set parameter functions as well as the ability to send custom json
 * messages to the server.
 * Date: June 17th, 2015
 * @class VPCA
 */
var VPCA = {
	/**
	 * Holder for the Websocket object initialized in {{#crossLink "VPCA/_SetupWebSocket:method"}}{{/crosslink}}
	 *
	 * @type Array
	 * @property _sendQueue
	 */
	_socket: null,

	/**
	 * Array of all the event hooks.
	 *
	 * @type Array
	 * @property _hooks
	 */
	_hooks: {
		onOpen: [],
		onClose: [],
		onError: [],
		onMessage: [],
		onValidJSON: [],
		validResponses: {
			MGP: [],
			MGPM: [],
			MGPG: [],
			MGPMG: [],
			MPUSHP: [],
			MPUSHG: [],
			MPUSHC: [],
			MLOG: [],
			MSP: [], //TODO: create a handler for this response
			MGLAN: [] // TODO: Create a handler for this response
		}
	},

	/**
	 * Map of all the request/response pairs
	 *
	 * @type Array
	 * @property ReqRespMap
	 */
	ReqRespMap: {
		'WGP': 'MGP',
		'WGPM': 'MGPM',
		'WGPG': 'MGPG',
		'WGPGM': 'MGPGM',
		'WGPMG': 'MGPMG',
		'WPUSHP': 'MPUSHP',
		'WPUSHG': 'MPUSHG',
		'WPUSHC': 'MPUSHC',
		'WLOG': 'MLOG',
		'WSP': 'MSP',
		'WGLAN': 'MGLAN'
	},

	/**
	 * Flag used to prevent the duplication of hooks on an unstable connection.
	 *
	 * @type Boolean
	 * @property hooksInitialized
	 */
	hooksInitialized: false,

	/**
	 * Time to wait before checking if a push request was created.
	 *
	 * Milliseconds
	 *
	 * @type int
	 * @property WaitToVerifyPush
	 */
	WaitToVerifyPush: 1000,

	/**
	 * The time to wait between receiving the awaiting response and sending the
	 * next message.
	 *
	 * Milliseconds
	 *
	 * @type int
	 * @property SendDelay
	 */
	SendDelay: 50,

	/**
	 * Constant used to adjust how many times the library will attempt to revive
	 * a closed connection.
	 *
	 * @type const int
	 * @property maxReconnectAttempts
	 */
	maxReconnectAttempts: 5,

	/**
	 * Array of json objects to be sent to the server. The objects are stored here
	 * when the websocket connection is unavailible.
	 *
	 * @type Array
	 * @property _sendQueue
	 */
	_sendQueue: [],
	
	/**
	 * An cursor for the _sendQueue array, to make handling large queues a lot 
	 * more efficient. 
	 */
	_sendQueueCursor: 0,

	/**
	 * Array of the messages that were sent to the server in string format.
	 *
	 * @type Array
	 * @property _sentMessages
	 */
	_sentMessages: [],

	/**
	 * Used to indicate an intended socket close
	 *
	 * @type Boolean
	 * @property closing
	 */
	closing: [],

	/**
	 * Array of listener functions that are awaiting push updates
	 *
	 * @type Array
	 * @property _pushListeners
	 */
	_pushListeners: [],

	/**
	 * Log of exceptions that have occured in VPCA
	 * Not Implemented
	 * @type Array
	 * @property _exceptionLog
	 */
	_exceptionLog: [],

	/**
	 * Array of objects that are awaiting a response from the server.
	 *
	 *     {
	 *        group: int,
	 *        callback: function //this function should be bound to the proper "this" context
	 *     }
	 *
	 * @type Array
	 * @property _groupListeners
	 */
	_groupListeners: [],

	/**
	 * Array of objects that are awaiting a response from the server.
	 *
	 *     {
	 *        parameter: int,
	 *        callback: function //this function should be bound to the proper "this" context
	 *     }
	 *
	 * @type Array
	 * @property _parameterListeners
	 */
	_parameterListeners: [],

	/**
	 * Array of objects that are awaiting a response from the server.
	 *
	 *     {
	 *        parameter: int,
	 *        callback: function //this function should be bound to the proper "this" context
	 *     }
	 *
	 * @type Array
	 * @property _awaitingMetadataResponse
	 */
	_awaitingMetadataResponse: [],

	/**
	 * Array of objects that are awaiting a response from the server.
	 *
	 *     {
	 *        parameter: int,
	 *        callback: function //this function should be bound to the proper "this" context
	 *     }
	 *
	 * @type Array
	 * @property _awaitingLanguageResponse
	 */
	_awaitingLanguageResponse: [],

	/**
	 * Array of objects that are awaiting a response from the server. This will be looped and cleared once a log flush response is received
	 * if there are still log flush commands queued to send and a log flush response is received this array will still all be called and then cleared.
	 *
	 * There should be logic in the callback to handle a valid response parameter (2) and any invalid ones (!2)
	 *
	 *     {
	 *        callback: function //this function should be bound to the proper "this" context
	 *     }
	 *
	 * @type Array
	 * @property _awaitingLogFlush
	 */
	_awaitingLogFlush: [],
	/**
	 *
	 * The buffer used by the internal message handler.
	 * Message portions are appended here and then pulled out once they form a valid JSON object.
	 *
	 * @type Array
	 * @property _jsonBuffer
	 */
	_jsonBuffer: "",

	/**
	 *
	 * The array that holds all of the {{#crossLink "CanParameter"}}{{/crossLink}} objets
	 *
	 * @type Array
	 * @property _jsonBuffer
	 */
	parameters: [],

	_pushSynchronizers: [],

	_awaitingResponse: false,
	/**
	 *
	 *      This function handles the setup of the web socket. It will be called
	 *      on page load, and will also be called by the checkSocket() function if
	 *      the socket breaks or has not yet been created.
	 *
	 * Credit: Connection procedure taken from Rob Hodson's "Webcode-EngineeringV1\www\js\VPCA.js"
	 * Date: June 17th, 2015
	 * @method _SetupWebSocket
	 */
	_SetupWebSocket: function() {


		if (this.hooksInitialized === false) this._initializeHooks();

		var loc = window.location,
			wsUriVPCA;
		if (loc.protocol === "https:") {
			wsUriVPCA = "wss:";
		} else {
			wsUriVPCA = "ws:";
		}
		wsUriVPCA += loc.host + "/VPCA";
		//wsUriVPCA += "192.168.0.1" + "/VPCA";

		this._socket = new WebSocket(wsUriVPCA);

		/**
		 * Called when the socket is opened. This will loop through the hooks
		 * assigned to onOpen and will call them in the order they were assigned.
		 * @param evt {object} the event data from the WebSocket
		 * Date: June 17th, 2015
		 * @method _socket.onopen
		 */
		this._socket.onopen = function(evt) {
			CreateNotification("Wifi", "Connection Opened", 'success');
			console.log(evt);
			for (var hook in VPCA._hooks.onOpen) {
				if (VPCA._hooks.onOpen[hook] instanceof Function) {
					VPCA._hooks.onOpen[hook].call(VPCA._hooks.onOpen[hook].prototype, evt);
				}
			}
		};

		/**
		 *      Called when the socket is closed. Acts similar to onopen except it
		 *      loops through the hooks assigned to onClose
		 * @param evt {object} the event data from the WebSocket
		 * Date: June 17th, 2015
		 * @method _socket.onclose
		 */
		this._socket.onclose = function(evt) {
			CreateNotification("WiFi", "Connection Closed", 'error');
			console.log(evt);
			for (var hook in VPCA._hooks.onClose) {
				if (VPCA._hooks.onClose[hook] instanceof Function) {
					VPCA._hooks.onClose[hook].call(VPCA._hooks.onClose[hook].prototype, evt);
				}
			}
		};

		/**
		 * Called when the socket is closed. Acts similar to onopen except it
		 * loops through the hooks assigned to onMessage.
		 *
		 * Use this only if you want to log all messages. There are potential
		 * performance issues that may arise if too many hooks are assigned to
		 * this event. The messages are handled within the {{#crossLink "CanParameter"}}{{/crossLink}} objects
		 * and with the SendJson function.
		 * @param evt {object} the event data from the WebSocket
		 * Date: June 17th, 2015
		 * @method _socket.onmessage
		 */
		this._socket.onmessage = function(evt) {
			for (var hook in VPCA._hooks.onMessage) {
				if (VPCA._hooks.onMessage[hook] instanceof Function) {
					VPCA._hooks.onMessage[hook].call(VPCA._hooks.onMessage[hook].prototype, evt);
				}
			}
		};

		/**
		 * Called when the socket is closed. Acts similar to onopen except it
		 * loops through the hooks assigned to onError
		 * Date: June 17th, 2015
		 * @param evt {object} the event data from the WebSocket
		 * @method _socket.onerror
		 */
		this._socket.onerror = function(evt) {
			CreateNotification("WiFi", "Connection Error", 'warning');
			console.error(evt);
			for (var hook in VPCA._hooks.onError) {
				if (VPCA._hooks.onError[hook] instanceof Function) {
					VPCA._hooks.onError[hook].call(VPCA._hooks.onError[hook].prototype, evt);
				}
			}
		};
	},

	/**
	 * Called to gracefully close the VPCA websocket connection
	 *
	 *
	 * @method CloseSocket
	 */
	CloseSocket: function() {
		this.closing = true;
		this._socket.close();
	},

	/**
	 * Called the first time the socket is initialized. These hooks handle the
	 * basic functionality of the library but also provide reference for adding
	 * custom hooks.
	 *
	 *  this.addHook(
	 * 	 "onMessage", 					//Event to hook into
	 * 	 this._onMessageInternal,	//Function to execute
	 * 	 this								//Optional: Context to provide to the function
	 *  );
	 *
	 * @method _initializeHooks
	 */
	_initializeHooks: function() {
		this.addHook(
			"onMessage",
			this._onMessageInternal,
			this
		);
		this.addHook(
			"onOpen",
			function(evt) {
				console.log("Socket Open");
			},
			this
		);
		this.addHook(
			"onOpen",
			this.ProcessSendQueue,
			this
		);
		this.addHook(
			"onValidJSON",
			function(json) {
				try {
					for (var hook in this._hooks.validResponses[Object.getOwnPropertyNames(json)[0]]) {
						this._hooks.validResponses[Object.getOwnPropertyNames(json)[0]][hook].call(this, json);
					}
				} catch (e) {
					console.error(e);
				} finally {

				}
			},
			this
		);
		this.addHook(
			"onValidJSON",
			function(json) {
				var responseName = Object.getOwnPropertyNames(json)[0];
				if (responseName == this.awaitingResponse) this.awaitingResponse = false;
			},
			this
		);
		this.addHook("MGPM", this.RouteParameterMetadata);
		//Following is for parameters that are awaiting an update request repsonse
		this.addHook(
			"MGP",
			function(json) {
				for (var element in this._parameterListeners) {
					if (json.MGP && (this._parameterListeners[element].paramID == json.MGP.MGPID || this._parameterListeners[element].paramID == json.MGP.MGPLabel)) {
						this._parameterListeners[element].callback(json);
					}
				}
			},
			this
		);
		//Following is for parameters that are listening to live updates
		this.addHook(
			"MGP",
			function(json) {
				for (var element in this._pushListeners) {
					if (this._pushListeners[element].id == json.MGP.MGPID) {
						this._pushListeners[element].callback(json);
					}
				}
			}
		);
		this.addHook(
			"MGPG",
			function(json) {
				if (typeof json.Values[0].MGP != 'undefined') {
					for (var element in this._groupListeners) {
						if (this._groupListeners[element].id == json.MGPG) {
							this._groupListeners[element].callback(json);
						}
					}
				}
			}
		);
		this.addHook(
			"MGPG",
			function(json) {
				if (typeof json.Values[0].MGPM != 'undefined') {
					this.RouteParameterGroupMetadata(json);
				}
			}
		);
		this.addHook(
			"MGPMG",
			this.RouteParameterGroupMetadata
		);
		this.addHook(
			"MGLAN",
			function(json) {
				for (var element in this._awaitingLanguageResponse) {
					this._awaitingLanguageResponse[element].callback(json);
				}
				this._awaitingLanguageResponse = []; //All listeners will be called; therefor, we can clear the list.
			}
		);
		this.addHook(
			"MPUSHP",
			this.ConfirmPushRequest
		);
		this.addHook(
			"MLOG",
			function(json) {
				for (var element in this._awaitingLogFlush) {
					this._awaitingLogFlush[element].callback(json.MLOG);
				}
				this._awaitingLogFlush = []; //All listeners will be called; therefor, we can clear the list.
			}
		);
		this.addHook(
			"onOpen",
			this.CheckForUnreceivedMessages.bind(this)
		);
		this.addHook(
			"onClose",
			function(evt) {
				if (typeof this.closes == 'undefined') this.closes = 0;
				if (this.closes < this.maxReconnectAttempts && this.closing !== true) {
					setTimeout(VPCA._SetupWebSocket.bind(this), 1000);
					CreateNotification("VPCA", "Attempting to reconnect...", "info");
					this._jsonBuffer = '';
				}

				this.closes++;
			}.bind(this)
		);

		this.hooksInitialized = true;
	},
	/**
	 *
	 * The main internal message handler for recieving messages. It is placed
	 * into the VPCA._hooks.onMessage[] array at the end of {{#crossLink "VPCA/_SetupWebSocket:method"}}{{/crossLink}}
	 *
	 * This will add the message to the buffer and determine if there is a
	 * valid JSON object in the buffer. If so it will pass that JSON object
	 * to the JSON handler which will then route the object to the proper
	 * hooks.
	 *
	 * Credit: Message parsing/assembling procedure taken from Rob Hodson's "Webcode-EngineeringV1\www\js\VPCA.js"
	 *
	 * Date: June 17th, 2015
	 *
	 * @param message {object} The message received by the WebSocket
	 * @method _onMessageInternal
	 */
	_onMessageInternal: function(evt) {
		try {
			this._jsonBuffer += evt.data;
			var nlIndex;
			do {
				nlIndex = this._jsonBuffer.indexOf('\n');
				if (nlIndex > -1) {
					var json = this._jsonBuffer.substr(0, nlIndex); // cuts off newline char
					if (json.length > 0) {
						try {
							this._validJSON(JSON.parse(json));
						} catch (e) {
							console.error(e); //TODO: add in exception handler
							console.error(json);
							console.error(evt);
							console.error(this._jsonBuffer);
						}
					}
					if (nlIndex + 1 < this._jsonBuffer.length) {
						this._jsonBuffer = this._jsonBuffer.substr(nlIndex + 1);
					} else {
						this._jsonBuffer = '';
					}
				}
			} while (nlIndex > -1);
		} catch (Exception) {
			console.log(Exception.message); //TODO: add in exception handler
		}
	},
	/**
	 *
	 *
	 * This is called from _onMessageInternal whenever it has received a full JSON object.
	 * Then _validJSON will loop through the array of hooks that are set to trigger
	 * when a JSON object is retrieved and call them.
	 *
	 * To hook into this use the {{#crossLink "VPCA/addHook:method"}}{{/crossLink}} function with the first parameter
	 * set to "onValidJSON" and the second and third parameters set as specified.
	 *
	 * To simulate recieving a message it should be sufficient to call this function
	 * with the simulated data you are wanting to present.
	 *
	 * Date: June 17th, 2015
	 *
	 * @param json {object} the JSON object found by _onMessageInternal
	 * @method validJSON
	 */
	_validJSON: function(json) {
		for (var hook in this._hooks.onValidJSON) {
			if (this._hooks.onValidJSON[hook] instanceof Function) {
				this._hooks.onValidJSON[hook].call(this._hooks.onValidJSON[hook].prototype, json);
			}
		}
	},
	/**
	 * Takes a hook and checks that it is indeed a function, if so adds it to
	 * the appropriate event array in {{#crossLink "VPCA/_hooks:property"}}{{/crossLink}} as specified by the event parameter.
	 *
	 * If not registering a global function it is highly reccomended to use,
	 * for example, object.function.bind(this) in order to preserve the original
	 * context of  this. Else this may be set to window.
	 *
	 * Date: June 17th, 2015
	 *
	 * @param event {string} The event that the hook pertains to (onOpen, onClose, onError, or onMessage).
	 *
	 * @param hook {object} The function to get called for that event.
	 *
	 * @param thisContext {object} the context to be set as the prototype. IE: the object that the function belongs to.
	 * @method addHook
	 */
	addHook: function(event, hook, thisContext) {
		if (this._hooks.hasOwnProperty(event)) {
			switch (arguments.length) {
				case 2:
					if (hook instanceof Function) {
						this._hooks[event].push(hook);
					} else {
						console.error(hook + " cannot be used as a hook function because it is not a function.");
						console.error(hook);
					}
					break;
				case 3:
					if (hook instanceof Function) {
						hook.prototype = thisContext;
						this._hooks[event].push(hook);
					} else {
						console.error(hook + " cannot be used as a hook function because it is not a function.");
						console.error(hook);
					}
					break;
			}
		} else if (this._hooks.validResponses.hasOwnProperty(event)) {
			switch (arguments.length) {
				case 2:
					if (hook instanceof Function) {
						this._hooks.validResponses[event].push(hook);
					} else {
						console.error(hook + " cannot be used as a hook function because it is not a function.");
						console.error(hook);
					}
					break;
				case 3:
					if (hook instanceof Function) {
						hook.prototype = thisContext;
						this._hooks.validResponses[event].push(hook);
					} else {
						console.error(hook + " cannot be used as a hook function because it is not a function.");
						console.error(hook);
					}
					break;
			}
		} else {
			console.error('Attempt made to add a hook to invalid event: ' + event);
		}
	},

	/**
	 * Register parameter will take the ID and callback and put them into The
	 * _paramterListeners array for use when a response is received.
	 *
	 * Date: August 5th, 2015
	 *
	 * @param parameterId {object} The ID or Name of the CAN parameter that is being
	 *        requested (as defined in the VPCA database)
	 *
	 * @param parameterObject {object} The JavaScript object that will receive the response,
	 *        this should be the object that corresponds to the parameterID supplied.
	 *
	 * @method RegisterParameter
	 */
	RegisterParameter: function(paramID, callback) {
		this._parameterListeners.push({
			"paramID": paramID,
			"callback": callback
		});
		return this._parameterListeners[this._parameterListeners.length - 1];
	},

	/**
	 * GetParameter will generate and send the JSON request to the VPCA server
	 * for the given parameterId (string or number). It will set the callback
	 * to the appropriate object's function, given that parameterObject is a
	 * or child of the CanParameter prototype.
	 *
	 * Date: June 17th, 2015
	 *
	 * @param parameterId {object} The ID or Name of the CAN parameter that is being
	 *        requested (as defined in the VPCA database)
	 *
	 * @param parameterObject {object} The JavaScript object that will receive the response,
	 *        this should be the object that corresponds to the parameterID supplied.
	 *
	 * @method GetParameter
	 */
	GetParameter: function(parameterID) {
		var jsonQuery = {
			"WGP": parameterID
		};

		jsonQuery = JSON.stringify(jsonQuery);

		this.Send(jsonQuery);
	},

	/**
	 *
	 * Sends a value to the WiFi Module to transmit through CAN.
	 *
	 * Date: June 24th, 2015
	 *
	 * @param parameterID {int or string} The ID used in the VPCA Database for the
	 *      parameter to be sent.
	 * @param units {int} ID of the units to be used when sending this parameter, should be the same as in database
	 * @param value The value that is to be sent to the parameter.
	 *
	 * @method SendParameter
	 */
	SendParameter: function(parameterID, units, value) {
		var jsonQuery = {
			"WSP": {
				"WSPID": String(parameterID),
				"WSPUnits": units,
				"WSPVal": String(value)
			}
		};

		jsonQuery = JSON.stringify(jsonQuery);

		this.Send(jsonQuery);
	},

	/**
	 *
	 * Sets up a push stream from the WiFi Module. This automatically sends
	 * the website and update when the parameter value changes or when it
	 * triggers a timer.
	 *
	 * Date: June 24th, 2015
	 *
	 * @param paramID {object} the ID you would like to monitor.
	 *
	 *
	 * @param maxRate {object} the fastest that messages will be sent in ms,
	 *      if this is set to 100ms the WiFi Module will only send updates with a wait time of atleast 100ms between.
	 *      If the parameter is changing more quickly than this some messages will be dropped.
	 *
	 * @param minRate {object} specifies how often the server should send updates when the value hasn't changed.
	 *
	 * @param callback {object} the function that will be called when the push data is received by
	 *        the website.
	 * @method PushRequest
	 */
	PushRequest: function(paramID, maxRate, minRate, callback) {
		var json = {
			"WPUSHP": {
				"WPUSHPID": String(paramID),
				"Minrate": String(minRate),
				"Maxrate": String(maxRate)
			}
		};
		this.Send(JSON.stringify(json));

		if (arguments.length == 4) {
			this._pushListeners.push({
				"id": paramID,
				"callback": callback,
				"confirmed": -MAX_RETRIES
			});
		}

		setTimeout(this.VerifyPushRequest.bind(this, paramID, maxRate, minRate), this.WaitToVerifyPush);
	},

	ConfirmPushRequest: function(json) {
		for (var listener in this._pushListeners) {
			if (json.MPUSHP.MPUSHPID == this._pushListeners[listener].id) {
				this._pushListeners[listener].confirmed = true;
			}
		}
	},

	VerifyPushRequest: function(paramID, maxRate, minRate) {
		for (var listener in this._pushListeners) {
			if (this._pushListeners[listener].id == paramID) {
				if (this._pushListeners[listener].confirmed < 0) {
					this._pushListeners[listener].confirmed++;
					this.PushRequest(paramID, maxRate, minRate);
				} else if (this._pushListeners[listener].confirmed === 0) {
					try {
						CreateNotification('VPCA', 'Could not create Push request for parameter ' + this._pushListeners[listener].id, 'Error');
					} catch (e) {
						console.error(e);
						console.error('Error: Couldn\'t create Push request for parameter ' + this._pushListeners[listener].id);
					} finally {
						this._pushListeners.splice(listener, 1);
					}
				}
			}
		}
	},

	DeregisterParameter: function(paramID, callback) {
		var paramsToRemove = [];
		var parameter = 0;
		for (parameter in this._pushListeners) {
			if (this._pushListeners[parameter].id == paramID && this._pushListeners[parameter].callback === callback) {
				paramsToRemove.push(parameter);
			}
		}
		parameter = 0;
		for (parameter in paramsToRemove) {
			this._pushListeners.splice(paramsToRemove[parameter]);
		}

		paramsToRemove = [];
		parameter = 0;
		for (parameter in this._parameterListeners) {
			if (this._parameterListeners[parameter].paramID == paramID && this._parameterListeners[parameter].callback === callback) {
				paramsToRemove.push(parameter);
			}
		}
		parameter = 0;
		for (parameter in paramsToRemove) {
			this._parameterListeners.splice(paramsToRemove[parameter]);
		}
	},
	/**
	 *
	 * Send is a more intelligent way to send data over the websocket. It will cache
	 * the data while the socket is closed or unavailible and when the socket
	 * becomes open again the data will be sent through. While this could cause delays
	 * on an unstable connection it allows the messages themselves to not worry
	 * about whether it needs to wait to send a message.
	 *
	 * Date: June 24th, 2015
	 *
	 * @param data {object} the stringified json data to be sent to the VPCA server
	 * @method Send
	 */
	Send: function(data) {
		if (typeof data === 'object') data = JSON.stringify(data);
		try {
			if (this._socket.readyState == 1 && this.awaitingResponse === false) {
				var obj = JSON.parse(data);

				this._socket.send(data);
				var requestType = Object.getOwnPropertyNames(obj)[0];
				console.log(requestType);
				this.awaitingResponse = this.ReqRespMap[requestType];
				this._sentMessages.push(obj);
			} else {
				this._sendQueue.push(data);
			}
		} catch (e) {
			this._sendQueue.push(data);
			this._exceptionLog.push(e);
		} finally {

		}
	},

	CheckForUnreceivedMessages: function() {
		if (this.awaitingResponse !== false && this.closes !== 0 && typeof this.closes != 'undefined' && this._sentMessages.length > 0) {
			var lastMessage = this._sentMessages.pop();
			if (this.awaitingResponse == this.ReqRespMap[Object.getOwnPropertyNames(lastMessage)[0]]) {
				this._socket.send(JSON.stringify(lastMessage));
			}
			this._sentMessages.push(lastMessage);
		}
	},

	ProcessSendQueue: function() {
		if (
				this.awaitingResponse === false 
				&& this._sendQueue.length > this._sendQueueCursor
			) {
			this.Send(this._sendQueue[this._sendQueueCursor++])
		}
	},

	get awaitingResponse() {
		return this._awaitingResponse;
	},

	set awaitingResponse(value) {
		if (value === false) setTimeout(this.ProcessSendQueue.bind(this), this.SendDelay);
		this._awaitingResponse = value;
	},

	/**
	 *
	 * Creates a CanParameter object, which will add a row to the table that displays data from this parameter.
	 * This function is not really portable so in order to make it portable it will
	 * be best to remove it and allow modules themselves to register as parameters from within their own constructors.
	 *
	 * Date: June 17th, 2015
	 *
	 * @param parameterID {object} The VPCA ID of the parameter that this object will be handling.
	 * @method CreateParameterObject
	 */
	//TODO: refactor this outof the main VPCA lib, possibly into an extended lib that contains more helper/example/debugging objects
	CreateParameterObject: function(parameterId) {
		var tmp = new CanParameter(VPCA.parameters.length, parameterId, 'undefined');

		this.parameters.push(tmp);
		return {
			result: 1,
			parameter: this.parameters.length - 1
		};
	},

	/**
	 *
	 * Triggers the refresh function for the given paramUID. By default
	 * this just starts the process of updating the parameter's value.
	 *
	 * Date: June 24th, 2015
	 *
	 * @param paramUID {object} the UID of the parameter, also the parameters location in the
	 *        "parameters" array.
	 * @method RefreshParameter
	 */
	RefreshParameter: function(paramUID) {
		parameters[param].refresh();
	},

	/**
	 *
	 * Will request metadata from VPCA such as the parameters name, units it
	 * is using and the min/max values. Useful for setting up gauges or graphs
	 * in order to have them properly scaled to the parameters without hardcoding
	 * those values into the website. This is automatically called by the
	 * CanParameter constructor.
	 *
	 * Date: June 30th, 2015
	 *
	 * @todo programming for this function
	 *
	 * @param parameterID {object} the ID of the parameter that we want the metadata for.
	 * @method RequestParameterMetadata
	 */
	RequestParameterMetadata: function(parameterID, callback) {
		this.Send(JSON.stringify({
			"WGPM": parameterID
		}));

		this._awaitingMetadataResponse.push({
			"id": parameterID,
			"callback": callback
		});
	},

	/**
	 *
	 * Will receive metadata from VPCA such as the parameters name, units it
	 * is using and the min/max values. Useful for setting up gauges or graphs
	 * in order to have them properly scaled to the parameters without hardcoding
	 * those values into the website.
	 *
	 * Date: June 30th, 2015
	 *
	 * @todo programming for this function
	 *
	 * @param parameterID {object} the ID of the parameter that we want the metadata for.
	 * @method RouteParameterMetadata
	 */
	RouteParameterMetadata: function(json) {
		var removeQueuerID = null;
		for (var queuer in this._awaitingMetadataResponse) {
			if (this._awaitingMetadataResponse[queuer].id == json.MGPM.MGPMID || this._awaitingMetadataResponse[queuer].id == json.MGPM.MGPMName) {
				removeQueuerID = queuer;
				this._awaitingMetadataResponse[queuer].callback(json);
			}
		}
		if (removeQueuerID !== null) {
			this._awaitingMetadataResponse.splice(removeQueuerID, 1);
		}
	},

	/**
	 * Pushes the group ID and the callback onto {{#crossLink "VPCA/_groupListeners:property"}}{{/crossLink}} so that it
	 * can be called when the proper response is received.
	 *
	 * Date: June 17th, 2015
	 *
	 * @param id The groups id, string or integer
	 * @param callback {function} The function to call when the response is received.
	 *                            It is reccomended to use a "this.function.bind(this)" if you wish to keep the proper usage of "this."
	 * @author Brady Dow (HED)
	 * @method RegisterGroupListener
	 */
	RegisterGroupListener: function(id, callback) {
		this._groupListeners.push({
			"id": id,
			"callback": callback
		});
	},

	/**
	 *
	 * Requests an update for the group specified by the id parameter.
	 *
	 * Date: June 30th, 2015
	 *
	 * @param id The groups id, string or integer
	 * @author Brady Dow (HED)
	 * @method GetParameterGroup
	 */
	GetParameterGroup: function(id) {
		var json = {
			"WGPG": id
		};
		this.Send(JSON.stringify(json));
	},

	GetParameterGroupMetadata: function(groupID, callback) {
		this.Send(JSON.stringify({
			"WGPMG": groupID
		}));

		this._awaitingMetadataResponse.push({
			"id": groupID,
			"callback": callback,
			"type": 'group'
		});
	},

	RouteParameterGroupMetadata: function(json) {
		json.MGPGM = (typeof json.MGPG == 'string') ? json.MGPG : json.MGPGM;
		var location = [];
		for (var parameter in this._awaitingMetadataResponse) {
			if (this._awaitingMetadataResponse[parameter].type == 'group' && this._awaitingMetadataResponse[parameter].id == json.MGPMG) {
				try {
					this._awaitingMetadataResponse[parameter].callback(json);
				} catch (e) {
					console.error(e);
				} finally {
					location.push(parameter);
				}
			}
		}
		for (var loc in location) {
			this._awaitingMetadataResponse.splice(location[loc], 1);
		}
	},

	/**
	 * Sends a push request for the specified group and adds the function passed
	 * to the callback argument to the {{#crossLink "VPCA/_groupListeners:property"}}{{/crossLink}} array.
	 *
	 * Date: June 30th, 2015
	 *
	 * @param id The groups id, string or integer
	 * @param callback {function} The function to call when the response is received.
	 *                            It is reccomended to use a "this.function.bind(this)" if you wish to keep the proper usage of "this."
	 * @author Brady Dow (HED)
	 * @method GroupPushRequest
	 */
	GroupPushRequest: function(groupID, maxRate, minRate) {
		var json = {
			"WPUSHG": {
				"WPUSHGID": String(groupID),
				"Minrate": String(minRate),
				"Maxrate": String(maxRate)
			}
		};
		this.Send(JSON.stringify(json));
	},

	// TODO: VERIFY THIS
	GroupPushResponse: function(json) {
		for (var listener in this._groupListeners) {
			if (this._groupListeners[listener].id == json.MPUSHG) {
				for (var value in json.Values) {
					this.RegisterParameter(json.Values[value].MPUSHP.MPUSHPID, this._groupListeners[listener].callback);
				}
			}
		}
	},

	ClearPushRequests: function() {
		this.Send(JSON.stringify({
			"WPUSHC": ""
		}));
	},

	RefreshPushRequests: function(immediate) {
		if (typeof immediate === 'undefined' || immediate === false) {
			if (this._refreshPushRequestsTimeout !== -1) {
				clearTimeout(this._refreshPushRequestsTimeout);
				this._refreshPushRequestsTimeout = -1;
			}
			this._refreshPushRequestsTimeout = setTimeout(this.RefreshPushRequests.bind(this, true), 1000);
		} else if (immediate === true) {
			if (this._refreshPushRequestsTimeout !== -1) {
				clearTimeout(this._refreshPushRequestsTimeout);
				this._refreshPushRequestsTimeout = -1;
			}
			this.ClearPushRequests();
			for (var pushSynchronizer in this._pushSynchronizers) {
				this._pushSynchronizers[pushSynchronizer]();
			}
		}
	},

	RegisterPushSynchronizer: function(callback) {
		if (callback instanceof Function) {
			this._pushSynchronizers.push(callback);
		}
	},

	/**
	 *
	 * Sets the server side message to the string "language"
	 * These languages must first be setup in the database.
	 *
	 * Date: June 30th, 2015
	 *
	 * @param language {string} the language to set the server to.
	 * @author Brady Dow (HED)
	 * @method SetLanguage
	 */
	SetLanguage: function(language) {
		this.Send({
			"WGLAN": String(language)
		});
	},

	/**
	 *
	 * Requests a list of all languages from the server.
	 *
	 * Date: June 30th, 2015
	 *
	 * @param callback {function} the callback to send the languages to.
	 * @author Brady Dow (HED)
	 * @method RequestLanguages
	 */
	RequestLanguages: function(callback) {
		this.Send({
			"WGLAN": "-1"
		});
		this._awaitingLanguageResponse.push({
			"callback": callback
		});
	},

	/**
	 *
	 * Requests server to perform a log flush.
	 *
	 * The log flush will make sure that all pending log entries are submitted
	 * to the logDB. This should be called before querying the DB.
	 *
	 * Date: August 11th, 2015
	 *
	 * @param callback {function} the callback to send the response code to.
	 * @author Brady Dow (HED)
	 * @method FlushLog
	 */
	FlushLog: function(callback) {
		this.Send({
			"WLOG": "1"
		});
		if (arguments.length > 0) {
			this._awaitingLogFlush.push({
				"callback": callback
			});
		}
	}
};

function initVPCA() {
	VPCA._SetupWebSocket.call(VPCA);
}

window.addEventListener("load", initVPCA, false);
window.addEventListener("beforeunload", VPCA.CloseSocket.bind(VPCA), false);
