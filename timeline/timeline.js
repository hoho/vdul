(function(window, undefined) {
    'use strict';

    var T,
        emptyFunc = function() {},
        isUndefined = function(val) { return typeof val === 'undefined'; },
        isFunction = function(val) { return typeof val === 'function'; },

        _24hours = 86400000,
        defaultTicks = [
            {left: '0',     label: '00:00'},
            {left: '12.5%', label: '03:00'},
            {left: '25%',   label: '06:00'},
            {left: '37.5%', label: '09:00'},
            {left: '50%',   label: '12:00'},
            {left: '62.5%', label: '15:00'},
            {left: '75%',   label: '18:00'},
            {left: '87.5%', label: '21:00'}
        ],

        months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],

        css = function(elem, props) {
            var style = elem.style,
                prop,
                val;

            for (prop in props) {
                val = props[prop];
                // TODO: Add 'px' suffix to a certain properies only (left,
                //       width and so on).
                style[prop] = val + (typeof val === 'number' ? 'px' : '');
            }
        };

    T = window.Timeline = function(container) {
        var self = this,
            resizeTimer;

        self.bounds = {
            minTime:       0,
            maxTime:       0,
            minViewport:   1,
            maxViewport:   1,
            curViewport:   1,
            position:      undefined,
            now:           undefined,
            preloadBefore: 1,
            preloadAfter:  1,
            autoUpdate:    false
        };

        self._timeframes = {};
        self._events = {};

        self._elem = $C(container, true)
            .div({'class': 'b-timeline'})
                .div({'class': 'b-timeline__timeframes'})
                    .act(function() { self._timeframesElem = this; })
        .end(3);

        window.addEventListener('resize', function() {
            if (resizeTimer) {
                window.clearTimeout(resizeTimer);
            }

            resizeTimer = window.setTimeout(function() {
                self._positionTimeframes();
                self._positionEvents(true);
                resizeTimer = null;
            }, 100);
        });

        container.addEventListener('click', function(e) {
            if ((e.toElement.className || '').indexOf('b-timeline__event-overlay') >= 0) {
                var id = e.toElement.getAttribute('data-id');

                if (id) {
                    self._click(id);
                }
            }
        });
    };


    T.EVENT_HEIGHT = 30;
    T.EVENT_HSPACING = 30;
    T.EVENT_VSPACING = 5;
    T.LETTER_WIDTH = 7.5;


    T.prototype = {
        setBounds: function(bounds) {
            var cur = this.bounds,
                b,
                key;

            for (key in cur) {
                if (!isUndefined(b = bounds[key])) {
                    cur[key] = b;
                }
            }
        },

        setCallbacks: function(callbacks) {
            var names = ['getEvents', 'getTimeByTimeframe',
                         'getTimeframeByTime', 'getTicks',
                         'click'],
                i,
                name,
                func;

            for (i = 0; i < names.length; i++) {
                if (isFunction(func = callbacks[name = names[i]])) {
                    this['_' + name] = func;
                }
            }
        },

        push: function(events) {
            var i, j,
                event,
                newEvent,
                unadopted = [],
                clearMarks;

            for (i = 0; i < events.length; i++) {
                event = events[i];

                if (isUndefined(event.begin) && isUndefined(event.end)) {
                    continue;
                }

                newEvent = {
                    id:         event.id,
                    title:      event.title || '',
                    begin:      isUndefined(event.begin) ? event.end : event.begin,
                    end:        event.end,
                    marks:      Array.prototype.slice.call(event.marks || [], 0),
                    color:      event.color,
                    row:        undefined,
                    tbegin:     undefined,
                    tend:       undefined,
                    elem1:      undefined,
                    elem2:      undefined,
                    positioned: false,
                    left:       undefined
                };

                if (event = this._events[newEvent.id]) {
                    this._removeEvent(newEvent.id, true);

                    newEvent.row = event.row; // We need to keep the row.

                    // Event's DOM nodes are already created, no need to create
                    // them again.
                    newEvent.elem1 = event.elem1;
                    css(newEvent.elem1, {background: newEvent.color || ''});

                    if (newEvent.marks.length === event.marks.length) {
                        for (j = 0; j < newEvent.marks.length; j++) {
                            if (newEvent.marks[j] !== event.marks[j]) {
                                clearMarks = true;
                                break;
                            }
                        }
                    } else {
                        clearMarks = true;
                    }

                    if (clearMarks) {
                        // Remove all the marks because they have changed.
                        newEvent.elem1.innerHTML = '';
                    }

                    newEvent.elem2 = event.elem2;
                }

                unadopted.push(newEvent);
            }

            this._adoptEvents(unadopted);
            this._scheduleUpdate();
        },

        remove: function(eventIds) {
            var i,
                id;

            for (i = 0; i < eventIds.length; i++) {
                id = eventIds[i];

                if (this._events[id]) {
                    this._removeEvent(id);
                }
            }

            this._scheduleUpdate();
        },

        error: function() {
            this._scheduleUpdate();
        },

        position: function(pos) {
            if (isUndefined(pos)) {
                return this._position;
            } else {
                this._position = pos;
                this.update();
                this._scheduleUpdate();
            }
        },

        update: function(updateCurrent) {
            var key,
                self = this,
                bounds = self.bounds,
                val,
                evaluatedBounds = {},
                pos,
                timeFrom,
                timeTo,
                timeframeFrom,
                timeframeTo,
                i,
                unadopted = [];

            for (key in bounds) {
                evaluatedBounds[key] = isFunction(val = bounds[key]) ? val() : val;
            }

            // TODO: Check values.
            self._bounds = evaluatedBounds;

            if (self._getTimeframeByTime(self._position) > (pos = self._getTimeframeByTime(evaluatedBounds.maxTime) - evaluatedBounds.curViewport)) {
                self._position = self._getTimeByTimeframe(pos);
            }

            if (self._position < evaluatedBounds.minTime) {
                self._position = evaluatedBounds.minTime;
            }

            pos = self._getTimeframeByTime(isUndefined(self._position) ? evaluatedBounds.minTime : self._position);

            timeFrom = self._getTimeByTimeframe(Math.floor(pos - evaluatedBounds.preloadBefore));
            timeTo = self._getTimeByTimeframe(Math.ceil(pos + evaluatedBounds.curViewport + evaluatedBounds.preloadAfter));

            if (timeFrom < evaluatedBounds.minTime) {
                timeFrom = evaluatedBounds.minTime;
            }

            if (timeTo > evaluatedBounds.maxTime) {
                timeTo = evaluatedBounds.maxTime;
            }

            self._cancelUpdate();

            if (!updateCurrent) {
                timeframeFrom = self._getTimeframeByTime(timeFrom);
                timeframeTo = self._getTimeframeByTime(timeTo);

                for (i = timeframeFrom; i < timeframeTo; i++) {
                    self._addTimeframe(i);
                }

                if (!isUndefined(self._timeframeFrom)) {
                    for (i = self._timeframeFrom; i < timeframeFrom; i++) {
                        self._removeTimeframe(i, unadopted);
                    }

                    for (i = timeframeTo; i < self._timeframeTo; i++) {
                        self._removeTimeframe(i, unadopted);
                    }
                }

                self._timeframeFrom = timeframeFrom;
                self._timeframeTo = timeframeTo;

                self._positionTimeframes();
                self._adoptEvents(unadopted);

                if (!(val = self._getMissingTime())) {
                    return;
                }

                timeFrom = val.timeFrom;
                timeTo = val.timeTo;

                for (i = val.timeframeFrom; i < val.timeframeTo; i++) {
                    this._timeframes[i].requested = true;
                }
            } else {
                self._positionTimeframes();
            }

            self._getEvents(timeFrom, timeTo);
        },

        _scheduleUpdate: function() {
            var self = this,
                autoUpdate;

            self._cancelUpdate();

            if (self._bounds && (autoUpdate = self._bounds.autoUpdate) && autoUpdate > 0) {
                self._timer = window.setTimeout(function() {
                    self._timer = null;
                    self.update(true);
                }, autoUpdate);
            }
        },

        _cancelUpdate: function() {
            if (this._timer) {
                window.clearTimeout(this._timer);
                this._timer = null;
            }
        },

        _addTimeframe: function(timeframe) {
            if (isUndefined(this._timeframes[timeframe])) {
                var t = this._timeframes[timeframe] = {events: {}, unfinished: {}},
                    timeFrom = this._getTimeByTimeframe(timeframe),
                    timeTo = this._getTimeByTimeframe(timeframe + 1);

                $C(this._timeframesElem)
                    .div({'class': 'b-timeline__timeframe'})
                        .act(function() { t.elem = this; })
                        .each(this._getTicks(timeFrom, timeTo))
                            .div({'class': 'b-timeline__tick', style: {left: function(index, item) { return item.left; }}})
                                .span()
                                    .text(function(index, item) { return item.label; })
                        .end(3)
                        .div({'class': 'b-timeline__events-wrapper'})
                            .div({'class': 'b-timeline__events'})
                                .act(function() { t.eventsElem = this; })
                                .div({'class': 'b-timeline__future-overlay'})
                                    .act(function() { t.futureElem = this; })
                .end(5);
            }
        },

        _removeTimeframe: function(timeframe, unadopted) {
            var t = this._timeframes[timeframe],
                id;

            if (t) {
                for (id in t.events) {
                    unadopted.push(this._events[id]);
                }

                this._timeframesElem.removeChild(t.elem);

                delete this._timeframes[timeframe];
            }
        },

        _removeEvent: function(id, keepInDOM) {
            var event = this._events[id],
                timeframe;

            if (event) {
                delete this._events[id];

                timeframe = this._timeframes[event.timeframe];
                delete timeframe.events[id];
                delete timeframe.unfinished[id];

                if (!keepInDOM) {
                    timeframe.eventsElem.removeChild(event.elem1);
                    timeframe.eventsElem.removeChild(event.elem2);
                }
            }
        },

        _getTimeframeWidth: function() {
            return Math.ceil(this._timeframesElem.clientWidth * (1 / this._bounds.curViewport));
        },

        _adoptEvents: function(events) {
            if (events.length) {
                var i,
                    tmp,
                    event,
                    timeFrom,
                    timeTo,
                    timeframeFrom,
                    timeframeTo,
                    timeframeWidth = this._getTimeframeWidth(),
                    timeframe,
                    hspacing = T.EVENT_HSPACING / timeframeWidth,
                    letterWidth = T.LETTER_WIDTH / timeframeWidth;

                for (i = 0; i < events.length; i++) {
                    event = events[i];

                    // Get timeframes this event goes through.
                    timeframeFrom = this._getTimeframeByTime(event.begin);
                    timeframeTo = event.begin === event.end ?
                        timeframeFrom
                        :
                        this._getTimeframeByTime(isUndefined(event.end) ? this._bounds.maxTime : event.end);

                    if (timeframeTo < this._timeframeFrom || timeframeFrom >= this._timeframeTo) {
                        // Event is out of current timeframes, skip it.
                        continue;
                    }

                    // Getting event's parent timeframe.
                    tmp = Math.round((timeframeFrom + timeframeTo) / 2);
                    event.timeframe = timeframe = tmp < this._timeframeFrom ?
                        this._timeframeFrom
                        :
                        tmp >= this._timeframeTo ?
                            this._timeframeTo - 1
                            :
                            tmp;
                    timeframe = this._timeframes[timeframe];

                    // Getting event's left position in timeframes.
                    timeFrom = this._getTimeByTimeframe(timeframeFrom);
                    timeTo = this._getTimeByTimeframe(timeframeFrom + 1);
                    event.tbegin = timeframeFrom + (event.begin - timeFrom) / (timeTo - timeFrom);

                    if (!isUndefined(event.end)) {
                        // Getting event's right position.
                        if (event.begin === event.end) {
                            // It's a point event.
                            event.tend = event.tbegin;
                            event.tend2 = event.tbegin + event.title.length * letterWidth + hspacing;
                        } else {
                            // It's an interval.
                            timeFrom = this._getTimeByTimeframe(timeframeTo);
                            timeTo = this._getTimeByTimeframe(timeframeTo + 1);
                            event.tend = timeframeTo + (event.end - timeFrom) / (timeTo - timeFrom);
                            event.tend2 = event.tbegin + event.title.length * letterWidth + hspacing;

                            if (event.tend2 - event.tend < hspacing) {
                                event.tend2 = event.tend + hspacing;
                            }
                        }
                    }

                    // Adding this event to timeframe's events and to
                    // Timeline._events.
                    timeframe.events[event.id] = true;

                    if (isUndefined(event.end)) {
                        timeframe.unfinished[event.id] = true;
                    }

                    this._events[event.id] = event;

                    // Appending event's DOM nodes to timeframe's events
                    // container.
                    tmp = timeframe.eventsElem;

                    if (event.elem1) {
                        // DOM nodes are already created.
                        tmp.appendChild(event.elem1);
                        tmp.appendChild(event.elem2);

                        // Just rewrite event's title.
                        $C(event.elem2, true).text(event.title).end();
                    } else {
                        // Create new DOM nodes.
                        $C(tmp)
                            .div(event.color ? {style: {background: event.color}} : undefined)
                                .act(function() { event.elem1 = this; })
                            .end()
                            .div({'data-id': event.id, title: event.title})
                                .act(function() { event.elem2 = this; })
                                .text(event.title)
                        .end(2);
                    }

                    // Setting class names.
                    event.elem1.className =
                        'b-timeline__event' +
                            (event.begin === event.end ?
                                ' b-timeline__event_type_point'
                                :
                                isUndefined(event.end) ?
                                    ' b-timeline__event_type_unfinished'
                                    :
                                    '');
                    event.elem2.className =
                        'b-timeline__event-overlay' +
                            (event.begin === event.end ?
                                ' b-timeline__event-overlay_type_point'
                                :
                                 '');

                    // We need to position this event.
                    event.positioned = false;
                }

                this._positionEvents();
            }
        },

        _positionTimeframes: function() {
            var timeframeWidth = this._getTimeframeWidth(),
                i,
                pos = this._getTimeframeByTime(this._position),
                posFrom = this._getTimeByTimeframe(pos),
                posTo = this._getTimeByTimeframe(pos + 1),
                left,
                timeframe,
                timeFrom,
                timeTo,
                now = this._bounds.now,
                cssProps;

            left =  - Math.round(timeframeWidth * (this._position - posFrom) / (posTo - posFrom))
                    - (pos - this._timeframeFrom) * timeframeWidth;

            if (!isUndefined(now)) {
                timeFrom = this._getTimeByTimeframe(this._timeframeFrom);
            }

            for (i = this._timeframeFrom; i < this._timeframeTo; i++) {
                // TODO: Assign left and width only in case they have changed
                //       since previous _positionTimeframes() call.

                timeframe = this._timeframes[i];

                css(timeframe.elem, {left: left, width: timeframeWidth});

                left += timeframeWidth;

                if (!isUndefined(now)) {
                    // Update future overlays positions.
                    timeTo = this._getTimeByTimeframe(i + 1);

                    cssProps = {};

                    if (now >= timeTo) {
                        cssProps.display = 'none';
                    } else {
                        cssProps.display = '';
                        cssProps.left = timeFrom >= now ?
                            0
                            :
                            Math.round(timeframeWidth * (now - timeFrom) / (timeTo - timeFrom));
                    }

                    css(timeframe.futureElem, cssProps);

                    timeFrom = timeTo;
                }
            }

            this._setUnfinishedEventsWidths();
        },

        _positionEvents: function(force) {
            var i,
                j,
                event,
                item,
                sweepLine = [],
                timeframeWidth = this._getTimeframeWidth(),
                left,
                top,
                rows = {};

            for (i in this._events) {
                event = this._events[i];

                sweepLine.push({begin: true, event: event, sort: event.tbegin});
                sweepLine.push({begin: false, event: event, sort: isUndefined(event.end) ? '' : event.tend2});
            }

            sweepLine.sort(function(a, b) {
                return a.sort < b.sort ? -1 : a.sort > b.sort ? 1 : 0;
            });

            for (i = 0; i < sweepLine.length; i++) {
                item = sweepLine[i];
                event = item.event;

                if (item.begin) {
                    if (!force && event.positioned) {
                        rows[event.row] = true;
                        continue;
                    }

                    left = Math.round((event.tbegin - event.timeframe) * timeframeWidth);

                    if (isUndefined(event.row)) {
                        j = 0;

                        while (rows[j]) {
                            j++;
                        }

                        event.row = j;
                    }

                    rows[event.row] = true;

                    top = Math.ceil(event.row / 2) * (T.EVENT_HEIGHT + T.EVENT_VSPACING) * (event.row % 2 === 0 ? 1 : -1);

                    css(event.elem1, {
                        left: left,
                        top: top,
                        width: event.begin === event.end ? '' : Math.round((event.tend - event.tbegin) * timeframeWidth)
                    });

                    css(event.elem2, {
                        left: left,
                        top: top,
                        width: Math.round((event.tend2 - event.tbegin) * timeframeWidth)
                    });

                    event.left = left;

                    event.positioned = true;
                } else {
                    rows[event.row] = undefined;
                }
            }

            this._setUnfinishedEventsWidths();
        },

        _setUnfinishedEventsWidths: function() {
            var i,
                id,
                unfinished,
                timeframeWidth = this._getTimeframeWidth(),
                now = this._bounds.now,
                timeframeFrom,
                timeFrom,
                timeTo,
                width,
                event;

            timeframeFrom = this._getTimeframeByTime(now);

            if (timeframeFrom >= this._timeframeTo) {
                now = this._getTimeByTimeframe(this._timeframeTo);
                timeframeFrom = this._timeframeTo;
            }

            timeFrom = this._getTimeByTimeframe(timeframeFrom);
            timeTo = this._getTimeByTimeframe(timeframeFrom + 1);

            width = Math.round((timeframeFrom - this._timeframeFrom + 1) * timeframeWidth - ((timeTo - now) / (timeTo - timeFrom)) * timeframeWidth);

            for (i = this._timeframeFrom; i < this._timeframeTo; i++) {
                unfinished = this._timeframes[i].unfinished;

                for (id in unfinished) {
                    event = this._events[id];
                    css(event.elem1, {width: width - event.left});
                    css(event.elem2, {width: width - event.left});
                }

                width -= timeframeWidth;
            }
        },

        _getMissingTime: function() {
            var timeframeFrom,
                timeframeTo,
                i;

            timeframeFrom = this._timeframeFrom;
            timeframeTo = this._timeframeTo - 1;

            while (timeframeFrom < this._timeframeTo && this._timeframes[timeframeFrom].requested) {
                timeframeFrom++;
            }

            while (timeframeTo >= this._timeframeFrom && this._timeframes[timeframeTo].requested) {
                timeframeTo--;
            }

            if (timeframeFrom <= timeframeTo) {
                return {
                    timeframeFrom: timeframeFrom,
                    timeframeTo: timeframeTo + 1,
                    timeFrom: this._getTimeByTimeframe(timeframeFrom),
                    timeTo: this._getTimeByTimeframe(timeframeTo + 1)
                };
            }
        },

        _getEvents: emptyFunc,

        _click: emptyFunc,

        _getTimeByTimeframe: function(timeframe) {
            return this._bounds ?
                timeframe * _24hours + this._bounds.minTime % _24hours
                :
                undefined;
        },

        _getTimeframeByTime: function(time) {
            return this._bounds ?
                Math.floor((time - this._bounds.minTime % _24hours) / _24hours)
                :
                undefined;
        },

        _getTicks: function(timeFrom, timeTo) {
            var d = new Date(timeFrom);
            defaultTicks[0].label = months[d.getMonth()] + ' ' + d.getDate() + ' ' + d.getFullYear();
            return defaultTicks;
        }
    };
})(window);
