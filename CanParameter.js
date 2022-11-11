/**
 * This is the master file for can parameters. It can be extended for more customized
 * functionality but for now it will contain the framework needed to have an basic
 * can parameter objects.
 * 
 * Date: July 23rd, 2015
 * @class CanParameter
 * @constructor
 * 
 * @param id The CAN Parameter's ID as specified in the VPCA database.
 * @param options A JSON object of options for customizing the can parameter. (Optional)
 * 
 * 		Options object holds three fields: 
 * 			requestMetadata: true by default, false will not get metadata from the VPCA server allowing you to set your own on the webpage.
 * 			refresh: true by default, false will prevent the initial refresh that gets the first value for the CAN Parameter.
 * 			push: which when true will enable the VPCA server to push data for CAN Parameter.
 */
function CanParameter(id, options) {
	this._id = id;

	this.registerParameter();

	var optionsPresent = (typeof options === 'undefined') ? false : true;

	if (optionsPresent === false || typeof options.requestMetadata === 'undefined' || options.requestMetadata === true) this.RequestMetadata();
	if (optionsPresent === false || typeof options.refresh === 'undefined' || options.refresh === true) this.refresh();
	if (optionsPresent === true && options.push === true) setTimeout(this.registerPush.bind(this), 1000);

	this._name = (optionsPresent && options.name !== 'undefined') ? options.name : 'NotSet';
	this._units = (optionsPresent && options.units !== 'undefined') ? options.units : 'NotSet';
	this._min = (optionsPresent && options.min !== 'undefined') ? options.min : null;
	this._max = (optionsPresent && options.max !== 'undefined') ? options.max : null;



	/**
	 * This is the private holder for the current value. This uses get and set
	 * methods in order to allow the UIElement to trigger a render when this
	 * value is written to. The data contained is not modified by the UIElement
	 * object except for what is defined within the render and click methods of
	 * the elements.
	 *
	 * @type Object
	 * @property value
	 */
	this._value = null;

	this._HTMLObject = null;

	this._deregistration = {};

	this._refreshTimeoutID = -1;

	this._timestamp = null;

	this.timestampChanged = false;

}
CanParameter.prototype = {
	
	/**
	 * The maximum time in between push responses (in ms).
	 * 
	 * @author Brady Dow (HED)
	 * @property PUSH_MAX_DELAY
	 */	
	//PUSH_MAX_DELAY: 10000,
	PUSH_MAX_DELAY: 100,
	
	/**
	 * The minimum time in between push responses (in ms).
	 * 
	 * @author Brady Dow (HED)
	 * @property PUSH_MIN_DELAY
	 */	
	PUSH_MIN_DELAY: 50,

	/**
	 * Acts as a receiver for the metadata and sorts it out into the appropriate places
	 *
	 * @author Brady Dow (HED)
	 * @method recieveMetadata
	 */
	receiveMetadata: function(json) {
		this.name = json.MGPM.MGPMName;
		this.units = json.MGPM.UnitsStr;
		this.min = json.MGPM.Min;
		this.max = json.MGPM.Max;
		this.id = json.MGPM.MGPMID;

		this.refresh();
	},

	registerParameter: function() {
		if (!this._registered) {
			this.callbackHook = VPCA.RegisterParameter(this.id, this.update.bind(this));
			this._registered = true;
		}
		//VPCA.GetParameterMetadata(this.id, this.updateMetadata.bind(this));
	},

	/**
	 * Initiate a manual refresh of the CAN parameter. 
	 * @method refresh
	 */
	refresh: function() {
		VPCA.GetParameter(this.id);
	},
	
	/**
	 * Get the metadata for the CAN parameter.
	 * @method RequestMetadata
	 */
	RequestMetadata: function() {
		VPCA.RequestParameterMetadata(this.id, this.receiveMetadata.bind(this));
	},
	
	/**
	 * Update the CAN parameter's values with the values given in "json"
	 * @param json The JSON that is returned from the VPCA server. 
	 * @method update
	 */
	update: function(json) {
		this.value = (typeof json.MGP.MGPVals != 'undefined') ? JSON.stringify(json.MGP.MGPVals[0]) : (json.MGP.Eval) ? json.MGP.Eval : json.MGP.ParamVal;
		this.timestamp = json.MGP.Timestamp;
		this.name = json.MGP.MGPName; // TODO: Take this out, maybe. Don't break stuff
	},

	/**
	 * Register this CAN parameter to receive push requests from VPCA.
	 * @param maxRate The maximum rate at wich the CAN parameter should be updated (lower bound).
	 * @param minRate The minimum rate at wich the CAN parameter should be updated (upper bound).
	 * @method registerPush
	 */
	registerPush: function(maxRate, minRate) {
		if (arguments.length == 2) {
			VPCA.PushRequest(this.id, maxrate, minRate, this.update.bind(this));
		} else {
			VPCA.PushRequest(this.id, this.PUSH_MIN_DELAY, this.PUSH_MAX_DELAY, this.update.bind(this)); 
		}
	},

	/**
	 * Send/Set a new value for the CAN Parameter. This will send the value that is passed in to the 
	 * VPCA server.
	 * @param value The new value for the CAN Parameter.
	 * @method send
	 */
	send: function(value) {
		if (typeof value !== 'undefined') {
			VPCA.SendParameter(this.id, 1, value);
		} else if (typeof this.newValue != 'undefined' && this.newValue !== this.value) {
			VPCA.SendParameter(this.id, 1, this.newValue);
		} else {
			VPCA.SendParameter(this.id, 1, this.value);
		}
	},
	
	/**
	 * Set logic for the CAN Parameter's timestamp. If the timestamp is changed then it will set the
	 * timestampChanged property to true. This is used to know if the VPCA server has actually 
	 * received a new value from the CANBus or if it is just echoing the same value as we last
	 * received. 
	 * @param value The timestamp. 
	 * @method timestamp
	 */
	set timestamp(value) {
		timestampChanged = false;
		if(this._timestamp !== null && this._timestamp != value) timestampChanged = true;
		this._timestamp = value;
		this.timestampChanged = timestampChanged;
	},

	/**
	 * Gets the _timestamp property.
	 * @method timestamp
	 * @return {Object} timestamp of the last update to the CAN Parameter
	 */
	get timestamp() {
		return this._timestamp;
	},

	/**
	 * Set logic for the CAN Parameter's value. Every time the value is updated it will call the
	 * render() function of the CAN Parameter. If there is a function set to the valueUpdate 
	 * hook that will be called too.
	 * @param value The CAN Parameter's new value. 
	 * @method value
	 */
	set value(value) {
		this._value = value;
		this.render();

		if(this.valueUpdate instanceof Function) this.valueUpdate(value);
	},
	
	/**
	 * Gets the CAN Parameter's current value.
	 * @method value
	 * @return {Object} the CAN Parameter's current value.
	 */
	get value() {
		return this._value;
	},
	
	/**
	 * Sets the CAN Parameter's _name property and calls the render() function. If the nameUpdate()
	 * function/hook is set then that will be called with the name as the only parameter.
	 * @param name The CAN Parameter's new name. 
	 * @method name
	 */
	set name(name) {
		this._name = name;
		this.render();

		if(this.nameUpdate instanceof Function) this.nameUpdate(name);
	},
	

	/**
	 * Gets the CAN Parameter's _name property.
	 * @method name
	 * @return {Object} The CAN Parameter's name.
	 */
	get name() {
		return this._name;
	},
	

	/**
	 * Gets the CAN Parameter's _units property.
	 * @method units
	 * @return {Object} The CAN Parameter's Units
	 */
	get units() {
		return this._units;
	},
	
	/**
	 * Sets the CAN Parameter's _units property and calls the render() function. If the unitsUpdate()
	 * function/hook is set then that will be called with the unit as the only parameter.
	 * @param value The CAN Parameter's new unit. 
	 * @method units
	 */
	set units(value) {
		this._units = value;
		this.render();

		if(this.unitsUpdate instanceof Function) this.unitsUpdate(units);
	},
	
	/**
	 * Get's the minimum value allowed to be set for this CAN Parameter. 
	 * @method min
	 * @return {Object} The minimum allowed value for the CAN Parameter.
	 */
	get min() {
		return this._min;
	},
	
	/**
	 * Sets the CAN Parameter's minimum value and calls the render() function. If the minUpdate()
	 * function/hook is set then that will be called with the minimum value as the only parameter.
	 * @param value The CAN Parameter's new minimum value. 
	 * @method min
	 */
	set min(value) {
		this._min = parseInt(value, 10);
		this.render();

		if(this.minUpdate instanceof Function) this.minUpdate(min);
	},

	/**
	 * Get's the maximum value allowed to be set for this CAN Parameter.
	 * @method max
	 * @return {Object} The maximum allowed value for the CAN Parameter.
	 */
	get max() {
		return this._max;
	},
	
	/**
	 * Sets the CAN Parameter's maximum value and calls the render() function. If the maxUpdate()
	 * function/hook is set then that will be called with the maximum value as the only parameter.
	 * @param value The CAN Parameter's new maximum value. 
	 * @method max
	 */
	set max(value) {
		this._max = parseInt(value, 10);
		this.render();

		if(this.maxUpdate instanceof Function) this.maxUpdate(max);
	},
	
	/**
	 * Get's the CAN Parameter's ID.
	 * @method id
	 * @return The CAN Parameter's ID.
	 */
	get id() {
		return this._id;
	},
	
	/**
	 * Sets the CAN Parameter's ID and calls the render() function. If the idUpdate()
	 * function/hook is set then that will be called with the ID as the only parameter.
	 * @param value The CAN Parameter's new ID. 
	 * @method id
	 */
	set id(value) {
		this._id = value;
		if (typeof this.callbackHook !== 'undefined') this.callbackHook.paramID = this._id;

		if(this.idUpdate instanceof Function) this.idUpdate(id);
	},

	/**
	 * Override this function in order to render your CAN Parameter object on the page.
	 * This will be called whenever any of the CAN Parameter's data is changed. To detect
	 * changes on certain data there are functions that you can override such as "valueUpdate()".
	 * @method render
	 */
	render: function() {
		//console.log('Render function not yet overridden');
	},
	
	/**
	 * Destroys the CAN Parameter's HTML element.
	 * 
	 * Future: Should tell VPCA.js to remove references to this parameter and then delete itself
	 * from memory. 
	 * 
	 * @method destroy
	 */
	destroy: function() {
		this._HTMLObject.parentNode.removeChild(this._HTMLObject);
		this._HTMLObject = null;
	},
	/*
	//TODO create comment block for
	CreateHTMLObject: function() {

	},
	*/
	/**
	 * Used to setup a delayed refresh. The delay should be sent as milliseconds, if a timer 
	 * already exists it will be canceled and a new timer will be created with the new delay.
	 * @param millis The delay time, in milliseconds, to wait before issuing the refresh.
	 * @method refreshTimer
	 */
	RefreshTimer: function(millis) {
		if (this._refreshTimeoutID !== -1) {
			clearInterval(this._refreshTimeoutID);
		}
		this._refreshTimeoutID = setTimeout(this.refresh.bind(this), (arguments.length > 0) ? millis : 1000); //If a time is passed via parameter use that, else default to 1 second
	}
};
