//
//  SiteHound - Easy & powerful website analytics tracking
//
//  Supports tracking events to:
//  - Segment.com's analytics.js
//  - mixpanel.js
//
//  Docs: http://www.sitehound.co
//  Source: https://github.com/andyyoung/sitehound
//
//  @author        Andy Young // @andyy // andy@apexa.co.uk
//  @version       0.95 - 28th April 2016
//  @licence       GNU GPL v3
//
//  Copyright (C) 2016 Andy Young // andy@apexa.co.uk
//  ~~ 500 Startups Distro Team // #500STRONG // 500.co ~~
//
//  This program is free software: you can redistribute it and/or modify
//  it under the terms of the GNU General Public License as published by
//  the Free Software Foundation, either version 3 of the License, or
//  (at your option) any later version.
//
//  This program is distributed in the hope that it will be useful,
//  but WITHOUT ANY WARRANTY; without even the implied warranty of
//  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
//  GNU General Public License for more details.
//
//  You should have received a copy of the GNU General Public License
//  along with this program.  If not, see <http://www.gnu.org/licenses/>.
//
!function() {
    var VERSION = "0.95";

    // where we store registered adaptors for different platforms
    var adaptors = {};

    // kickoff
    function init() {
        var initialConfig = window.sitehound || {};

        var adaptor = getAdaptor(initialConfig.adaptor);
        if (!adaptor) {
            // error
            return;
        }

        // initialize SiteHound when our adaptor's target library is ready
        adaptor.ready(function() {
            // grab our custom config and calls, if any
            var initialConfig = window.sitehound || {};
            // initialize SiteHound library, passing in our custom config
            var sitehound = new SiteHound(initialConfig, adaptor);
        });
    }

    function SiteHound(initialConfig, adaptor) {
        var config = {
            // object mapping names to match patterns for key pages we want to track
            // - by default we match against the page URL (location.pathname)
            // - strings beginning with a '.' match css classes on the <body>
            // match patterns can be simple strings, arrays, or regular expressions
            trackPages: null,
            // override detection of the current page (and therefore track this pageview event)
            page: null,
            // track all other pageviews not covered above? (as "unidentified")
            trackAllPages: false,
            // detect and track new pageview events if the window.location changes?
            detectURLChange: true,
            detectHashChange: false,

            // disable tracking on particular hosts
            domainsIgnore: ['localhost', 'gtm-msr.appspot.com'],
            domainsIgnoreIPAddress: true,
            domainsIgnoreSubdomains: ['staging', 'test'],

            // if we have any landing pages without this tracking installed, list them here
            // in order to track them as the "true" landing page when the user clicks through to
            // a page with tracking
            trackReferrerLandingPages: [],

            // traits to set globally for this user/session
            globalTraits: {},
            // traits to set only on any page event we may trigger during this pageview
            pageTraits: {},
            // traits to set on all events during this pageview, but not set globally for subsequent pageviews
            thisPageTraits: {},

            // do we have an ID for a logged-in user?
            userId: undefined,
            // traits to set on the user (like globalTraits, but will be prefixed with "User " to distinguish them)
            userTraits: {},
            // should we fire a logout event on this page if we don't have a userId set but were previously logged in?
            // - defaults to true if we've passed a value (incl. null), false otherwise
            detectLogout: undefined,

            // log informational messages to the console?
            logToConsole: false,
            // session timeout before tracking the start of a new session (in minutes)
            sessionTimeout: 30,
            // provide an overridden referrer to replce in when tracking on this page
            overrideReferrer: undefined,

            // queued-up methods to execute
            queue: []
        };

        var self = this;

        this.sniffed = false;

        this.adaptor = adaptor;
        if ((typeof adaptor !== 'object') || !adaptor.check()) {
            if (window.console && console.error) {
                console.error('[SiteHound] adaptor not valid');
            }
            return;
        }

        for (var key in config) {
            if (initialConfig[key] !== undefined) {
                config[key] = initialConfig[key];
            }
            this[key] = config[key];
        }

        this.thisPageTraits['SiteHound library version'] = this.VERSION = VERSION;

        // for auto-detection of page URL change (single-page sites e.g. angularjs)
        var intervalId, currentURL;

        //
        // privileged methods
        //

        this.sniff = this.done = function() {
            try {
                self.info('Sniffing..');
                // check we want to track this host
                if (ignoreHost(location.hostname)) {
                    self.info('Ignoring host: ' + location.hostname);
                    self.adaptor = 'disabled';
                    return;
                }
                if (getCookie('dnt')) {
                    self.info('do-not-track cookie present');
                    self.adaptor = 'disabled';
                    return;
                }

                // replay any ready() events queued up by the snippet before the lib was loaded
                replayReady();

                var firstSniff = !self.sniffed;
                // core tracking for on page load
                doSniff();

                // callback for adaptor
                if (typeof self.adaptor.afterSniff === 'function') {
                    self.adaptor.afterSniff();
                }

                // beyond this point should only be executed once per pageview
                if (!firstSniff) {
                    return;
                }

                // replay any remaining events queued up by the snippet before the lib was loaded
                // or calls since the lib was loaded but queued for post-sniffing
                replayQueue();

                // auto-detect URL change and re-trigger sniffing for any future virtual pageviews
                if ((self.detectURLChange || self.detectHashChange) && !intervalId) {
                    currentURL = location.href;
                    intervalId = setInterval(
                        function() {
                            if (self.detectHashChange ?
                                (location.href !== currentURL) :
                                (location.href.replace(/#.*$/, '') !== currentURL.replace(/#.*$/, ''))
                            ) {
                                self.overrideReferrer = currentURL || document.referrer;
                                currentURL = location.href;
                                self.info('Detected URL change: ' + currentURL);
                                self.page = undefined;
                                self.sniff();
                            }
                        },
                        1000
                    );
                }
            } catch(error) {
                this.trackError(error);
            }
        }

        this.deferUntilSniff = function(method, args) {
            if (self.sniffed) {
                // already sniffed - no need to defer
                return false;
            } // else - defer until we've sniffed
            // convert from Arguments type to real array
            args = Array.prototype.slice.call(args);
            args.unshift(method);
            self.queue.push(args);
            return true;
        }

        // like analytics.identify({..}), but only set traits if they're not already set
        this.identifyOnce = function(params) {
            if (self.deferUntilSniff('identifyOnce', arguments)) {return;}
            self.adaptor.identify(self.ignoreExistingTraits(params));
        }

        this.detectPage = function(path) {
            if (path === undefined) {
                path = location.pathname;
            }
            for (var page in self.trackPages) {
                var pattern = self.trackPages[page];
                // we support matching based on string, array or regex
                if (!Array.isArray(pattern)) {
                    pattern = [pattern];
                }
                for (var i = 0; i < pattern.length; ++i) {
                    var pat = pattern[i];
                    if (typeof pat.test === 'function') {
                        if (pat.test(path)) {
                            // regex matching URL path - TOCHECK
                            self.info('Detected page: ' + page);
                            return page;
                        }
                    } else if (pat[0] === '.') {
                        // match body css class
                        if ((path === location.pathname) &&
                            document.body.className.match(new RegExp('(?:^|\\s)' + escapeRegExp(pat.slice(1)) + '(?!\\S)'))) {
                            self.info('Detected page: ' + page);
                            return page;
                        }
                    } else {
                        // string match - match whole path
                        // we ignore presence of trailing slash on path
                        // treat * as a wildcard
                        if (path.replace(/\/$/, '').match(new RegExp('^' + escapeRegExp(pat.replace(/\/$/, '')).replace(/\\\*/g, '.*') + '$'))) {
                            self.info('Detected page: ' + page);
                            return page;
                        }
                    }
                }
            }
        }

        this.getTraitsToSend = function(traits) {
            var otherTraits = mergeObjects(self.globalTraits, self.thisPageTraits);
            if (typeof traits === 'object') {
                return mergeObjects(otherTraits, traits);
            } else {
                return otherTraits;
            }
        }

        this.info = function(message) {
            if (self.logToConsole && window.console && console.log) {
                if (typeof message === 'object') {
                    console.log(message);
                } else {
                    console.log('[SiteHound] ' + message);
                }
            }
        }

        this.doNotTrack = function(dnt) {
            dnt = (typeof dnt === 'undefined') ? true : !!dnt;
            if (dnt) {
                setCookie('dnt', '1', 1000);
            } else {
                // clear cookie - track again
                setCookie('dnt', '', -100);
            }
        }

        //
        // private methods
        //

        function ignoreHost(host) {
            if (self.domainsIgnore.indexOf(host) != -1) {
                // domain is one we've specifically listed to ignore
                return true;
            }
            if (self.domainsIgnoreIPAddress && /([0-9]{1,3}\.){3}[0-9]{1,3}/.test(host)) {
                // host is IP address, and we want to ignore these
                return true;
            }
            for (var i = 0; i < self.domainsIgnoreSubdomains.length; i++) {
                if (host.indexOf(self.domainsIgnoreSubdomains[i] + '.') == 0) {
                    // host matches a subdomain pattern we wish to ignore
                    return true;
                }
            }
            // else
            return false;
        }

        function doSniff() {
            // set this now so our tracking calls execute immediately without deferUntilSniff()
            self.sniffed = true;

            if (!self.page) {
                self.page = self.detectPage(location.pathname);
            }
            self.thisPageTraits['Page Type'] = self.page;

            if (self.overrideReferrer !== undefined) {
                self.thisPageTraits['referrer'] = self.thisPageTraits['Referrer'] = self.thisPageTraits['$referrer'] = self.overrideReferrer;
                //var referrerParts = self.thisPageTraits['referrer'].match(/https?:\/\/([^/]+)(\/.*)/),
                //    referrerHost;
                //if (referrerParts) {
                //    referrerHost = referrerParts[1];
                //}
                //self.thisPageTraits['Referring Domain'] = self.thisPageTraits['$referring_domain'] = referrerHost;
            }

            // track data related to the current session
            trackSession();

            // some user-related properties
            var userTraits = self.adaptor.userTraits();
            if (userTraits.createdAt) {
                self.globalTraits['Days Since Signup'] = Math.floor((new Date()-new Date(userTraits.createdAt))/1000/60/60/24);
                self.info('Days since signup: ' + self.globalTraits['Days Since Signup']);
            }
            if (self.userTraits['Email Domain']) {
                self.userTraits['Email Domain'] = self.userTraits['Email Domain'].match(/[^@]*$/)[0];
            } else if (userTraits.Email || userTraits.email || self.userTraits['Email']) {
                self.userTraits['Email Domain'] = (userTraits.Email || userTraits.email || self.userTraits['Email']).match(/[^@]*$/)[0];
            }

            // Fullstory.com session URL
            if (window.FS && window.FS.getCurrentSessionURL) {
                // ideally do it instantly so we don't trigger a separate identify() call
                self.globalTraits['Fullstory URL'] = FS.getCurrentSessionURL();
            } else if (!self.sniffed) {
                var _old_fs_ready = window._fs_ready;
                window._fs_ready = function() {
                    self.adaptor.identify({'Fullstory URL': FS.getCurrentSessionURL()});
                    if (typeof _old_fs_ready === 'function') {
                        _old_fs_ready();
                    }
                };
            }

            //
            // identify(), including user tracking as relevnt
            //
            if (self.userId) {
                // we have a logged-in user
                self.info('Received userId: ' + self.userId);
                var userTraits = {},
                    specialKeys = [
                        'name',
                        'email',
                        'createdAt'
                    ];
                for (var key in self.userTraits) {
                    // TODO: support for all segment/mixpanel special traits, and camel/snake case a la segment
                    // get the traits from the adaptor?
                    var keyLower = key.toLowerCase(),
                        newKey = '';
                    for (var i = 0; i < specialKeys.length; i++) {
                        if (keyLower === specialKeys[i].toLowerCase()) {
                            newKey = specialKeys[i];
                            break;
                        }
                    }
                    if (!newKey) {
                        newKey = 'User ' + titleCase(key);
                    }
                    userTraits[newKey] = self.userTraits[key];
                }
                var traits = mergeObjects(self.globalTraits, userTraits);
                var currentUserId;
                if (!self.adaptor.userId()) {
                    // session up to here has been anonymous
                    self.info('Anonymous session until now - alias()');
                    self.adaptor.alias(self.userId);
                    // hack: ensure identify() takes hold even if alias() was silently ignored because already in use
                    self.adaptor.identify('x');
                } else {
                    currentUserId = self.adaptor.userId();
                    self.info('Current userId: ' + currentUserId);
                }
                self.info('identify(' + self.userId + ', [traits])');
                if (self.userId !== currentUserId) {
                    // TOCHECK - set time of email verification as the user creation time
                    traits = mergeObjects(traits, ignoreExistingTraits({createdAt: new Date().toISOString()}));
                }
                self.adaptor.identify(self.userId, traits);
                if (self.userId !== currentUserId) {
                    self.info('userId != currentUserId - Login');
                    self.track('Login');
                }
                setCookie('logged_out', '', -100);
            } else {
                // no information about whether the user is currently logged in
                self.adaptor.identify(self.globalTraits);
                // by default, automatically detect logout if the userId property has been set
                //  - even if it's been set to null
                self.detectLogout = (self.detectLogout === undefined) ? (self.userId !== undefined) : self.detectLogout;
                if (self.detectLogout) {
                    self.info('Detecting potential logout..');
                    if (self.adaptor.userId()) {
                        // we were logged in earlier in the session
                        // track only once until next login
                        if (!getCookie('logged_out')) {
                            self.track('Logout');
                            setCookie('logged_out', true);
                            self.info('Logout');
                        }
                    }
                }
            }

            // track landing page event?
            if (self.trackLandingPage) {
                trackPage('Landing', self.landingPageTraits);
            }

            // track page view event?
            if (self.page) {
                // if the page contains a vertical bar, separate out the page vs. category
                var pageParts = self.page.split('|', 2).map(
                    function(a) {
                        return a.trim();
                    }
                );
                var args = pageParts.push(self.pageTraits);
                trackPage.apply(self, pageParts);
            } else if (self.trackAllPages) {
                trackPage('Unidentified');
            }
        }

        function trackSession() {
            // visitor first seen
            var firstSeen = getCookie('firstSeen') || new Date().toISOString();
            setCookie('firstSeen', firstSeen, 366);
            var daysSinceFirst = Math.floor((new Date() - new Date(firstSeen))/1000/60/60/24);
            self.globalTraits['First Seen'] = firstSeen;
            self.globalTraits['Days Since First Seen'] = daysSinceFirst;
            self.info('Visitor first seen: ' + firstSeen);
            self.info('Days since first seen: ' + daysSinceFirst);

            // session start + last updated time
            var sessionStarted = getCookie('sessionStarted') || new Date().toISOString(),
                sessionUpdated = getCookie('sessionUpdated') || new Date().toISOString();
            var sessionDuration = Math.floor((new Date() - new Date(sessionStarted))/1000/60),
                sessionSilent = Math.floor((new Date() - new Date(sessionUpdated))/1000/60);
            self.globalTraits['Session Started'] = sessionStarted;
            self.globalTraits['Minutes Since Session Start'] = sessionDuration;
            self.info('Session started: ' + sessionStarted);
            self.info('Session duration: ' + sessionDuration);
            self.info('Minutes since last event: ' + sessionSilent);
            var sessionTimedOut = sessionSilent > self.sessionTimeout;
            if (sessionTimedOut) {
                self.info('Session timed out - tracking as new session');
                sessionStarted = new Date().toISOString();
            }
            setCookie('sessionStarted', sessionStarted);
            setCookie('sessionUpdated', new Date().toISOString());

            // tracked pageviews this session
            var pageViews = (sessionTimedOut ? 0 : parseInt(getCookie('pageViews') || 0)) + 1;
            self.thisPageTraits['Pageviews This Session'] = pageViews;
            setCookie('pageViews', pageViews);
            self.info('Pageviews: ' + pageViews);

            var referrerParts = document.referrer.match(/https?:\/\/([^/]+)(\/.*)/),
                referrerHost = null,
                referrerPath;
            if (referrerParts) {
                referrerHost = referrerParts[1];
                referrerPath = referrerParts[2];
            }
            if (referrerHost == location.host) {
                self.thisPageTraits['Referrer Type'] = self.detectPage(referrerPath);
            }

            self.isLandingPage = false;
            if (!sessionTimedOut) {
                // is this a landing page hit? (i.e. first pageview in session)
                if (pageViews > 1) {
                    return;
                }
                self.isLandingPage = true;
                self.info('Detected landing page');
            }

            // session count for this visitor
            var sessionCount = parseInt(getCookie('sessionCount') || 0) + 1;
            self.globalTraits['Session Count'] = sessionCount;
            setCookie('sessionCount', sessionCount, 366);
            self.info('Session count: ' + sessionCount);

            if (sessionTimedOut) {
                // we don't update attribution tracking when tracking a new session due to inactivity
                return;
            }

            // track attribution params for this session
            var attributionParams = {};
            var paramNames = [
                'UTM Source',
                'UTM Medium',
                'UTM Campaign',
                'UTM Term',
                'UTM Content',
                'Landing Page',
                'Landing Page Type',
                'Initial Referrer',
                'Initial Referring Domain'
            ];
            for (var i = 0; i < paramNames.length; i++) {
                attributionParams[paramNames[i]] = null;
            }

            // utm params
            var utmParams = getUTMParams();
            if (Object.keys(utmParams).length > 0) {
                self.info('utm params:');
                self.info(utmParams);
                attributionParams = mergeObjects(attributionParams, utmParams);
            }

            // Landing page
            //
            // This is the first page on which we've tracked this user, so if the referrer is from the same domain,
            // then the referring page (likely the original landing page?) didn't have our tracking code implemented
            if (referrerHost === location.host) {
                // Did we specify to track this particular referrer as the original landing page?
                if (self.trackReferrerLandingPages.indexOf(referrerPath) !== -1) {
                    self.info('Detected known untracked landing page: ' + document.referrer);
                    self.trackLandingPage = true;
                    self.landingPageTraits = {
                        path: referrerPath,
                        url: document.referrer,
                        '$current_url': document.referrer,
                        'Tracked From URL': location.href,
                        referrer: ''
                    };
                    attributionParams['Landing Page'] = referrerPath;
                } else if (document.referrer === location.href) {
                    // referrer is the current page - treat as landing page
                    self.trackLandingPage = true;
                    attributionParams['Landing Page'] = location.pathname;
                } else if (sessionCount > 1) {
                    // not the first session - mostly likely page reload triggered with referrer but no session cookie
                    // due to reopening a previously-closed mobile browser
                    // - ignore
                } else {
                    self.trackDebugWarn('Landing page with local referrer - tracking code not on all pages?');
                }
            } else {
                self.trackLandingPage = true;
                attributionParams['Landing Page'] = location.pathname;
                attributionParams['Initial Referrer'] = document.referrer ? document.referrer : null;
                attributionParams['Initial Referring Domain'] = referrerHost;
            }

            // add some additional metadata
            if (attributionParams['Landing Page']) {
                attributionParams['Landing Page Type'] = self.page;
            }

            // automatic attribution detection
            if (!attributionParams['UTM Source']) {
                // adwords / doubleclick
                if (getQueryParam(document.URL, 'gclid') || getQueryParam(document.URL, 'gclsrc')) {
                    attributionParams['UTM Source'] = 'google';
                    if (!attributionParams['UTM Medium']) {
                        attributionParams['UTM Medium'] = 'cpc';
                    }
                }
                // Yesware
                if (attributionParams['Referring Domain'] == 't.yesware.com') {
                    attributionParams['UTM Source'] = 'Yesware';
                    if (!attributionParams['UTM Medium']) {
                        attributionParams['UTM Medium'] = 'email';
                    }
                }
            }

            var attributionParamsFirst = {},
                attributionParamsLast = {};
            for (var key in attributionParams) {
                attributionParamsFirst[key + ' [first touch]'] = attributionParams[key];
                attributionParamsLast[key + ' [last touch]'] = attributionParams[key];
            }

            self.info('Attribution params:');
            self.info(attributionParams);
            if (sessionCount == 1) {
                // only track first touch params on first session
                self.info('..setting first touch params');
                self.globalTraits = mergeObjects(self.globalTraits, ignoreExistingTraits(attributionParamsFirst));
            }
            self.info('..setting last touch params');
            self.globalTraits = mergeObjects(self.globalTraits, attributionParamsLast);
        }

        function trackPage(one, two, three) {
            if (typeof three === 'object') {
                self.adaptor.page(one, two, self.getTraitsToSend(three));
            } else if (typeof two === 'object') {
                self.adaptor.page(one, self.getTraitsToSend(two));
            } else if (two) {
                self.adaptor.page(one, two, self.getTraitsToSend());
            } else {
                self.adaptor.page(one, self.getTraitsToSend());
            }
        }

        function replayReady() {
            replay(getQueue(['ready']));
        }

        function replayQueue() {
            replay(getQueue());
            replay(self.queue);
        }

        function getQueue(methods) {
            if (!initialConfig.queue || !initialConfig.queue.length) {
                return;
            }
            if (!methods || !methods.length) {
                var queue = initialConfig.queue;
                initialConfig.queue = [];
                return queue;
            }
            var selected = [], remaining = [];
            for (var i = 0; i < initialConfig.queue.length; i++) {
                if (methods.indexOf(initialConfig.queue[i][0]) !== -1) {
                    selected.push(initialConfig.queue[i]);
                } else {
                    remaining.push(initialConfig.queue[i]);
                }
            }
            initialConfig.queue = remaining;
            return selected;
        }

        function replay(queue) {
            while (queue && queue.length > 0) {
                var args = queue.shift();
                var method = args.shift();
                if (self[method]) {
                    self[method].apply(self, args);
                }
            }
        }

        function setCookie(name, value, expiry_days, domain) {
            var expires = '';
            if (expiry_days != 0) {
                var d = new Date();
                d.setTime(d.getTime() + (expiry_days*24*60*60*1000));
                expires = 'expires='+d.toUTCString();
            }
            if (domain === undefined) {
                domain = self.cookieDomain;
            }
            document.cookie = 'sh_' + name + '=' + value + '; ' + expires + ';path=/' + (domain ? ';domain=' + domain : '');
        }

        function getCookie(cname) {
            var name = 'sh_' + cname + '=';
            var cs = document.cookie.split(';');
            for(var i=0; i < cs.length; i++) {
                var c = cs[i];
                while (c.charAt(0)==' ') c = c.substring(1);
                if (c.indexOf(name) == 0) return c.substring(name.length,c.length);
            }
            return '';
        }

        function getUTMParams() {
            var utm_params = 'utm_source utm_medium utm_campaign utm_content utm_term'.split(' '),
                kw = '',
                params = {};

            for (var index = 0; index < utm_params.length; ++index) {
                kw = getQueryParam(document.URL, utm_params[index]);
                if (kw.length) {
                    params['UTM ' + titleCase(utm_params[index].slice(4))] = kw;
                }
            }
            return params;
        }

        function getQueryParam(url, param) {
            param = param.replace(/[\[]/, "\\\[").replace(/[\]]/, "\\\]");
            var regexS = "[\\?&]" + param + "=([^&#]*)";
            var regex = new RegExp(regexS);
            var results = regex.exec(url);
            if (results === null || (results && typeof(results[1]) !== 'string' && results[1].length)) {
                return '';
            } else {
                return decodeURIComponent(results[1]).replace(/\+/g, ' ');
            }
        }

        function ignoreExistingTraits(params) {
            var traits = self.adaptor.userTraits(),
                newParams = {};
            for (var key in params) {
                if (!(key in traits)) {
                    newParams[key] = params[key];
                }
            }
            return newParams;
        }

        // Modified from https://github.com/segmentio/top-domain v2.0.1
        // @TODO: learn how to javascript good
        /**
         * Get the top domain.
         *
         * The function constructs the levels of domain
         * and attempts to set a global cookie on each one
         * when it succeeds it returns the top level domain.
         *
         * The method returns an empty string when the hostname
         * is an ip or `localhost`.
         *
         * Example:
         *
         *      domain('segment.io');
         *      // => 'segment.io'
         *      domain('www.segment.io');
         *      // => 'segment.io'
         *      domain('localhost');
         *      // => ''
         *      domain('dev');
         *      // => ''
         *      domain('127.0.0.1');
         *      // => ''
         */
        function topDomain(hostname) {
            var levels = domainLevels(hostname);
            // Lookup the real top level one.
            for (var i = 0; i < levels.length; ++i) {
                var cname = '__tld__';
                var domain = '.' + levels[i];
                setCookie(cname, 1, 0, domain);
                if (getCookie(cname)) {
                    setCookie(cname, '', -100, domain);
                    return domain
                }
            }
            return '';
        };

        /**
         * Returns all levels of the given url
         *
         * Example:
         *
         *      domain('www.google.co.uk');
         *      // => ["co.uk", "google.co.uk", "www.google.co.uk"]
         */
        function domainLevels(hostname) {
            var parts = hostname.split('.');
            var last = parts[parts.length-1];
            var levels = [];
            // Ip address.
            if (4 == parts.length && parseInt(last, 10) == last) {
                return levels;
            }
            // Localhost.
            if (1 >= parts.length) {
                return levels;
            }
            // Create levels.
            for (var i = parts.length-2; 0 <= i; --i) {
                levels.push(parts.slice(i).join('.'));
            }
            return levels;
        };
        // END grab from https://github.com/segmentio/top-domain

        //
        // final initialisation steps
        //
        this.info('Ready (v' + VERSION + ')');

        this.cookieDomain = topDomain(location.hostname);
        this.info('Cookie domain: ' + this.cookieDomain);

        if (getCookie('dnt')) {
            self.info('do-not-track cookie present');
            self.adaptor = 'disabled';
            return;
        }

        // replace the global sitehound var with our instance
        window.sitehound = this;

        if (initialConfig.isDone) {
            this.sniff();
        }        
    }

    //
    // public methods
    //

    SiteHound.prototype.identify = function(a, b) {
        if (this.deferUntilSniff('identify', arguments)) {return;}

        this.adaptor.identify(a, b);
    }

    SiteHound.prototype.track = function(event, traits) {
        if (this.deferUntilSniff('track', arguments)) {return;}

        if (typeof traits == 'object') {
            this.adaptor.track(event, this.getTraitsToSend(traits));
        } else {
            this.adaptor.track(event, this.getTraitsToSend());
        }
    }

    // similar to identifyOnce, but also track event
    SiteHound.prototype.trackOnce = function(event, params) {
        if (this.deferUntilSniff('trackOnce', arguments)) {return;}

        var traits = this.adaptor.userTraits();

        if (traits['First ' + event] === undefined) {
            var userParams = {};
            userParams['First ' + event] = new Date().toISOString();

            this.adaptor.identify(userParams);
            this.track(event, params);
        }
    }

    SiteHound.prototype.trackAndCount = function(event, params) {
        if (this.deferUntilSniff('trackAndCount', arguments)) {return;}

        var traits = this.adaptor.userTraits();

        var count = 1;
        if (traits) {
            count = traits[event + ' Count'] ? parseInt(traits[event + ' Count']) + 1: 1;
        }

        var onceTraits = {};
        onceTraits['First ' + event] = new Date().toISOString();
        this.identifyOnce(onceTraits);

        var identifyTraits = {};
        identifyTraits[event + ' Count'] = count;
        identifyTraits['Last ' + event] = new Date().toISOString();
        this.adaptor.identify(identifyTraits);
        this.track(event, params);
    }

    SiteHound.prototype.trackLink = function(elements, name) {
        if (this.deferUntilSniff('trackLink', arguments)) {return;}

        this.adaptor.trackLink(elements, name, this.getTraitsToSend());
    }

    SiteHound.prototype.trackForm = function(elements, name) {
        if (this.deferUntilSniff('trackForm', arguments)) {return;}

        this.adaptor.trackForm(elements, name, this.getTraitsToSend());
    }

    SiteHound.prototype.ready = function(f) {
        if (typeof f === 'function') {
            this.info('ready()');
            f();
        } else {
            if (window.console && console.error) {
                console.error("[SiteHound] ready() called with something that isn't a function");
            }
        }
    }

    SiteHound.prototype.getUserTraits = function() {
        return mergeObjects(this.adaptor.userTraits(), this.userTraits);
    }

    SiteHound.prototype.load = function(adaptor) {
        this.info('load() called when already loaded');
        if (adaptor) {
            this.info('updating adaptor to: ' + adaptor);
            this.adaptor = getAdaptor(adaptor);
        }
    }

    //
    // tracking for debugging our tracking ¯\_(ツ)_/¯
    //

    SiteHound.prototype.trackDebugInfo = function(message) {
        this.trackDebug(message, 'info');
    }

    SiteHound.prototype.trackDebugWarn = function(message) {
        this.trackDebug(message, 'warn');
    }

    SiteHound.prototype.trackDebug = function(message, level) {
        if (!level) {
            level = 'info';
        }
        this.adaptor.track('Tracking Debug', {
            message: message,
            level: level,
            'SiteHound library version': this.VERSION
        });
        this.info('[' + level + '] ' + message);
    }

    SiteHound.prototype.trackError = function(error) {
        this.adaptor.track('Tracking Error', {
            name: error.name,
            message: error.message,
            'SiteHound library version': this.VERSION
        });
        if (window.console && console.error) {
            console.error('[SiteHound] ' + error.name + '; ' + error.message);
        }
    }

    //
    // utility methods
    //

    function titleCase(str) {
        return typeof str === 'string'
            ? str.replace(/\w\S*/g, function(txt) { return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase(); })
            : str;
    }

    function mergeObjects(obj1, obj2) {
        var obj3 = {};
        for (var attrname in obj1) { obj3[attrname] = obj1[attrname]; }
        for (var attrname in obj2) { obj3[attrname] = obj2[attrname]; }
        return obj3;
    }

    function escapeRegExp(str) {
        return str.replace(/([\/*.?[\]()\-\|])/g, '\\$1');
    }

    function registerAdaptor(klass, adaptor) {
        adaptors[klass] = adaptor;
    }

    function getAdaptor(adaptor) {
        var adaptorClass, result;
        if (typeof adaptor === 'object') {
            result = adaptor;
        } else {
            // initialize adaptor for the analytics library we want to use
            adaptorClass = ((adaptor || 'segment').toLowerCase()) || 'segment';
            try {
                var result = new adaptors[adaptorClass];
            } catch (error) {
                if (window.console && console.error) {
                    console.error('[SiteHound] adaptor ' + adaptorClass + " could not be loaded");
                    console.error('[SiteHound] ' + error.name + '; ' + error.message);
                }
                return;
            }
        }
        if (!result.check()) {
            if (window.console && console.error) {
                console.error('[SiteHound] failed to attach to ' + (adaptorClass ? adaptorClass : 'adaptor'));
            }
            return;
        }
        return result;
    }

    //
    // Adaptors
    //

    registerAdaptor('disabled', function() {
        // tracking disabled
        this.check = this.ready = this.identify = this.track = this.trackLink = this.trackForm
            = this.page = this.alias = this.userId = this.userTraits
            = function() {}
    });


    registerAdaptor('segment', function() {
        window.analytics = window.analytics || [];
        var self = this;

        this.check = function() {
            return typeof analytics.ready !== 'undefined';
        }

        if (!this.check()) {
            if (window.console && console.error) {
                console.error('[SiteHound] window.analytics is not initialized - ensure analytics.js snippet is included first');
            }
            return;
        }

        this.calledPage = false;
        analytics.on('page', function() {
            self.calledPage = true;
        });

        this.ready = function(f) {
            analytics.ready(f);
        }

        this.identify = function(a, b) {
            analytics.identify(a, b);
        }

        this.track = function(event, traits) {
            analytics.track(event, traits);
        }

        this.trackLink = function(elements, event, traits) {
            analytics.trackLink(elements, event, traits);
        }

        this.trackForm = function(elements, event, traits) {
            analytics.trackForm(elements, event, traits);
        }

        this.page = function(a, b, c) {
            self.calledPage = true;
            analytics.page(a, b, c);
        }

        this.alias = function(to) {
            analytics.alias(to);
        }

        this.userId = function() {
            var user = analytics.user();
            return user ? user.id() : undefined;
        }

        this.userTraits = function() {
            var user = analytics.user();
            var traits = user.traits();
            return traits;
        }

        this.afterSniff = function() {
            if (!self.calledPage) {
                // Segment.com requires we call page() at least once
                analytics.page();
            }
        }
    });

    // let's go
    init();
}();
