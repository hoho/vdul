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
        this.bounds = {
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

        this._timeframes = {};
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

                if (!(i = self._getMissingTime())) {
                    return;
                }

                timeFrom = i.timeFrom;
                timeTo = i.timeTo;
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
                this._timeframes[timeframe] = false;
            }
        },

        _removeTimeframe: function(timeframe) {
            delete this._timeframes[timeframe];
        },

        _getMissingTime: function() {
            var timeframeFrom, timeframeTo;

            timeframeFrom = this._timeframeFrom;
            timeframeTo = this._timeframeTo - 1;

            console.log(timeframeFrom, timeframeTo);

            while (timeframeFrom < this._timeframeTo && this._timeframes[timeframeFrom] !== false) {
                timeframeFrom++;
            }

            while (timeframeTo >= this._timeframeFrom && this._timeframes[timeframeTo] !== false) {
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

        _getTicks: function(timefrmeNumber, timeFrom, timeTo) {
            return defaultTicks;
        }
    };
})(window);
