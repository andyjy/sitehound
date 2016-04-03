!function() {
    var sitehound = window.sitehound = window.sitehound || {};

    var SCRIPT_URL = ('https:' === document.location.protocol ? 'https://' : 'http://')
        + 'andyyoung.github.io/sitehound/sitehound.js';

    if (!sitehound.sniff) {
        // sitehound.js not yet loaded

        if (sitehound.invoked) {
            var m = 'SiteHound snippet included twice';
            if (window.console && console.error) {
                console.error(m);
            }
            sitehound.trackDebugWarn(m);
            return;
        }

        sitehound.invoked = true;
        sitehound.queue = [];

        var methods = [
            'track',
            'trackAndCount',
            'trackLink',
            'trackForm',
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

        sitehound.sniff = sitehound.done = function() {
            sitehound.isDone = true;
        }

        sitehound.SNIPPET_VERSION = '1.2';

        sitehound.load = function(adaptor) {
            sitehound.adaptor = adaptor;

            var script = document.createElement('script');
            script.type = 'text/javascript';
            script.async = true;
            script.src = SCRIPT_URL + '?snippet_ver=' + sitehound.SNIPPET_VERSION;
            var first = document.getElementsByTagName('script')[0];
            first.parentNode.insertBefore(script, first);
        }
    }
}();
sitehound.load('segment');

// your code here
sitehound.trackPages = {
    'Home': '/'
};
// call to trigger tracking after all config
sitehound.sniff();
