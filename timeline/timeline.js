(function(window, document, undefined) {
    'use strict';

    var T,
        isUndefined = function(val) { return typeof val === 'undefined'; },
        isFunction = function(val) { return typeof val === 'function'; },

        floor = Math.floor,
        ceil = Math.ceil,
        round = Math.round,

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

        bemBlockName = 'b-timeline',

        mousedownX,

        ///////////////////////////////////////////////////////////////////////
        ///////////////////////////////////////////////////////////////////////
        css = function(elem, props) {
            var style = elem.style,
                prop,
                val;

            for (prop in props) {
                val = props[prop];
                // TODO: Add 'px' suffix to a certain properies only (left,
                //       width and so on).
                try { style[prop] = val + (typeof val === 'number' ? 'px' : ''); } catch(e) {};
            }
        },
        ///////////////////////////////////////////////////////////////////////
        ///////////////////////////////////////////////////////////////////////
        bemClass = function(elem, mods) {
            // Concatenate block or element class attribute value.
            if (typeof elem !== 'string') {
                mods = elem;
                elem = undefined;
            }

            var base = bemBlockName + (elem ? '__' + elem : ''),
                ret = [base],
                mod;

            for (mod in mods) {
                ret.push(base + '_' + mod + (mods[mod] === true ? '' : '_' + mods[mod]));
            }

            return ret.join(' ');
        },
        ///////////////////////////////////////////////////////////////////////
        ///////////////////////////////////////////////////////////////////////
        bindMouseWheel = function(elem, callback) {
            var minDelta,
                handler =
                    function(event) {
                        var delta = 0,
                            absDelta;

                        if (!event) { event = window.event; }

                        // Old school scrollwheel delta
                        if (event.wheelDelta) { delta = event.wheelDelta * -1; }
                        if (event.detail) { delta = event.detail; }

                        // New school wheel delta (wheel event)
                        if (event.deltaX && delta == 0) { delta  = event.deltaX; }
                        if (event.deltaY && delta == 0) { delta = event.deltaY; }

                        // Webkit
                        if (event.wheelDeltaX && delta == 0) { delta = event.wheelDeltaX; }
                        if (event.wheelDeltaY && delta == 0) { delta = event.wheelDeltaY; }

                        absDelta = Math.abs(delta);

                        if (isUndefined(minDelta) || absDelta < minDelta) {
                            minDelta = absDelta;
                        }

                        callback(delta / (minDelta || 1));

                        if (event.preventDefault) {
                            event.preventDefault();
                        }

                        return event.returnValue = false;
                    };

            if (elem.addEventListener) {
                var toBind = 'onwheel' in document || document.documentMode >= 9 ? ['wheel'] : ['mousewheel', 'DomMouseScroll', 'MozMousePixelScroll'],
                    i;

                for (i = 0; i < toBind.length; i++) {
                    elem.addEventListener(toBind[i], handler, false);
                }
            } else {
                elem.onmousewheel = handler;
            }
        },
        ///////////////////////////////////////////////////////////////////////
        ///////////////////////////////////////////////////////////////////////
        bind = function(self, func) {
            return function() {
                func.apply(self, arguments);
            };
        };

    T = window.Timeline = function(container, bindEventFunc) {
        /* Naming: __something    is a private Timeline field,
                   __something__  is a private Timeline method,
                   something      is just a variable. */
        var self = this,

            __resizeTimer,

            __timeframes = {},
            __events = {},

            __elem,
            __errorElem,
            __timeframesElem,

            __timeframeFrom,
            __timeframeTo,

            __autoUpdateTimer,

            __calculatedBounds,

            __position,

            __bounds = {
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
            },
        ///////////////////////////////////////////////////////////////////////
        ///////////////////////// Begin of private API ////////////////////////
        ///////////////////////////////////////////////////////////////////////
            __getEvents__,
            __click__,
        ///////////////////////////////////////////////////////////////////////
        /////////////////////////// Private API continues /////////////////////
        ///////////////////////////////////////////////////////////////////////
            __getTimeByTimeframe__ = function(timeframe) {
                return timeframe * _24hours + __calculatedBounds.minTime % _24hours;
            },
        ///////////////////////////////////////////////////////////////////////
        /////////////////////////// Private API continues /////////////////////
        ///////////////////////////////////////////////////////////////////////
            __getTimeframeByTime__ = function(time) {
                return (time - __calculatedBounds.minTime % _24hours) / _24hours;
            },
        ///////////////////////////////////////////////////////////////////////
        ///////////////////////// Private API continues ///////////////////////
        ///////////////////////////////////////////////////////////////////////
            __getTicks__ = function(timeFrom, timeTo) {
                var d = new Date(timeFrom);
                defaultTicks[0].label = months[d.getMonth()] + ' ' + d.getDate() + ' ' + d.getFullYear();
                return defaultTicks;
            },
        ///////////////////////////////////////////////////////////////////////
        ///////////////////////// Private API continues ///////////////////////
        ///////////////////////////////////////////////////////////////////////
            __removeEvent__ = function(id, keepInDOM) {
                var event = __events[id],
                    timeframe;

                if (event) {
                    delete __events[id];

                    if (event.timeframe) {
                        timeframe = __timeframes[event.timeframe];

                        delete timeframe.events[id];
                        delete timeframe.unfinished[id];

                        if (!keepInDOM) {
                            timeframe.eventsElem.removeChild(event.elem1);
                            timeframe.eventsElem.removeChild(event.elem2);
                        }
                    }
                }
            },
        ///////////////////////////////////////////////////////////////////////
        ///////////////////////// Private API continues ///////////////////////
        ///////////////////////////////////////////////////////////////////////
            __setStatus__ = function(timeFrom, timeTo, loading, error) {
                var timeframeFrom = floor(__getTimeframeByTime__(timeFrom)),
                    timeframeTo = floor(__getTimeframeByTime__(timeTo)),
                    timeframe,
                    i;

                for (i = timeframeFrom; i < timeframeTo; i++) {
                    if (timeframe = __timeframes[i]) {
                        if (!loading || error) {
                            if (timeframe.loading) {
                                (function(elem) {
                                    window.setTimeout(function() {
                                        elem.className = bemClass('timeframe');
                                    }, 0);
                                })(timeframe.elem);

                                timeframe.loading = false;
                            }

                            if (error) {
                                timeframe.error = true;
                            }
                        }

                        if (loading) {
                            timeframe.elem.className = bemClass('timeframe', {loading: true});
                            timeframe.loading = true;
                        }

                        if (!error) {
                            timeframe.error = false;
                        }
                    }
                }

                if (!error && __errorElem) {
                    for (i = __timeframeFrom; i < __timeframeTo; i++) {
                        if (__timeframes[i].error) {
                            return;
                        }
                    }

                    // No failed timeframes, remove error message.
                    __elem.removeChild(__errorElem);
                    __errorElem = undefined;
                }
            },
        ///////////////////////////////////////////////////////////////////////
        ///////////////////////// Private API continues ///////////////////////
        ///////////////////////////////////////////////////////////////////////
            __update__ = function(updateCurrent, setStatus) {
                var key,
                    val,
                    pos,
                    timeFrom,
                    timeTo,
                    timeframeFrom,
                    timeframeTo,
                    i,
                    unadopted = [];

                __calculatedBounds = {};

                for (key in __bounds) {
                    // TODO: Check values.
                    __calculatedBounds[key] = isFunction(val = __bounds[key]) ? val() : val;
                }

                if (__position > (pos = __getTimeByTimeframe__((__getTimeframeByTime__(__calculatedBounds.maxTime) - __calculatedBounds.curViewport)))) {
                    __position = pos;
                }

                if (__position < __calculatedBounds.minTime) {
                    __position = __calculatedBounds.minTime;
                }

                pos = __getTimeframeByTime__(isUndefined(__position) ? __calculatedBounds.minTime : __position);

                timeFrom = __getTimeByTimeframe__(floor(pos - __calculatedBounds.preloadBefore));
                timeTo = __getTimeByTimeframe__(ceil(pos + __calculatedBounds.curViewport + __calculatedBounds.preloadAfter));

                if (timeFrom < __calculatedBounds.minTime) {
                    timeFrom = __calculatedBounds.minTime;
                }

                if (timeTo > __calculatedBounds.maxTime) {
                    timeTo = __calculatedBounds.maxTime;
                }

                __cancelUpdate__();

                if (!updateCurrent) {
                    timeframeFrom = floor(__getTimeframeByTime__(timeFrom));
                    timeframeTo = floor(__getTimeframeByTime__(timeTo));

                    for (i = timeframeFrom; i < timeframeTo; i++) {
                        __addTimeframe__(i);
                    }

                    if (!isUndefined(__timeframeFrom)) {
                        for (i = __timeframeFrom; i < timeframeFrom; i++) {
                            __removeTimeframe__(i, unadopted);
                        }

                        for (i = timeframeTo; i < __timeframeTo; i++) {
                            __removeTimeframe__(i, unadopted);
                        }
                    }

                    __timeframeFrom = timeframeFrom;
                    __timeframeTo = timeframeTo;

                    __positionTimeframes__();
                    __adoptEvents__(unadopted);

                    if (!(val = __getMissingTime__())) {
                        return;
                    }

                    timeFrom = val.timeFrom;
                    timeTo = val.timeTo;

                    setStatus = true;
                } else {
                    __positionTimeframes__();
                }

                if (setStatus) {
                    __setStatus__(timeFrom, timeTo, true, false);
                }

                if (__getEvents__) {
                    __getEvents__(timeFrom, timeTo);
                }
            },
        ///////////////////////////////////////////////////////////////////////
        ///////////////////////// Private API continues ///////////////////////
        ///////////////////////////////////////////////////////////////////////
            __cancelUpdate__ = function() {
                if (__autoUpdateTimer) {
                    window.clearTimeout(__autoUpdateTimer);
                    __autoUpdateTimer = undefined;
                }
            },
        ///////////////////////////////////////////////////////////////////////
        ///////////////////////// Private API continues ///////////////////////
        ///////////////////////////////////////////////////////////////////////
            __scheduleUpdate__ = function() {
                var autoUpdate;

                __cancelUpdate__();

                if (__calculatedBounds && (autoUpdate = __calculatedBounds.autoUpdate) && autoUpdate > 0) {
                    __autoUpdateTimer = window.setTimeout(function() {
                        __autoUpdateTimer = undefined;
                        __update__(true);
                    }, autoUpdate);
                }
            },
        ///////////////////////////////////////////////////////////////////////
        ///////////////////////// Private API continues ///////////////////////
        ///////////////////////////////////////////////////////////////////////
            __addTimeframe__ = function(timeframe) {
                if (isUndefined(__timeframes[timeframe])) {
                    var t = __timeframes[timeframe] = {
                            events:     {},
                            unfinished: {}
                        },

                        timeFrom = __getTimeByTimeframe__(timeframe),
                        timeTo   = __getTimeByTimeframe__(timeframe + 1);

                    $C(__timeframesElem)
                        .div({'class': bemClass('timeframe')})
                            .act(function() { t.elem = this; })
                            .each(__getTicks__(timeFrom, timeTo))
                                .div({'class': bemClass('tick'), style: {left: function(index, item) { return item.left; }}})
                                    .span()
                                        .text(function(index, item) { return item.label; })
                            .end(3)
                            .div({'class': bemClass('events-wrapper')})
                                .div({'class': bemClass('events')})
                                    .act(function() { t.eventsElem = this; })
                                    .div({'class': bemClass('future-overlay')})
                                        .act(function() { t.futureElem = this; })
                    .end(5);
                }
            },
        ///////////////////////////////////////////////////////////////////////
        ///////////////////////// Private API continues ///////////////////////
        ///////////////////////////////////////////////////////////////////////
            __removeTimeframe__ = function(timeframe, unadopted) {
                var t = __timeframes[timeframe],
                    id,
                    event;

                if (t) {
                    for (id in t.events) {
                        event = __events[id];
                        event.timeframe = undefined;
                        unadopted.push(event);

                        delete __events[id];
                    }

                    __timeframesElem.removeChild(t.elem);

                    delete __timeframes[timeframe];
                }
            },
        ///////////////////////////////////////////////////////////////////////
        ///////////////////////// Private API continues ///////////////////////
        ///////////////////////////////////////////////////////////////////////
            __getTimeframeWidth__ = function() {
                return ceil(__timeframesElem.clientWidth * (1 / __calculatedBounds.curViewport));
            },
        ///////////////////////////////////////////////////////////////////////
        ///////////////////////// Private API continues ///////////////////////
        ///////////////////////////////////////////////////////////////////////
            __adoptEvents__ = function(events) {
                if (events.length) {
                    var i,
                        tmp,
                        event,
                        timeframeFrom,
                        timeframeTo,
                        timeframeWidth = __getTimeframeWidth__(),
                        timeframe,
                        hspacing = T.EVENT_HSPACING / timeframeWidth,
                        letterWidth = T.LETTER_WIDTH / timeframeWidth;

                    for (i = 0; i < events.length; i++) {
                        event = events[i];

                        // Get timeframes this event goes through.
                        timeframeFrom = __getTimeframeByTime__(event.begin);
                        timeframeTo = event.begin === event.end ?
                            timeframeFrom
                            :
                            __getTimeframeByTime__(isUndefined(event.end) ? __calculatedBounds.maxTime : event.end);

                        if (timeframeTo < __timeframeFrom || timeframeFrom >= __timeframeTo) {
                            // Event is out of current timeframes, skip it.
                            continue;
                        }

                        // Getting event's parent timeframe.
                        tmp = round((timeframeFrom + timeframeTo) / 2);
                        event.timeframe = timeframe = tmp < __timeframeFrom ?
                            __timeframeFrom
                            :
                            tmp >= __timeframeTo ?
                                __timeframeTo - 1
                                :
                                tmp;

                        timeframe = __timeframes[timeframe];

                        event.tbegin = timeframeFrom;

                        if (!isUndefined(event.end)) {
                            // Getting event's right position.
                            if (event.begin === event.end) {
                                // It's a point event.
                                event.tend = event.tbegin;
                                event.tend2 = event.tbegin + event.title.length * letterWidth + hspacing;
                            } else {
                                // It's an interval.
                                event.tend = timeframeTo;
                                event.tend2 = event.tbegin + event.title.length * letterWidth + hspacing;

                                if (event.tend2 - event.tend < hspacing) {
                                    event.tend2 = event.tend + hspacing;
                                }
                            }
                        }

                        // Adding this event to timeframe's events and to
                        // __events.
                        timeframe.events[event.id] = true;

                        if (isUndefined(event.end)) {
                            timeframe.unfinished[event.id] = true;
                        }

                        __events[event.id] = event;

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
                                .div(event.color ? {style: {'background-color': event.color}} : undefined)
                                    .act(function() { event.elem1 = this; })
                                .end()
                                .div({'data-id': event.id, title: event.title})
                                    .act(function() { event.elem2 = this; })
                                    .text(event.title)
                            .end(2);
                        }

                        // Setting class names.
                        tmp = undefined;

                        if (event.begin === event.end) {
                            tmp = {type: 'point'};
                        }

                        event.elem2.className = bemClass('event-overlay', tmp);

                        if (isUndefined(event.end)) {
                            tmp = {type: 'unfinished'}
                        }

                        event.elem1.className = bemClass('event', tmp);

                        // We need to position this event.
                        event.positioned = false;
                    }

                    __positionEvents__();
                }
            },
        ///////////////////////////////////////////////////////////////////////
        ///////////////////////// Private API continues ///////////////////////
        ///////////////////////////////////////////////////////////////////////
            __positionTimeframes__ = function() {
                var timeframeWidth = __getTimeframeWidth__(),
                    i,
                    left = - round((__getTimeframeByTime__(__position) - __timeframeFrom) * timeframeWidth),
                    timeframe,
                    timeFrom,
                    timeTo,
                    now = __calculatedBounds.now,
                    cssProps;

                if (!isUndefined(now)) {
                    timeFrom = __getTimeByTimeframe__(__timeframeFrom);
                }

                for (i = __timeframeFrom; i < __timeframeTo; i++) {
                    // TODO: Assign left and width only in case they have changed
                    //       since previous __positionTimeframes__() call.

                    timeframe = __timeframes[i];

                    css(timeframe.elem, {left: left, width: timeframeWidth});

                    left += timeframeWidth;

                    if (!isUndefined(now)) {
                        // Update future overlays positions.
                        timeTo = __getTimeByTimeframe__(i + 1);

                        cssProps = {};

                        if (now >= timeTo) {
                            cssProps.display = 'none';
                        } else {
                            cssProps.display = '';
                            cssProps.left = timeFrom >= now ?
                                0
                                :
                                round(timeframeWidth * (now - timeFrom) / (timeTo - timeFrom));
                        }

                        css(timeframe.futureElem, cssProps);

                        timeFrom = timeTo;
                    }
                }

                __setUnfinishedEventsWidths__();
            },
        ///////////////////////////////////////////////////////////////////////
        ///////////////////////// Private API continues ///////////////////////
        ///////////////////////////////////////////////////////////////////////
            __positionEvents__ = function(force) {
                var i,
                    j,
                    event,
                    item,
                    sweepLine = [],
                    timeframeWidth = __getTimeframeWidth__(),
                    left,
                    top,
                    rows = {};

                for (i in __events) {
                    event = __events[i];

                    sweepLine.push({begin: true, event: event, sort: event.tbegin});

                    if (!isUndefined(event.end)) {
                        sweepLine.push({begin: false, event: event, sort: event.tend2});
                    }
                }

                sweepLine.sort(function(a, b) {
                    return a.sort < b.sort ? -1 : a.sort > b.sort ? 1 : 0;
                });

                for (i = 0; i < sweepLine.length; i++) {
                    item = sweepLine[i];
                    event = item.event;

                    if (item.begin) {
                        if (!force && event.positioned && !rows[event.row]) {
                            rows[event.row] = true;
                            continue;
                        }

                        left = round((event.tbegin - event.timeframe) * timeframeWidth);

                        j = 0;

                        while (rows[j]) {
                            j++;
                        }

                        rows[event.row = j] = true;

                        top = ceil(j / 2) * (T.EVENT_HEIGHT + T.EVENT_VSPACING) * (j % 2 === 0 ? 1 : -1);

                        css(event.elem1, {
                            left: left,
                            top: top,
                            width: event.begin === event.end ? '' : (round((event.tend - event.tbegin) * timeframeWidth) || 1)
                        });

                        css(event.elem2, {
                            left: left,
                            top: top,
                            width: round((event.tend2 - event.tbegin) * timeframeWidth)
                        });

                        // Remember left position for __setUnfinishedEventsWidths__.
                        event.left = left;

                        event.positioned = true;
                    } else {
                        rows[event.row] = undefined;
                    }
                }

                __setUnfinishedEventsWidths__();
            },
        ///////////////////////////////////////////////////////////////////////
        ///////////////////////// Private API continues ///////////////////////
        ///////////////////////////////////////////////////////////////////////
            __setUnfinishedEventsWidths__ = function() {
                var i,
                    id,
                    unfinished,
                    timeframeWidth = __getTimeframeWidth__(),
                    timeframeFrom,
                    width,
                    event;

                timeframeFrom = __getTimeframeByTime__(__calculatedBounds.now);

                if (timeframeFrom >= __timeframeTo) {
                    timeframeFrom = __timeframeTo;
                }

                width = round((timeframeFrom - __timeframeFrom) * timeframeWidth);

                for (i = __timeframeFrom; i < __timeframeTo; i++) {
                    unfinished = __timeframes[i].unfinished;

                    for (id in unfinished) {
                        event = __events[id];
                        css(event.elem1, {width: width - event.left});
                        css(event.elem2, {width: width - event.left});
                    }

                    width -= timeframeWidth;
                }
            },
        ///////////////////////////////////////////////////////////////////////
        ///////////////////////// Private API continues ///////////////////////
        ///////////////////////////////////////////////////////////////////////
            __getMissingTime__ = function() {
                var timeframeFrom,
                    timeframeTo;

                timeframeFrom = __timeframeFrom;
                timeframeTo = __timeframeTo - 1;

                while (timeframeFrom < __timeframeTo && !isUndefined(__timeframes[timeframeFrom].loading)) {
                    timeframeFrom++;
                }

                while (timeframeTo >= __timeframeFrom && !isUndefined(__timeframes[timeframeTo].loading)) {
                    timeframeTo--;
                }

                if (timeframeFrom <= timeframeTo) {
                    return {
                        timeframeFrom: timeframeFrom,
                        timeframeTo:   timeframeTo + 1,
                        timeFrom:      __getTimeByTimeframe__(timeframeFrom),
                        timeTo:        __getTimeByTimeframe__(timeframeTo + 1)
                    };
                }
            };
        ///////////////////////////////////////////////////////////////////////
        ////////////////////////// End of private API /////////////////////////
        ///////////////////////////////////////////////////////////////////////


        ///////////////////////////////////////////////////////////////////////
        ///////////////////////// Begin of public API /////////////////////////
        ///////////////////////////////////////////////////////////////////////
        self.push = function(timeFrom, timeTo, events) {
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
                    title:      event.title ? event.title + '' : '',
                    begin:      isUndefined(event.begin) ? event.end : event.begin,
                    end:        event.end,
                    marks:      Array.prototype.slice.call(event.marks || [], 0),
                    color:      event.color,
                    //row:        undefined,
                    //tbegin:     undefined,
                    //tend:       undefined,
                    //elem1:      undefined,
                    //elem2:      undefined,
                    //left:       undefined,
                    positioned: false
                };

                if (event = __events[newEvent.id]) {
                    if (event.title === newEvent.title &&
                        event.begin === newEvent.begin &&
                        event.end === newEvent.end &&
                        event.color === newEvent.color)
                    {
                        continue;
                    }

                    __removeEvent__(newEvent.id, true);

                    newEvent.row = event.row; // We need to keep the row.

                    // Event's DOM nodes are already created, no need to create
                    // them again.
                    newEvent.elem1 = event.elem1;
                    css(newEvent.elem1, {'background-color': newEvent.color || ''});

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

            __adoptEvents__(unadopted);

            __setStatus__(timeFrom, timeTo, false, false);

            __scheduleUpdate__();
        };
        ///////////////////////////////////////////////////////////////////////
        ///////////////////////// Public API continues ////////////////////////
        ///////////////////////////////////////////////////////////////////////
        self.setBounds = function(bounds) {
            var key,
                b;

            for (key in __bounds) {
                if (!isUndefined(b = bounds[key])) {
                    __bounds[key] = b;
                }
            }
        };
        ///////////////////////////////////////////////////////////////////////
        ///////////////////////// Public API continues ////////////////////////
        ///////////////////////////////////////////////////////////////////////
        self.getBounds = function() {
            return __calculatedBounds;
        };
        ///////////////////////////////////////////////////////////////////////
        ///////////////////////// Public API continues ////////////////////////
        ///////////////////////////////////////////////////////////////////////
        self.setCallbacks = function(callbacks) {
            var key,
                func;

            for (key in callbacks) {
                if (isFunction(func = callbacks[key])) {
                    func = bind(self, func);

                    switch (key) {
                        case 'getEvents':          __getEvents__          = func; break;
                        case 'getTimeByTimeframe': __getTimeByTimeframe__ = func; break;
                        case 'getTimeframeByTime': __getTimeframeByTime__ = func; break;
                        case 'getTicks':           __getTicks__           = func; break;
                        case 'click':              __click__              = func; break;
                    }
                }
            }
        };
        ///////////////////////////////////////////////////////////////////////
        ///////////////////////// Public API continues ////////////////////////
        ///////////////////////////////////////////////////////////////////////
        self.remove = function(eventIds) {
            var i,
                id;

            for (i = 0; i < eventIds.length; i++) {
                id = eventIds[i];

                if (__events[id]) {
                    __removeEvent__(id);
                }
            }
        };
        ///////////////////////////////////////////////////////////////////////
        ///////////////////////// Public API continues ////////////////////////
        ///////////////////////////////////////////////////////////////////////
        self.error = function(timeFrom, timeTo, msg) {
            if (!__errorElem) {
                $C(__elem)
                    .div({'class': bemClass('error-wrapper')})
                        .act(function() { __errorElem = this; })
                        .span({'class': bemClass('error')})
                            .text(msg)
                .end(3);
            }

            __setStatus__(timeFrom, timeTo, false, true);

            __scheduleUpdate__();
        };
        ///////////////////////////////////////////////////////////////////////
        ///////////////////////// Public API continues ////////////////////////
        ///////////////////////////////////////////////////////////////////////
        self.position = function(pos) {
            if (isUndefined(pos)) {
                return __position;
            } else {
                __position = pos;
                __update__();
                __scheduleUpdate__();
            }
        };
        ///////////////////////////////////////////////////////////////////////
        ////////////////////////// End of public API //////////////////////////
        ///////////////////////////////////////////////////////////////////////

        $C(container, true)
            .div({'class': bemClass()})
                .act(function() { __elem = this; })
                .div({'class': bemClass('timeframes')})
                    .act(function() { __timeframesElem = this; })
        .end(3);

        bindEventFunc(window, 'resize', function() {
            if (__resizeTimer) {
                window.clearTimeout(__resizeTimer);
            }

            __resizeTimer = window.setTimeout(function() {
                __positionTimeframes__();
                __positionEvents__(true);
                __resizeTimer = undefined;
            }, 100);
        });

        bindEventFunc(__elem, 'click', function(e) {
            var className = e.target.className || '',
                what,
                id;

            if (className.indexOf(bemClass('event-overlay')) >= 0) {
                what = 'event';
            } else if (className === bemClass('error')) {
                what = 'error';
            }

            switch (what) {
                case 'event':
                    id = e.target.getAttribute('data-id');

                    if (id && __click__) {
                        __click__(e, id);
                    }

                    break;

                case 'error':
                    __update__(true, true);
                    break;
            }
        });

        bindEventFunc(window, 'keydown', function(e) {
            if (__calculatedBounds) {
                var move;

                switch (e.which) {
                    case 37:
                        move = -1;
                        break;

                    case 39:
                        move = 1;
                        break;
                }

                if (move) {
                    self.position(__getTimeByTimeframe__(__getTimeframeByTime__(__position) + move * __calculatedBounds.curViewport * 0.05));
                }
            }
        });

        bindEventFunc(__elem, 'mousedown', function(e) {
            mousedownX = e.pageX;
        });

        bindEventFunc(__elem, 'mousemove', function(e) {
            if (mousedownX !== undefined && __calculatedBounds && e.pageX !== mousedownX) {
                self.position(__getTimeByTimeframe__(__getTimeframeByTime__(__position) + (mousedownX - e.pageX) * __calculatedBounds.curViewport / __getTimeframeWidth__()));
                mousedownX = e.pageX;
            }
        });

        bindEventFunc(document, 'mouseup', function(e) {
            mousedownX = undefined;
        });

        bindMouseWheel(__elem, function(delta) {
            if (!isUndefined(__calculatedBounds)) {
                self.position(__getTimeByTimeframe__(__getTimeframeByTime__(__position) + __calculatedBounds.curViewport * delta * .002));
            }
        });
    };

    T.EVENT_HEIGHT = 30;
    T.EVENT_HSPACING = 30;
    T.EVENT_VSPACING = 5;
    T.LETTER_WIDTH = 7.5;
})(window, document);
