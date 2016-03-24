!function() {
    var sitehound = window.sitehound = window.sitehound || {};

    if (!sitehound.done) {
        // SiteHound lib not yet loaded - init bootstrap

        if (sitehound.invoked) {
            if (window.console && console.error) {
                var m = 'SiteHound snippet included twice';
                console.error(m);
            }
            sitehound.trackDebugWarn(m);
        } else {
            sitehound.invoked = true;
            sitehound.queue = [];

            var methods = [
                'track',
                'trackAndCount',
                'trackLink',
                'trackOnce',
                'trackDebugInfo',
                'trackDebugWarn',
                'trackError'
            ];

            var factory = function(method) {
                return function() {
                    var args = Array.prototype.slice.call(arguments);
                    args.unshift(method);
                    sitehound.queue.push(args);
                    return sitehound;
                };
            };

            for (var i = 0; i < methods.length; i++) {
                var key = methods[i];
                sitehound[key] = factory(key);
            }

            sitehound.done = function() {
                sitehound.isDone = true;
            }

            sitehound.SNIPPET_VERSION = '0.1';
        }
    }
}();

// your code here
sitehound.trackPages = {
    'Home': '/'
};
// call to trigger tracking after all config
sitehound.done();
