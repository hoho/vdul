# Timeline
==========

### Overview

**Timeline** is the CSS/JS component to display events on a plane.

### API (The Very Initial Draft)

We present history as a set of timeframes. Events amount could be pretty large, timeframes could be filled with events interactively as user scrolls. All the timeframes are of visually equal width, but each timeframe could cover it's own real period (see `getTicks` callback).

###### Initialization

To begin using **Timeline**:

	var timeline = new Timeline(container);
	
`container` is a parent DOM node.

---

###### .setBounds()

	timeline.setBounds({
		minTimeframe:  intOrFunc,
		maxTimeframe:  intOrFunc,
		minViewport:   numberOrFunc,
		maxViewport:   numberOrFunc,
		curViewport:   numberOfFunc,
		position:      numberOrFunc,
		now:           numberOrFunc,
		preloadBefore: intOrFunc,
		preloadAfter:  intOrFunc,
		autoUpdate:    intOrFunc
	});
	

| Key | Description | Units |
|---------------------------|
|`minTimeframe`| beginning point of the history | integer |
|`maxTimeframe`| ending point of the history | integer |
|`minViewport` | represents the minimum possible size of viewport | float |
|`maxViewport` | represents the maximum possible size of viewport | float |
|`curViewport` | represents current viewport size | float |
|`position`    | current viewport position | float (between `minTimeframe` and  `maxTimeframe`) |
|`now`         | represents *now*, everything that's after this will be covered by semitransparent overlay | float (between `minTimeframe` and  `maxTimeframe`) |
|`preloadBefore`   | request this many timeframes before viewport position | integer |
|`preloadAfter`    | request this many timeframes after viewport position | integer |
|`autoUpdate`      | automatically call `getEvents` callback for current timeframes this many milliseconds since previous `timeline.push()` or `timeline.remove()` call | integer |

You can pass a function as a value of any key, this function will be called to retrieve exact value.

---

###### .setCallbacks()

	timeline.setCallbacks({
		getEvents: getEventsCallback,
		getTicks:  getTicksCallback,
		click:     clickCallback
	});
	
| Callback | Description | Signature | Return value |
|------------------------------------|--------------|
| `getEvents` | called when **Timeline** needs to retrieve events for a certain timeframe range | `getEventsCallback(timeframeFrom, timeframeTo)` | Not expected |
| `getTicks`  | called when **Timeline** wants to create time ticks for certain timeframe | `getTicksCallback(timeframeNumber)` | Array of labels, for example `[00:00, 03:00, 06:00, ...]` |
| `click`     | called when user has clicked on an event | `clickCallback(domEventObject, timelineEventId)` | Not expected |

In every callback `this` is pointing to the current **Timeline** object.
	
---

###### .push()

Add a set of events for certain timeframe range.

	timeline.push(
		timeframeFrom, 
		timeframeTo, 
		[
			{
				id:    string,
				title: string,
				begin: number,
				end:   number,
				marks: [number, number, …],
				color: colorId
			},
			…
		]
	);

Event object description:	

| Property | Description | Type |
|-------------------------------|
| `id`    | unique event identifier. If an event with this identified has been pushed before, it will be updated | string |
| `title` | text label to display next to event's visual representation | string |
| `begin` | beginning point of an event | float |
| `end`   | ending point of an event | float |
| `marks` | an array of marks to display within this event | array of floats |
| `color` | color identifier | string |

---

###### .remove()

Remove a set of events with certain identifiers.

	timeline.remove([id, …]);

---

###### .error()

This method should be called on a failure of loading events for certain timeframe range.

	timeline.error(timeframeFrom, timeframeTo);

