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
        ];

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
                resizeTimer = null;
            }, 100);
        });
    };


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

        push: function() {
            this._scheduleUpdate();
        },

        remove: function() {
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
                i;

            for (key in bounds) {
                evaluatedBounds[key] = isFunction(val = bounds[key]) ? val() : val;
            }

            // TODO: Check values.
            self._bounds = evaluatedBounds;

            if (self._position < evaluatedBounds.minTime) {
                self._position = evaluatedBounds.minTime;
            }

            pos = self._getTimeframeByTime(isUndefined(self._position) ? evaluatedBounds.minTime : self._position);

            timeFrom = self._getTimeByTimeframe(pos - evaluatedBounds.preloadBefore);
            timeTo = self._getTimeByTimeframe(pos + evaluatedBounds.curViewport + evaluatedBounds.preloadAfter);

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

                if (!isUndefined(self._timeframeFrom)) {
                    for (i = self._timeframeFrom; i < timeframeFrom; i++) {
                        self._removeTimeframe(i);
                    }

                    for (i = timeframeTo; i < self._timeframeTo; i++) {
                        self._removeTimeframe(i);
                    }
                }

                self._timeframeFrom = timeframeFrom;
                self._timeframeTo = timeframeTo;

                for (i = timeframeFrom; i < timeframeTo; i++) {
                    self._addTimeframe(i);
                }

                self._positionTimeframes();

                if (!(val = self._getMissingTime())) {
                    return;
                }

                timeFrom = val.timeFrom;
                timeTo = val.timeTo;
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
                var t = this._timeframes[timeframe] = {},
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

        _removeTimeframe: function(timeframe) {
            var t = this._timeframes[timeframe];

            if (t) {
                this._timeframesElem.removeChild(t.elem);
                delete this._timeframes[timeframe];
            }
        },

        _positionTimeframes: function() {
            var timeframeWidth = Math.ceil(this._timeframesElem.clientWidth * (1 / this._bounds.curViewport)),
                i,
                pos = this._getTimeframeByTime(this._position),
                posFrom = this._getTimeByTimeframe(pos),
                posTo = this._getTimeByTimeframe(pos + 1),
                timeframe,
                elemStyle,
                timeFrom,
                timeTo,
                now = this._bounds.now;

            posFrom = - Math.round(timeframeWidth * (this._position - posFrom) / (posTo - posFrom))
                      - (pos - this._timeframeFrom) * timeframeWidth;

            if (!isUndefined(now)) {
                timeFrom = this._getTimeByTimeframe(this._timeframeFrom);
            }

            for (i = this._timeframeFrom; i < this._timeframeTo; i++) {
                // TODO: Assign left and width only in case they have changed
                //       since previous _positionTimeframes() call.

                timeframe = this._timeframes[i];

                elemStyle = timeframe.elem.style;
                elemStyle.left = posFrom + 'px';
                elemStyle.width = timeframeWidth + 'px';

                posFrom += timeframeWidth;

                if (!isUndefined(now)) {
                    // Update future overlays positions.
                    timeTo = this._getTimeByTimeframe(i + 1);

                    elemStyle = timeframe.futureElem.style;

                    if (now >= timeTo) {
                        elemStyle.display = 'none';
                    } else {
                        elemStyle.display = '';
                        elemStyle.left = (timeFrom >= now ? 0 : Math.round(timeframeWidth * (now - timeFrom) / (timeTo - timeFrom))) + 'px';
                    }

                    timeFrom = timeTo;
                }
            }
        },

        _getMissingTime: function() {
            var timeframeFrom, timeframeTo;

            timeframeFrom = this._timeframeFrom;
            timeframeTo = this._timeframeTo - 1;

            while (timeframeFrom < this._timeframeTo && this._timeframes[timeframeFrom].data) {
                timeframeFrom++;
            }

            while (timeframeTo >= this._timeframeFrom && this._timeframes[timeframeTo].data) {
                timeframeTo--;
            }

            if (timeframeFrom <= timeframeTo) {
                return {
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
            return defaultTicks;
        }
    };
})(window);
