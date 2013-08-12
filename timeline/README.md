# Timeline

### Overview

**Timeline** is the JS/CSS component to display events on a plane.

### API (The Very Initial Draft)

We present a history as a set of timeframes. Event amount could be pretty large, timeframes could be filled with events interactively as user scrolls by. One timeframe equals to 24 hours, although it is customizable.

###### Initialization

To begin using **Timeline**:

	var timeline = new Timeline(container, bindEventFunc);
	
`container` is a parent DOM node.

`bindEventFunc` is a function to add DOM event handlers. If you use jQuery, this function looks like:

	function(elem, event, handler) { 
		$(elem).on(event, handler); 
	}

---

###### .setBounds()

	timeline.setBounds({
		minTime:       intOrFunc,
		maxTime:       intOrFunc,
		minViewport:   numberOrFunc,
		maxViewport:   numberOrFunc,
		curViewport:   numberOfFunc,
		now:           intOrFunc,
		preloadBefore: intOrFunc,
		preloadAfter:  intOrFunc,
		autoUpdate:    intOrFunc
	});
	

| Key | Description | Units |
| --- | ----------- | ----- |
|`minTime`       | beginning point of the history | integer |
|`maxTime`       | ending point of the history | integer |
|`minViewport`   | represents minimum possible viewport size in timeframes | float |
|`maxViewport`   | represents maximum possible viewport size in timeframes | float |
|`curViewport`   | represents current viewport size in timeframes | float |
|`now`           | represents *now*, everything that's after *now* will be covered by semitransparent overlay | integer |
|`preloadBefore` | request this many timeframes before viewport position | integer |
|`preloadAfter`  | request this many timeframes after viewport position | integer |
|`autoUpdate`    | automatically call `getEvents` callback for current timeframes this many milliseconds since previous `timeline.push()` or `timeline.remove()` call | integer |

You can pass a function as a value of any key, this function will be called to retrieve the exact value.

---

###### .setCallbacks()

	timeline.setCallbacks({
		getEvents:          getEventsCallback,
		click:              clickCallback,
		getTimeByTimeframe: getTimeByTimeframeCallback,
		getTimeframeByTime: getTimeframeByTimeCallback
		getTicks:           getTicksCallback,
	});
	
| Callback | Description | Signature | Return value |
| -------- | ----------- |---------- | ------------ |
| `getEvents` | called when **Timeline** needs to retrieve events for a certain timeframe range | `getEventsCallback(timeFrom, timeTo)` | Not expected |
| `click`     | called when user has clicked on an event | `clickCallback(domEventObject, timelineEventId, markIndex)` | Not expected |
| `getTimeByTimeframe` | get timestamp by timeframe number | `getTimeByTimeframeCallback(timeframe)` | integer |
| `getTimeframeByTime` | get timeframe number for a timestamp | `getTimeframeByTimeCallback(time)` | integer |
| `getTicks`  | called when **Timeline** wants to create time ticks for certain timeframe | `getTicksCallback(timeFrom, timeTo)` | array of ticks, for example `[{left: '0%', label: '00:00'}, {left: '12.5%', label: '03:00'}, …]` |

In every callback `this` is pointing to the current **Timeline** object.

---

###### .push()

Add a set of events to current timeframes.

	timeline.push(
		timeFrom,
		timeTo,
		[
			{
				id:    string,
				title: string,
				begin: integer,
				end:   integer,
				marks: [integer, integer, …],
				color: colorId
			},
			…
		]
	);

Event object description:	

| Property | Description | Type |
| -------- | ----------- | ---- |
| `id`    | unique event identifier. If an event with this identifier has been pushed before, it will be updated | string |
| `title` | text label to display next to event's visual representation | string |
| `begin` | event beginning point timestamp | integer |
| `end`   | event ending point timestamp | integer |
| `marks` | an array of marks to display within this event | array of integers |
| `color` | color identifier | string |

---

###### .remove()

Remove a set of events with certain identifiers.

	timeline.remove([id, …]);

---

###### .error()

This method should be called on a failure of loading events for a certain time range.

	timeline.error(timeFrom, timeTo, errorMessage);

---

###### .position()

Returns or sets current viewport position.

	timeline.position();
	timeline.position(new Date().getTime());
