/**
 * This is the master file for CanGroups. It can be extended for more customized
 * functionality but for now it will contain the framework needed to have an basic
 * group object.
 *
 * Date: June 17th, 2015
 * @class CanGroup
 */
function CanGroup(id) {
	this.id = id;

	this.registerGroupListener();
}

CanGroup.prototype = {
	/**
	 * Registers the objects listener with {{#crossLink "VPCA/RegisterGroupListener:method"}}{{/crossLink}}, this will allow VPCA to call
	 * the update function when a response is recieved for this group.
	 *
	 * Date: June 17th, 2015
	 * @method RegisterGroupListener
	 */
	registerGroupListener: function() {
		VPCA.RegisterGroupListener(this.id, this.update.bind(this));
	},

	/**
	 * Triggers VPCA to request the current parameter values for this group.
	 *
	 * Date: June 17th, 2015
	 * @method refresh
	 */
	refresh: function() {
		VPCA.GetParameterGroup(this.id);
	},

	/**
	 * Called by VPCA whenever it recieves a server response for this parameter/group
	 *
	 * Date: June 17th, 2015
	 * @param json {JSON Object} response from the server
	 * @method update
	 */
	update: function(json) {
		this.value = json.Values;
	},

	/**
	 * Registers this group as a push event. This means that periodic updates
	 * will be recieved automatically from the server.
	 *
	 * Date: June 17th, 2015
	 * @method registerPush
	 */
	registerPush: function() {
		VPCA.GroupPushRequest(this.id, 50, 1000);
	},

	/**
	 * Sets _values = to value and also will trigger a render to update the page
	 * with the new data.
	 *
	 * Date: June 17th, 2015
	 * @param value the value to be placed in _values
	 * @method set value
	 */
	set value(value) {
		this._values = value;
		this._render();
	},

	/**
	 * returns the value of this._values
	 * Date: June 17th, 2015
	 * @method get value
	 */
	get value() {
		return this._values;
	},

	/**
	 * sets this._name to name and calls a render to update the page
	 *
	 * Date: June 17th, 2015
	 * @param name
	 * @method set name
	 */

	set name(name) {
		this._name = name;
		this._render();
	},

	/**
	 * returns the value of this._name
	 *
	 * Date: June 17th, 2015
	 * @method get name
	 */
	get name() {
		return this._name;
	},

	/**
	 * updates the gauges with the values stored in this object
	 * Date: June 17th, 2015
	 * @method _render
	 */
	_render: function() {
		//if (this._HTMLObject === null) this.CreateHTMLObject();
		this.render();
	},

	render: function() {
		console.log("Render Called, no override");
	}
};
