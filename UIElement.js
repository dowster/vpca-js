// TODO: CAN Parameter Integration
/**
 * Class for handling UI Elements and their interactions to the CAN parameters
 * An UI Element object can consist of one single HTML element or a collection of HTML elements,
 * depending on how many are needed to fulfill the duties of the CAN Parameter.
 * Date: July 13th, 2015
 * @class UIElement
 * @extends CanParameter
 * 
 * @constructor
 * @param paramID The CAN Parameter's ID as specified in the VPCA database.
 * @param viewObjects JSON data to set handlers for DOM events on the Parameter's html entities. 
 * 
 * 
 * @param options The JSON object of options as specified by the CanParameter class. 
 */
function UIElement(paramID, viewObjects, options) {
	CanParameter.call(this, paramID, options);
	this.viewObjects = viewObjects;
	for (var count in this.viewObjects) {
		if ("click" in this.viewObjects[count]) {
			if (this.viewObjects[count].HTMLObject instanceof HTMLElement) {
				this.viewObjects[count].HTMLObject.onclick = this.viewObjects[count].click.bind(this, this.viewObjects[count].HTMLObject);
			} else if (typeof kendo != 'undefined' && this.viewObjects[count].HTMLObject instanceof kendo.Class) {
				this.viewObjects[count].HTMLObject.bind("click", this.viewObjects[count].click.bind(this, this.viewObjects[count].HTMLObject));
			} else if (typeof jQuery != 'undefined' && this.viewObjects[count].HTMLObject instanceof jQuery) {
				this.viewObjects[count].HTMLObject.bind("click", this.viewObjects[count].click.bind(this, this.viewObjects[count].HTMLObject));
			}
		}
		if ("change" in this.viewObjects[count]) {
			if (typeof jQuery !== 'undefined' && this.viewObjects[count].HTMLObject instanceof jQuery) {
				this.viewObjects[count].HTMLObject.bind("change", this.viewObjects[count].change.bind(this, this.viewObjects[count].HTMLObject));
			} else if (this.viewObjects[count].HTMLObject instanceof HTMLElement) {
				this.viewObjects[count].HTMLObject.onChange = this.viewObjects[count].change.bind(this, this.viewObjects[count].HTMLObject);
			}
		}
		if ("bind" in this.viewObjects[count]) {
			if (typeof jQuery !== 'undefined') {
				for (var event in this.viewObjects[count].bind) {
					$(this.viewObjects[count].HTMLObject).bind(event, this.viewObjects[count].bind[event].bind(this, this.viewObjects[count].HTMLObject));
				}
			} else if (typeof jQuery === 'undefined') {
				console.error('UIElements are unable to use the "bind:{event:}" syntax without jQuery. Please follow the call stack and remediate. You may notice that some event triggers are not engaging, this errorr is why!');
			}
		}
	}


}

UIElement.prototype = Object.create(CanParameter.prototype);
UIElement.prototype.constructor = UIElement;


/**
 * The default render for UIElements. This will loop through all of the viewObjects that are assigned to this element and call their render methods.
 */
UIElement.prototype.render = function() {
	for (var count in this.viewObjects) {
		if (this.viewObjects[count].render instanceof Function) {
			this.viewObjects[count].render.call(this, this.viewObjects[count].HTMLObject);
		}
	}
};
