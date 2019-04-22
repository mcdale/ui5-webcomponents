import UI5Element from "@ui5/webcomponents-base/src/UI5Element.js";
import Bootstrap from "@ui5/webcomponents-base/src/Bootstrap.js";
import {
	isSpace,
	isUp,
	isDown,
	isEnter,
} from "@ui5/webcomponents-base/src/events/PseudoEvents.js";
import KeyCodes from "@ui5/webcomponents-core/dist/sap/ui/events/KeyCodes.js";
import ValueState from "@ui5/webcomponents-base/src/types/ValueState.js";
import Function from "@ui5/webcomponents-base/src/types/Function.js";
import Suggestions from "./Suggestions.js";
import Option from "./Option";

// Template
import SelectRenderer from "./build/compiled/SelectRenderer.lit.js";
import SelectTemplateContext from "./SelectTemplateContext.js";

// Styles
import selectCss from "./themes/Select.css.js";

/**
 * @public
 */
const metadata = {
	tag: "ui5-select",
	defaultSlot: "items",
	slots: /** @lends sap.ui.webcomponents.main.Select.prototype */ {

		/**
		 * Defines the <code>ui5-select</code> items.
		 * <br/><br/>
		 * <b>Note:</b> Only one selected item is allowed.
		 * If more than one item is defined as selected, the last one would be considered as the selected one.
		 * <br/><br/>
		 * <b>Note:</b> Use the <code>ui5-li</code> component to define the desired options.
		 * @type {Option[]}
		 * @slot
		 * @public
		 */
		items: {
			type: Option,
			multiple: true,
		},
	},
	properties: /** @lends  sap.ui.webcomponents.main.Select.prototype */  {

		/**
		 * Defines whether <code>ui5-select</code> is in disabled state.
		 * </br></br>
		 * <b>Note:</b> A disabled <code>ui5-select</code> is noninteractive.
		 *
		 * @type {boolean}
		 * @public
		 */
		disabled: {
			type: Boolean,
			defaultValue: false,
		},

		/**
		 * Defines the value state of <code>ui5-select</code>.
		 * Available options are: <code>None</code>, <code>Success</code>, <code>Warning</code> and <code>Error</code>.
		 *
		 * @type {string}
		 * @public
		 */
		valueState: {
			type: ValueState,
			defaultValue: ValueState.None,
		},

		_text: {
			type: String,
			defaultValue: "",
		},

		_opened: {
			type: Boolean,
			defaultValue: false,
		},

		_focused: {
			type: Boolean,
			defaultValue: false,
		},

		_fnClickSelectBox: {
			type: Function,
		},
	},
	events: /** @lends sap.ui.webcomponents.main.Select.prototype */ {
		/**
		 * Fired when the selected item changes.
		 *
		 * @event
		 * @param {HTMLElement} item the selected item.
		 * @public
		 */
		change: {
			detail: {
				selectedItem: {},
			},
		},
	},
};

/**
 * @class
 * <h3 class="comment-api-title"> Overview </h3>
 *
 * The <code>ui5-select</code> component is used to create a drop-down list.
 * The items inside the <code>ui5-select</code> define the available options by using the <code>ui5-li</code> component.
 *
 * <h3>Keyboard Handling</h3>
 * The <code>ui5-select</code> provides advanced keyboard handling.
 * If the <code>ui5-select</code> is focused,
 * you can open or close the drop-down by pressing <code>F4</code>, <code>ALT+UP</code> or <code>ALT+DOWN</code> keys.
 * Once the drop-down is opened, you can use the <code>UP</code> and <code>DOWN</code> arrow keys
 * to navigate through the available options and select one by pressing the <code>Space</code> or <code>Enter</code> keys.
 * <br>
 * <h3>ES6 Module Import</h3>
 * <code>import "@ui5/webcomponents/dist/Select";</code>
 * @constructor
 * @author SAP SE
 * @alias sap.ui.webcomponents.main.Select
 * @extends sap.ui.webcomponents.base.UI5Element
 * @tagname ui5-input
 * @public
 * @since 0.8.0
 */
class Select extends UI5Element {
	static get metadata() {
		return metadata;
	}

	static get renderer() {
		return SelectRenderer;
	}

	static get calculateTemplateContext() {
		return SelectTemplateContext.calculate;
	}

	static get styles() {
		return selectCss;
	}

	constructor() {
		super();

		this._closing = false; // Flag for handling open/close on space
		this._setSelectedItem(null);
		this._setPreviewedItem(null);
		this.Suggestions = new Suggestions(this, "items", true /* move focus with arrow keys */);
		this._fnClickSelectBox = this.toggleList.bind(this);
	}

	onBeforeRendering() {
		this._validateSelection();
	}

	/* Event handling */
	toggleList() {
		if (this.disabled) {
			return;
		}

		this.Suggestions.toggle();
	}

	onkeydown(event) {
		if (this.disabled) {
			return;
		}

		if (isUp(event)) {
			this.Suggestions.onUp(event);
			this._changeSelectionWhileClosed();
		}

		if (isDown(event)) {
			this.Suggestions.onDown(event);
			this._changeSelectionWhileClosed();
		}

		if (isSpace(event)) {
			if (!this._isOpened()) {
				this._closing = true;
				return event.preventDefault();
			}
			this._closing = false;
			return this.Suggestions.onSpace(event);
		}

		if (isEnter(event)) {
			this.Suggestions.onEnter(event);
		}

		const key = event.which;

		if (key === KeyCodes.F4 || (event.altKey && Select.ARROWS.includes(key))) {
			event.preventDefault();
			this.Suggestions.toggle();
		}
	}

	onkeyup(event) {
		if (isSpace(event)) {
			return this.Suggestions.toggle(this._closing); // Open Suggestions
		}
	}

	onfocusin(event) {
		this._focused = true; // invalidating property
	}

	onfocusout(event) {
		this._focused = false; // invalidating property
	}

	/* Suggestions Interface methods */
	onItemFocused() {}

	onItemSelected(item) {
		if (this._getSelectedItem() === item) {
			return;
		}

		this._select(item);
		this._fireChange(item);
	}

	onItemPreviewed(item) {
		this._setPreviewedItem(item);
		this._setText(item.textContent);
	}

	onOpen() {
		this._opened = true;// invalidating property
	}

	onClose() {
		this._opened = false;// invalidating property

		if (this._isSelectionChanged()) {
			const previewedItem = this._getPreviewedItem();
			this._fireChange(previewedItem);
		}
	}

	/* Private methods */
	_validateSelection() {
		if (this._isOpened()) {
			return;
		}

		let selectedItem = null;
		let selectedItemPos = null;

		this.items.forEach((item, idx) => {
			if (item.selected) {
				if (selectedItem) {
					selectedItem.selected = false;
				}
				selectedItem = item;
				selectedItemPos = idx;
			}
		});

		if (this._getSelectedItem() !== selectedItem) {
			this._select(selectedItem, selectedItemPos);
		}
	}

	_isSelectionChanged() {
		const previewedItem = this._getPreviewedItem();
		const selectedItem = this._getSelectedItem();

		return previewedItem && selectedItem !== previewedItem;
	}

	_select(item, position) {
		const selectedItem = this._getSelectedItem();

		if (selectedItem) {
			selectedItem.selected = false;
		}

		this._setSelectedItem(item);
		this._setPreviewedItem(null);
		this._setText(item.textContent);

		if (position !== undefined) {
			this._updateSelectedItemPos(position);
		}
	}

	_changeSelectionWhileClosed() {
		if (this.items.length > 1 && !this._opened) {
			this._select(this._getPreviewedItem());
			this._fireChange(this._getSelectedItem());
		}
	}

	_setSelectedItem(item) {
		if (item) {
			item.selected = true;
		}
		this._selectedItem = item;
	}

	_getSelectedItem() {
		return this._selectedItem;
	}

	_setPreviewedItem(item) {
		this._previewedItem = item;
	}

	_getPreviewedItem() {
		return this._previewedItem;
	}

	_setText(text) {
		if (this.text !== text) {
			this._text = text; // invaldiating property
		}
	}

	_updateSelectedItemPos(position) {
		this.Suggestions.updateSelectedItemPosition(position);
	}

	_isOpened() {
		return this.Suggestions.isOpened();
	}

	_fireChange(item) {
		this.fireEvent("change", { selectedItem: item });
	}

	static async define(...params) {
		await Option.define();

		super.define(...params);
	}
}

Select.ARROWS = [KeyCodes.ARROW_DOWN, KeyCodes.ARROW_UP];

Bootstrap.boot().then(_ => {
	Select.define();
});

export default Select;
