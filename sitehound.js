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
//  @version       0.9.74 - 15th Nov 2016
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
    var VERSION = "0.9.75",
        CONSOLE_PREFIX = '[SiteHound] ',
        ALIAS_WAIT_TIMEOUT = 600; // milliseconds

    // where we store registered adaptors for different platforms
    var adaptors = {};

    // kickoff
    function init() {
        var initialConfig = window.sitehound = window.sitehound || [];

        var adaptor = getAdaptor(initialConfig.adaptor);
        if (!adaptor) {
            // error
            return;
        }

        // initialize SiteHound when our adaptor's target library is ready
        if (!initialConfig.silent) {
            log('Waiting for the ' + adaptor.klass + ' adaptor to load..');
        }
        adaptor.ready(function() {
            // grab our custom config and calls, if any
            var initialConfig = window.sitehound || [];
            // initialize SiteHound library, passing in our custom config
            var sitehound = new SiteHound(initialConfig, adaptor);
        });
    }

    function SiteHound(initialConfig, adaptor) {
        var self = this;

        // for auto-detection of page URL change (single-page sites e.g. angularjs)
        var intervalId,
            currentURL,
            urlChangeQueue = [];

        // store for deferred adaptor functions
        var adaptorDeferredFunctions,
            adaptorDeferredQueue = [];

        // maintain list of Optimizely Experiment IDs we've detected
        var optimizelyActiveExperimentsDetected = [],
            optimizelyIntervalId;

        if (initialConfig.adaptor && ((initialConfig.adaptor.klass || initialConfig.adaptor) !== adaptor.klass)) {
            // adaptor has been changed since initial load
            setAdaptor(getAdaptor(initialConfig.adaptor));
        } else {
            setAdaptor(adaptor);
        }
        if (typeof this.adaptor !== 'object') {
            error('adaptor not valid');
            return;
        }

        // wrapper for initialization
        !function() {
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

                // disable tracking from particular IP addresses
                // supports * wildcard and prefix match e.g. 'w.*.y.' matches 'w.x.y.z'
                ignoreIPs: [],
                // add traits for visitors from particular IP addresses
                // accepts array of objects with two keys: ip (string or array, wildcard + prefix matches as above), and traits (object)
                addTraitsForIPs: [], // [{ip: 'w.x.y.z', traits: {a:'b', ..}}, {ip: ['w.x.y.z', ..], traits: {..}}, ..]

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

                // suppress all non-error output to the console?
                silent: false,
                // session timeout before tracking the start of a new session (in minutes)
                sessionTimeout: 30,
                // provide an overridden referrer to replce in when tracking on this page
                overrideReferrer: undefined,

                // queued-up methods to execute
                queue: [],

                // locally-persisted client context - stored urlencoded via cookie
                clientContext: {},
                // ..stored only for the session duration
                clientSessionContext: {},

                // preserve from snippet to assist with debugging
                SNIPPET_VERSION: undefined
            };

            self.sniffed = false;

            // process array-style queue
            for (var key in config) {
                if (initialConfig[key] !== undefined) {
                    config[key] = initialConfig[key];
                }
                self[key] = config[key];
            }

            while (initialConfig.length && initialConfig.pop) {
                // window.sitehound quacks like an array
                // prepend each method call to the queue
                self.queue.unshift(initialConfig.pop());
            }

            self.thisPageTraits['SiteHound library version'] = self.VERSION = VERSION;
        }();

        // final initialization steps
        function completeInit() {
            self.info('Loaded (version ' + VERSION + ', adaptor: ' + self.adaptor.klass + ')');

            self.cookieDomain = topDomain(location.hostname);
            self.debug('Cookie domain: ' + self.cookieDomain);

            // populate from cookie
            readLocalContext();

            if (self.clientContext.dnt) {
                self.info('Do-not-track cookie present - disabling.');
                self.disable();
            }

            // replace the global sitehound var with our instance
            window.sitehound = self;

            if (window.mixpanel && window.mixpanel.persistence && document.cookie.indexOf(window.mixpanel.persistence.name + '=') > -1) {
                // detected Mixpanel cookie - warn to switch to localstorage
                error('Warning: Mixpanel cookie detected - update Mixpanel config to use localStorage.');
            }

            // replay any ready()/identify() events queued up by the snippet before the lib was loaded
            replayPreSniff();

            if (initialConfig.sniffOnLoad || initialConfig.isDone) { // isDone: legacy
                self.sniff();
            }
        }

        //
        // privileged methods
        //

        this.sniff = this.done = function() { // done(): legacy name
            try {
                self.info('sniff()');
                // check we want to track this host
                if (ignoreHost(location.hostname)) {
                    self.info('Ignoring host: ' + location.hostname);
                    self.disable();
                }
                if (self.clientContext.dnt) {
                    self.info('Do-not-track cookie present - disabling.');
                    self.disble();
                }

                if (self.ignoreIPs || self.addTraitsForIPs) {
                    // if not yet known, will lookup asynchronously in time for the next pageview
                    getClientIP();
                    if (ignoreIP()) {
                        self.info('Ignoring IP: ' + self.clientContext.ip + '; matched pattern: ' + (self.ignoreIPs.join ? self.ignoreIPs.join(',') : self.ignoreIPs));
                        self.disable();
                    }
                    addTraitsForIP();
                }

                var firstSniff = !self.sniffed;
                // core tracking for on page load
                doSniff();

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
                                urlChanged(currentURL);
                                currentURL = location.href;
                            }
                        },
                        1000
                    );
                }
            } catch (e) {
                this.trackError(e);
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
            self.debug('(Deferring ' + method + '() until sniff)');
            return true;
        }

        this.identify = function(a, b) {
            self.debug('identify', [a, b]);
            if (typeof b === 'object') {
                // (id, traits)
                self.userId = a;
                self.globalTraits = mergeObjects(self.globalTraits, b);
            } else if (typeof a === 'object') {
                // (traits)
                self.globalTraits = mergeObjects(self.globalTraits, a);
            } else {
                // (id)
                self.userId = a;
            }
            if (self.sniffed) {
                // already sniffed - call adaptor.identify()
                doIdentify();
            } // else - adaptor.identify() will be called when we sniff()
        }

        // like analytics.identify({..}), but only set traits if they're not already set
        this.identifyOnce = function(params) {
            if (self.deferUntilSniff('identifyOnce', arguments)) {return;}
            self.debug('identifyOnce', params);
            self.adaptor.identifyOnce(params);
        }

        this.detectPage = function(path) {
            if (path === undefined) {
                path = location.pathname;
                if (self.page) {
                    self.debug('Page manually set to: ' + self.page);
                    return self.page;
                }
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
                            self.debug('Detected page: ' + page);
                            return page;
                        }
                    } else if (pat[0] === '.') {
                        // match body css class
                        if ((path === location.pathname) &&
                            document.body.className.match(new RegExp('(?:^|\\s)' + escapeRegExp(pat.slice(1)) + '(?!\\S)'))) {
                            self.debug('Detected page: ' + page);
                            return page;
                        }
                    } else {
                        // string match - match whole path
                        // we ignore presence of trailing slash on path
                        // treat * as a wildcard
                        if (path.replace(/\/$/, '').match(new RegExp('^' + escapeRegExp(pat.replace(/\/$/, '')).replace(/\\\*/g, '.*') + '$'))) {
                            self.debug('Detected page: ' + page);
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

        this.info = function(message, object) {
            if (self.silent) {
                return;
            }
            log(message, object);
        }

        this.debug = function(message, object) {
            if (!self.clientContext.logToConsole) {
                return;
            }
            log(message, object);
        }

        this.doNotTrack = function(dnt) {
            dnt = (typeof dnt === 'undefined') ? true : !!dnt;
            setLocalContext('dnt', dnt);
            self.debug('doNotTrack:' + dnt);
        }

        this.debugMode = function(logToConsole) {
            logToConsole = (typeof logToConsole === 'undefined') ? true : !!logToConsole;
            setLocalContext('logToConsole', logToConsole);
            self.debug('debugMode: ' + logToConsole);
        }

        this.onURLChange = this.onUrlChange = function(f) {
            if (typeof f === 'function') {
                this.debug('onURLChange()');
                urlChangeQueue.push(f);
            } else {
                error("onURLChange() called with something that isn't a function");
            }
        }

        this.load = function(adaptor) {
            self.debug('load() called when already loaded');
            if (adaptor) {
                setAdaptor(getAdaptor(adaptor));
                self.info('Updated adaptor to: ' + self.adaptor.klass);
            }
        }

        this.disable = function() {
            setAdaptor(getAdaptor('disabled'));
            self.info('Disabled tracking');
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

        function getClientIP() {
            // refresh client IP every 30 minutes
            if (!self.clientContext.ip
                || !self.clientContext.ipLookupTime
                || ((new Date().getTime() - self.clientContext.ipLookupTime) > 1800000)) {
                // make call to ipify.com to get the client IP address
                self.debug('looking up ip');
                var jsonpCallbackHash = Math.random().toString(36).substring(2,12);
                self['setIP_' + jsonpCallbackHash] = function(ip) {
                    self.debug('received IP: ', ip);
                    if (!ip || !ip.ip) { return; }
                    setLocalContext('ip', ip.ip);
                    setLocalContext('ipLookupTime', new Date().getTime());
                };
                var script = document.createElement('script');
                script.type = 'text/javascript';
                script.async = true;
                script.src = 'https://api.ipify.org?format=jsonp&callback=sitehound.setIP_' + jsonpCallbackHash;
                var first = document.getElementsByTagName('script')[0];
                first.parentNode.insertBefore(script, first);
            }
            return self.clientContext.ip;
        }

        function ignoreIP() {
            if (!self.clientContext.ip || !self.ignoreIPs || !self.ignoreIPs.length) {
                return;
            }
            console.log(getIPRegExp(self.ignoreIPs));
            return getIPRegExp(self.ignoreIPs).test(self.clientContext.ip);
        }

        function addTraitsForIP() {
            if (!self.addTraitsForIPs || !self.addTraitsForIPs.map) { return; }
            self.addTraitsForIPs.map(function(rule) {
                if (rule && rule.ip && rule.traits) {
                    if (getIPRegExp(rule.ip).test(self.clientContext.ip)) {
                        self.debug('Matched IP rule: ' + rule.ip, rule.traits);
                        self.globalTraits = mergeObjects(self.globalTraits, rule.traits);
                    }
                } else {
                    console.debug('Invalid addTraitsForIP rule', rule);
                }
            });
        }

        function getIPRegExp(ip) {
            if (ip && ip.map) {
                return new RegExp('^(' + ip.map(function(i) { return getIPRegExp(i).toString().replace(/[\/\^\$]/g, ''); })
                    .join('|') + ')$');
            }
            return new RegExp('^' + ip.replace(/\./g, '\\.').replace(/\.$/, '.*').replace('*', '.+') + '$');
        }

        function doSniff() {
            // set this now so our tracking calls execute immediately without deferUntilSniff()
            self.sniffed = true;

            if (!self.page) {
                self.page = self.detectPage();
            }
            self.thisPageTraits['Page Type'] = self.page;

            // cleanify
            if (self.userId === 'undefined') {
                self.userId = undefined;
            }

            // collect data related to the current session
            examineSession();

            // some user-related properties
            var userTraits = self.adaptor.userTraits();
            if (userTraits.createdAt) {
                self.globalTraits['Days Since Signup'] = Math.floor((new Date()-new Date(userTraits.createdAt))/1000/60/60/24);
                self.debug('Days since signup: ' + self.globalTraits['Days Since Signup']);
            }
            if (self.userTraits['Email Domain']) {
                self.userTraits['Email Domain'] = self.userTraits['Email Domain'].match(/[^@]*$/)[0];
            } else if (userTraits.Email || userTraits.email || self.userTraits['Email']) {
                self.userTraits['Email Domain'] = (userTraits.Email || userTraits.email || self.userTraits['Email']).match(/[^@]*$/)[0];
            }

            // Fullstory.com session URL
            if (window.FS && window.FS.getCurrentSessionURL) {
                // ideally do it instantly so we don't trigger a separate identify() call
                self.globalTraits['Fullstory URL'] = FS.getCurrentSessionURL() || '';
            } else if (!self.sniffed) {
                var _old_fs_ready = window._fs_ready;
                window._fs_ready = function() {
                    self.adaptor.identify({'Fullstory URL': FS.getCurrentSessionURL() || ''});
                    if (typeof _old_fs_ready === 'function') {
                        _old_fs_ready();
                    }
                };
            }

            // Optimizely
            var optimizelyEvents = detectOptimizelyExperiments(userTraits);

            if (self.overrideReferrer !== undefined) {
                self.thisPageTraits['referrer'] = self.thisPageTraits['Referrer'] = self.thisPageTraits['$referrer'] = self.overrideReferrer;
            }

            // handle user identification, including login/logout
            doIdentify();

            // track session started event?
            if (self.trackSessionStart) {
                self.track('Session Started');
                // only do this once
                self.trackSessionStart = false;
            }
            // track landing page event?
            if (self.trackLandingPage) {
                self.track('Viewed Landing Page', self.landingPageTraits);
                // only do this once
                self.trackLandingPage = false;
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

            // track Optimizely experiment views after we've handled user identification and page tracking
            trackOptimizelyEvents(optimizelyEvents);
            // poll for newly activted Optimizely experiments
            if (!optimizelyIntervalId && window.optimizely && window.optimizely.data) {
                optimizelyIntervalId = setInterval(
                    function() { trackOptimizelyEvents(detectOptimizelyExperiments()); },
                    300
                );
            }
        }

        function examineSession() {
            // visitor first seen
            var firstSeen = self.clientContext.firstSeen || new Date().toISOString();
            setLocalContext('firstSeen', firstSeen);
            var daysSinceFirst = Math.floor((new Date() - new Date(firstSeen))/1000/60/60/24);
            self.globalTraits['First Seen'] = firstSeen;
            self.globalTraits['Days Since First Seen'] = daysSinceFirst;
            self.debug('Visitor first seen: ' + firstSeen);
            self.debug('Days since first seen: ' + daysSinceFirst);

            // session start + last updated time
            var sessionStarted = self.clientSessionContext.sessionStarted || new Date().toISOString(),
                sessionUpdated = self.clientSessionContext.sessionUpdated || new Date().toISOString();
            var sessionSilent = Math.floor((new Date() - new Date(sessionUpdated))/1000/60);
            self.debug('Session started: ' + sessionStarted);
            self.debug('Minutes since last event: ' + sessionSilent);
            var sessionTimedOut = sessionSilent > self.sessionTimeout;
            if (sessionTimedOut) {
                self.debug('Session timed out - tracking as new session');
                sessionStarted = new Date().toISOString();
            }
            var sessionDuration = Math.floor((new Date() - new Date(sessionStarted))/1000/60);
            self.debug('Session duration: ' + sessionDuration);
            self.globalTraits['Session Started'] = sessionStarted;
            self.globalTraits['Minutes Since Session Start'] = sessionDuration;
            setLocalContext('sessionStarted', sessionStarted, true);
            setLocalContext('sessionUpdated', new Date().toISOString(), true);

            // tracked pageviews this session
            var pageViews = (sessionTimedOut ? 0 : parseInt(self.clientSessionContext.pageViews || 0)) + 1;
            self.thisPageTraits['Pageviews This Session'] = pageViews;
            setLocalContext('pageViews', pageViews, true);
            self.debug('Pageviews: ' + pageViews);

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

            self.thisPageTraits['Host'] = location.host;

            if (!sessionTimedOut) {
                // is this a landing page hit? (i.e. first pageview in session)
                if (pageViews > 1) {
                    // not a landing page - nothing further to do here
                    return;
                }
                self.debug('Detected landing page');
            }

            // session count for this visitor
            var sessionCount = parseInt(self.clientContext.sessionCount || 0) + 1;
            self.globalTraits['Session Count'] = sessionCount;
            setLocalContext('sessionCount', sessionCount);
            self.debug('Session count: ' + sessionCount);

            // at this point we're either a landing page hit or counting a new session due to timeout
            // track Session Started event for identified users and session timeouts
            // i.e. not anonymous landing pages, of which we typically expect many
            // but already have the Landing Page event for.
            self.trackSessionStart = sessionTimedOut || self.userId;

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
                attributionParams[paramNames[i]] = '';
            }

            // utm params
            var utmParams = getUTMParams();
            if (Object.keys(utmParams).length > 0) {
                self.debug('utm params:');
                self.debug(utmParams);
                attributionParams = mergeObjects(attributionParams, utmParams);
            }

            // Landing page
            //
            // This is the first page on which we've tracked this user, so if the referrer is from the same domain,
            // then the referring page (likely the original landing page?) didn't have our tracking code implemented
            if (referrerHost === location.host) {
                // Did we specify to track this particular referrer as the original landing page?
                if (self.trackReferrerLandingPages.indexOf(referrerPath) !== -1) {
                    self.debug('Detected known untracked landing page: ' + document.referrer);
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
                attributionParams['Initial Referrer'] = document.referrer ? document.referrer : '';
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

            self.debug('Attribution params:');
            self.debug(attributionParams);
            if ((sessionCount == 1) && (self.thisPageTraits['Pageviews This Session'] == 1)) {
                // only track first touch params on first session
                self.debug('..setting first touch params');
                self.globalTraits = mergeObjects(self.globalTraits, attributionParamsFirst);
            }
            self.debug('..setting last touch params');
            self.globalTraits = mergeObjects(self.globalTraits, attributionParamsLast);
        }

        function detectOptimizelyExperiments(userTraits) {
            var result = [];

            var optimizely = window.optimizely;
            if (!optimizely || !optimizely.data) {
                return result;
            }

            var oData = optimizely.data;
            var oState = oData.state,
                oSections = oData.sections;
            var activeExperiments = oState.activeExperiments;

            if(oState.redirectExperiment) {
                var redirectExperimentId = oState.redirectExperiment.experimentId;
                var index = oState.activeExperiments.indexOf(redirectExperimentId);
                if (index === -1) {
                    activeExperiments.push(redirectExperimentId);
                    self.overrideReferrer = oState.redirectExperiment.referrer;
                }
            }

            if (!activeExperiments.length) {
                // return empty result
                return result;
            }

            if (userTraits === undefined) {
                userTraits = self.adaptor.userTraits();
            }

            var oEsKey = 'Optimizely Experiments',
                oVsKey = 'Optimizely Variations';
            var oEs = userTraits[oEsKey],
                oVs = userTraits[oVsKey];
            self.globalTraits[oEsKey] = oEs ? (typeof oEs.sort === 'function' ? oEs : [oEs]) : [];
            self.globalTraits[oVsKey] = oVs ? (typeof oVs.sort === 'function' ? oVs : [oVs]) : [];

            for (var i = 0; i < activeExperiments.length; i++) {
                var experimentId = activeExperiments[i];
                if (optimizelyActiveExperimentsDetected.indexOf(experimentId) > -1) {
                    // already tracked this active experiment
                    continue;
                }

                var variationId = oState.variationIdsMap[experimentId][0].toString();
                var experimentTraits = {
                    'Experiment ID': experimentId,
                    'Experiment Name': oData.experiments[experimentId].name,
                    'Experiment First View': !oEs || !oEs.indexOf || (oEs.indexOf(experimentId) === -1),
                    'Variation ID': variationId,
                    'Variation Name': oState.variationNamesMap[experimentId]
                };
                if (self.globalTraits[oEsKey].indexOf(experimentId) === -1) {
                    self.globalTraits[oEsKey].push(experimentId);
                }
                var multiVariate = oSections[experimentId];
                if (multiVariate) {
                    experimentTraits['Section Name'] = multiVariate.name;
                    experimentTraits['Variation ID'] = multiVariate.variation_ids.join();
                    for (var v = 0; v < multiVariate.variation_ids.length; v++) {
                        if (self.globalTraits[oVsKey].indexOf(multiVariate.variation_ids[v]) === -1) {
                            self.globalTraits[oVsKey].push(multiVariate.variation_ids[v]);
                        }
                    }
                } else {
                    if (self.globalTraits[oVsKey].indexOf(variationId) === -1) {
                        self.globalTraits[oVsKey].push(variationId);
                    }
                }
                result.push(['Optimizely Experiment Viewed', experimentTraits]);
            }
            if (result.length) {
                self.globalTraits[oEsKey].sort();
                self.globalTraits[oVsKey].sort();
            }
            return result;
        }

        function trackOptimizelyEvents(events) {
            for (var i = 0; i < events.length; i++) {
                self.track(events[i][0], events[i][1]);
            }
        }

        // handle user identification, including login/logout
        function doIdentify() {
            // to be explicit
            var mixpanel = window.mixpanel;
            var amplitude = window.amplitude;
            if (self.userId) {
                // we have a logged-in user
                self.debug('doIdentify(): received userId: ' + self.userId);
                var userTraits = {},
                    specialKeys = [
                        'name',
                        'firstName',
                        'lastName',
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
                    self.debug('Anonymous session until now');
                    // ~~ Mixpanel hack ~~
                    // At this point we alias() for Mixpanel
                    // (alias() is not implemented with most other tools - e.g. Amplitude aliases anon => logged in users by default)
                    //
                    // For Mixpanel, we consciously go against their recommendation and always alias() on login
                    // If a profile with this user ID already exists within Mixpanel, it will ignore the alias() call
                    //
                    // Below, we subsequently ensure identify() takes hold even if alias() was silently ignored because already in use
                    //
                    // First, alias() for Segment - will be passed through to data warehouse etc
                    if (usingSegment()) {
                        self.debug('analytics.alias(' + self.userId + ')');
                        self.adaptor.alias(self.userId,
                            undefined,
                            {integrations: {'Mixpanel': false}}
                        );
                    }
                    // handle Mixpanel specially
                    if (usingMixpanel()) {
                        // recreate mixpanel.alias() but with our own behaviours
                        var current = mixpanel.get_distinct_id ? mixpanel.get_distinct_id() : null;
                        if (current != self.userId) {
                            self.debug('Mixpanel: $create_alias');
                            // pause future identify() and track() calls until the alias() callback has completed
                            pauseAdaptor();
                            mixpanel.register({ '__alias': self.userId });
                            mixpanel.track('$create_alias', { 'alias': self.userId, 'distinct_id': current }, function() {
                                // callback - mixpanel alias API call complete
                                // unlike mixpanel.js, we don't call identify() here (to flush the people queue)
                                // since we're calling it shortly anyhow
                                //
                                // resume paused calls
                                self.debug('Mixpanel: $create_alias callback');
                                resumeAdaptor();
                            });
                            // unpause within 300ms regardless
                            setTimeout(function() {
                                self.debug('Mixpanel: ALIAS_WAIT_TIMEOUT reached');
                                resumeAdaptor();
                                }, ALIAS_WAIT_TIMEOUT);
                        } else {
                            self.debug('mixpanel.distinct_id == sitehound.userId; no Mixpanel alias call');
                        }
                    }
                } else {
                    // We previously had a userId
                    currentUserId = self.adaptor.userId();
                    self.debug('Current userId: ' + currentUserId);
                    if (self.userId !== currentUserId) {
                        // User ID mismatch - we need to log out
                        var amp;
                        if (usingAmplitude() && amplitude.getInstance && (amp = amplitude.getInstance())) {
                            self.debug('Amplitude: logout');
                            // Amplitude logout: https://github.com/amplitude/Amplitude-Javascript/#logging-out-and-anonymous-users
                            // Force log out so Amplitude doesn't combine user profiles as by default
                            amp.setUserId(null);
                            // Amplitude uses it's Device ID to track users, and to implement a log out requires
                            // us to explicitly create a new Device ID
                            if (amp.regenerateDeviceId) {
                                amp.regenerateDeviceId();
                            }
                        }
                        // else if not using Amplitude - no need to log out
                        // instead we overwrite with new userId via the calls below
                        // NB if this is a first-time login for the new userID, this will legitimately create a new
                        // profile with distinct_id as the new ID, rather than a UUID
                    }
                }
                self.debug('adaptor.identify(' + self.userId + ', [traits])');
                self.adaptor.identify(self.userId, traits);
                if (usingMixpanel()) {
                    // Mixpanel fix: ensure we set mixpanel.distinct_id - and thus send all subsequent events with
                    // the new userId - even if self.userId == mixpanel.ALIAS_ID_KEY
                    // Since by default the Mixpanel library will stick with sending events under the old ID
                    // when we've just aliased to the new ID. Therefore, if we called alias for an ID that had
                    // already been aliased, subsequent events would end up under the incorrect user ID.
                    // The fact we're doing this is why we need to delay all subsequent events until the callback
                    // for the prior alias call indicates it was received successfully.
                    self.debug('Mixpanel: set distinct_id');
                    mixpanel.register({ distinct_id: self.userId });
                }
                if ((self.userId !== currentUserId) || self.clientSessionContext.loggedOut) {
                    self.debug('userId != currentUserId - Login');
                    self.track('Login');
                    setLocalContext('loggedOut', '', true);
                }
            } else {
                // no information about whether the user is currently logged in
                // Nb: calling analytics.identify() without a userId will delegate to identify() with the user.id() from analytics.js
                self.adaptor.identify(self.globalTraits);

                if (self.adaptor.userId()) {
                    if (usingMixpanel()) {
                        // Mixpanel fix: ensure we set mixpanel.distinct_id in sync with userId - as above
                        self.debug('Mixpanel: register({distinct_id: ' + self.adaptor.userId() + '})')
                        mixpanel.register({ distinct_id: self.adaptor.userId() });
                    }
                    if (self.thisPageTraits['Pageviews This Session'] == 1) {
                        // not told we're logged in, but we have a user ID from the analytics persistence, and
                        // it's our first pageview this session - therefore we were logged in and then out in prior session(s)
                        // - set logged_out session cookie to prevent tracking a false logout event at the start of this session
                        self.debug('not logged in, but user ID from prior session - setting logged_out cookie');
                        setLocalContext('loggedOut', true, true);
                    }
                }
                // by default, automatically detect logout if the userId property has been set
                //  - even if it's been set to null
                self.detectLogout = (self.detectLogout === undefined) ? (self.userId !== undefined) : self.detectLogout;
                if (self.detectLogout && !self.clientSessionContext.loggedOut) {
                    // we don't actually "log out" for the anaytics - keep tracking under the same user ID
                    // but set a cookie so we only track the Logout event once
                    self.debug('doIdentify(): detecting potential logout..');
                    if (self.adaptor.userId()) {
                        // we were logged in earlier in the session
                        self.track('Logout');
                        setLocalContext('loggedOut', true, true);
                        self.debug('Logout');
                    }
                }
            }
        }

        function trackPage(one, two, three) {
            self.debug('Viewed Page: ', [one, two, three]);
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

        function replayPreSniff() {
            replay(getQueue(['ready', 'identify']));
        }

        function replayQueue() {
            replay(getQueue());
        }

        function getQueue(methods) {
            if (!self.queue || !self.queue.length) {
                return;
            }
            if (!methods || !methods.length) {
                var queue = self.queue;
                self.queue = [];
                return queue;
            }
            var selected = [], remaining = [];
            for (var i = 0; i < self.queue.length; i++) {
                if (methods.indexOf(self.queue[i][0]) !== -1) {
                    selected.push(self.queue[i]);
                } else {
                    remaining.push(self.queue[i]);
                }
            }
            self.queue = remaining;
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

        function pauseAdaptor() {
            if (adaptorDeferredFunctions) {
                self.debug('Called pauseAdaptor() but already paused');
                return;
            }
            self.debug('pauseAdaptor()');
            adaptorDeferredFunctions = {};
            ['track', 'identify', 'page'].map(function(f) {
                adaptorDeferredFunctions[f] = self.adaptor[f];
                self.adaptor[f] = function() {
                    self.debug('adding to deferred queue: ' + f);
                    // convert from Arguments type to real array
                    var args = Array.prototype.slice.call(arguments);
                    // prepend method name
                    args.unshift(f);
                    adaptorDeferredQueue.push(args);
                }
            });
        }

        function resumeAdaptor() {
            if (!adaptorDeferredFunctions) {
                // nothing to resume
                return;
            }
            self.debug('resumeAdaptor()');
            ['track', 'identify', 'page'].map(function(f) {
                self.adaptor[f] = adaptorDeferredFunctions[f];
            });
            adaptorDeferredFunctions = null;
            // replay queued calls
            while (adaptorDeferredQueue && adaptorDeferredQueue.length > 0) {
                var args = adaptorDeferredQueue.shift();
                var method = args.shift();
                if (self.adaptor[method]) {
                    self.debug('replaying deferred: ' + method);
                    self.adaptor[method].apply(self.adaptor, args);
                } else {
                    self.debug('Unrecognised adaptor method: ' + method);
                }
            }
        }

        function urlChanged(previousURL) {
            self.debug('Detected URL change: ' + location.href);
            // reset config for the new URL
            self.overrideReferrer = previousURL || document.referrer;
            self.page = undefined;
            // fire listeners
            var page = self.detectPage();
            for (var i = 0; i < urlChangeQueue.length; i++) {
                urlChangeQueue[i](page);
            }
            // trigger sniffing for new virtual pageview
            self.sniff();
        }

        function setLocalContext(name, value, session_only) {
            if (value === false) {
                value = '';
            }
            if (session_only) {
                self.clientSessionContext[name] = value;
            } else {
                self.clientContext[name] = value;
            }
            var data = session_only ? self.clientSessionContext : self.clientContext;
            data = encodeQueryString(data);
            setCookie(session_only ? 'context_session' : 'context', data, session_only ? 0 : 366);
        }

        function readLocalContext() {
            try {
                self.clientContext = decodeQueryString(getCookie('context'));
            } catch (e) {
                self.debug('error parsing context cookie');
            }
            try {
                self.clientSessionContext = decodeQueryString(getCookie('context_session'));
            } catch (e) {
                self.debug('error parsing context_session cookie');
            }
            if (typeof self.clientContext !== 'object') { self.clientContext = {}; }
            if (typeof self.clientSessionContext !== 'object') { self.clientSessionContext = {}; }
            function getFromOldCookie(name, session_only, cookie_name) {
                cookie_name = cookie_name || name;
                var context = session_only ? self.clientSessionContext : self.clientContext;
                if (context[name] === undefined) {
                    setLocalContext(name, getCookie(cookie_name), session_only);
                }
                // remove legacy cookie
                setCookie(cookie_name, '', -100);
            }
            // detect legacy cookies
            ['firstSeen', 'sessionCount'].map(function (a) { getFromOldCookie(a); });
            ['sessionStarted', 'sessionUpdated', 'pageViews'].map(function (a) { getFromOldCookie(a, true); });
            getFromOldCookie('loggedOut', true, 'logged_out');
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

        function setAdaptor(adaptor) {
            self.adaptor = adaptor;
            CONSOLE_PREFIX = '[SiteHound' + (adaptor && adaptor.klass ? ':' + adaptor.klass : '') + '] ';
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

        // final initialisation steps
        completeInit();
    }

    //
    // public methods
    //

    SiteHound.prototype.push = function(args) {
        if (!typeof args === 'object') {
            this.debug('push() requires ([method, arg <, arg..>]); received: ', args);
            return;
        }
        var method = args.shift();
        if (this[method]) {
            this[method].apply(this, args);
        } else {
            this.debug('Unrecognised method: ' + method);
        }
    }

    SiteHound.prototype.alias = function(new_alias, from, options) {
        if (this.deferUntilSniff('alias', arguments)) {return;}
        this.debug('alias', [new_alias, from, options]);
        this.adaptor.alias(new_alias, from, options);
    }

    SiteHound.prototype.track = function(event, traits) {
        if (this.deferUntilSniff('track', arguments)) {return;}
        this.debug('track', [event, traits]);

        if (typeof traits == 'object') {
            // support only tracking an event once (per browser/cookie)
            for (var key in {
                // be tolerant..
                'eventUniqueKey':1,
                'event_unique_key':1,
                'Event Unique Key':1,
                'Event unique key':1,
                'event unique key':1
            }) {
                if (traits[key]) {
                    // found key
                    key = sanitize(traits[key]);
                    // pair with event name
                    var sanitize = function(s) {
                        return s.replace(';', '_').replace(':', '_');
                    }
                    var thisEventKey = sanitize(event) + ':' + sanitize(key);
                    var priorEvents = (self.clientSessionContext.uniqueEvents || '').split(';');
                    if (priorEvents.indexOf(thisEventKey) !== -1) {
                        // already tracked for this user - skip
                        this.debug('already tracked unique event, skipping: ' + thisEventKey);
                        return;
                    } // else - first time we're trying to track this unique event - proceed
                    setLocalContext('uniqueEvents', priorEvents.push(thisEventKey).join(';'));
                    // done here - found a unique event trait; no need to search for other matches
                    break;
                }
            }
            traits = this.getTraitsToSend(traits);
        } else {
            traits = this.getTraitsToSend();
        }
        this.adaptor.track(event, traits);
    }

    // similar to identifyOnce, but also track event
    SiteHound.prototype.trackOnce = function(event, params) {
        if (this.deferUntilSniff('trackOnce', arguments)) {return;}

        this.debug('trackOnce', [event, params]);

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

        this.debug('trackAndCount', [event, params]);
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

    SiteHound.prototype.trackLink = function(elements, name, traits) {
        if (this.deferUntilSniff('trackLink', arguments)) {return;}

        var elementInfo = {};
        if (elements && elements.selector) { elementInfo.selector = elements.selector; }
        if (elements && elements.length) { elementInfo.length = elements.length; }
        this.debug('trackLink', [elementInfo, name, traits]);

        this.adaptor.trackLink(elements, name, this.getTraitsToSend(traits));
    }

    SiteHound.prototype.trackForm = function(elements, name, traits) {
        if (this.deferUntilSniff('trackForm', arguments)) {return;}

        var elementInfo = {};
        if (elements && elements.selector) { elementInfo.selector = elements.selector; }
        if (elements && elements.length) { elementInfo.length = elements.length; }
        this.debug('trackForm', [elementInfo, name, traits]);

        this.adaptor.trackForm(elements, name, this.getTraitsToSend(traits));
    }

    SiteHound.prototype.ready = function(f) {
        if (typeof f === 'function') {
            var page = this.detectPage();
            this.debug('ready(' + page + ')');
            f(page);
        } else {
            error("ready() called with something that isn't a function");
        }
    }

    SiteHound.prototype.getUserTraits = function() {
        result = mergeObjects(this.adaptor.userTraits(), this.userTraits);
        this.debug('getUserTraits() returned ', result);
        return result;
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
        this.debug('[' + level + '] ' + message);
    }

    SiteHound.prototype.trackError = function(e) {
        var traits = {};
        if (typeof e === 'object') {
            traits.name = e.name || '';
            traits.message = e.message || '';
            if (e.stack) { traits.stackTrace = e.stack; }
        } else {
            traits.message = e;
        }
        traits['SiteHound library version'] = this.VERSION;
        this.adaptor.track('Tracking Error', traits);
        error(e.name + '; ' + e.message + (e.stack ? '\n' + e.stack : ''));
    }

    //
    // utility methods
    //

    function usingSegment() {
        var adaptor = window.sitehound.adaptor;
        return adaptor && (adaptor === 'segment' || adaptor.klass == 'segment');
    }

    function usingMixpanel() {
        return window.mixpanel && (!usingSegment() || analytics.Integrations.Mixpanel);
    }

    function usingAmplitude() {
        return window.amplitude && usingSegment() && analytics.Integrations.Amplitude;
    }

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

    function excludeTraits(traits_to_exclude, traits) {
        if (typeof traits_to_exclude === 'undefined') {
            // current traits undefined - all traits are new
            return traits;
        }
        var new_traits = {};
        for (var key in traits) {
            if (!(key in traits_to_exclude)) {
                new_traits[key] = traits[key];
            }
        }
        return new_traits;
    }

    function escapeRegExp(str) {
        return str.replace(/([\/*.?[\]()\-\|])/g, '\\$1');
    }

    function registerAdaptor(klass, adaptor) {
        adaptors[klass] = adaptor;
        adaptor.prototype.klass = klass;
    }

    function getAdaptor(adaptor) {
        var adaptorClass, result;
        if (typeof adaptor === 'object' && adaptor !== null) {
            result = adaptor;
        } else {
            // initialize adaptor for the analytics library we want to use
            adaptorClass = ((adaptor || 'segment').toLowerCase()) || 'segment';
            try {
                var result = new adaptors[adaptorClass];
            } catch (e) {
                error('adaptor ' + adaptorClass + " could not be loaded");
                error(e.name + '; ' + e.message);
                return;
            }
        }
        return result;
    }

    function log(message, object) {
        if (!window.console || !console.log) {
            return;
        }
        try {
            if (typeof message === 'object') {
                if (JSON && JSON.stringify) {
                    message = CONSOLE_PREFIX + JSON.stringify(message);
                }
            } else {
                message = CONSOLE_PREFIX + message;
            }
            if (object && JSON && JSON.stringify) {
                message = message + '(' + JSON.stringify(object).slice(1).slice(0,-1) + ')';
                object = null;
            }
            console.log(message);
            if (object) {
                console.log(object);
            }
        } catch (e) {
            error(e.name + '; ' + e.message);
        }
    }

    function error(msg) {
        if (!window.console) {
            return;
        }
        if (console.error) {
            console.error(CONSOLE_PREFIX + msg);
        } else if (console.log) {
            console.log(CONSOLE_PREFIX + '[ERROR] ' + msg);
        }
    }

    function waitFor(key, f, object) {
        var o = object || window;
        // handle nested object references
        var keys = key.split('.');
        for (var i = 0; i < keys.length; i++) {
            if (typeof o[keys[i]] === 'undefined') {
                // not available yet
                setTimeout(function() { waitFor(key, f, object) }, 50);
                return;
            }
            // else - object.key is now available
            o = o[keys[i]];
        }
        // execute f()
        f();
    }

    function getCookie(cname, prefix) {
        if (prefix === undefined) {
            prefix = 'sh_';
        }
        var name = prefix + cname + '=';
        var cs = document.cookie.split(';');
        for(var i=0; i < cs.length; i++) {
            var c = cs[i];
            while (c.charAt(0)==' ') c = c.substring(1);
            if (c.indexOf(name) == 0) return c.substring(name.length,c.length);
        }
        return '';
    }

    function decodeQueryString(str) {
        var object = {};
        str.split('&').map(function(param) {
            if (!param) { return; }
            param = param.split('=').map(function(component) {
                return decodeURIComponent(component);
            });
            object[param[0]] = param[1];
        });
        return object;
    }

    function encodeQueryString(object) {
        var params = [];
        for (var param in object) {
            if (object.hasOwnProperty(param)) {
                params.push(encodeURIComponent(param) + '=' + encodeURIComponent(object[param]));
            }
        }
        return params.join('&');
    }

    //
    // Adaptors
    //

    registerAdaptor('disabled', function() {
        this.ready = function(f) {
            f();
        }
        // tracking disabled
        this.identify = this.identifyOnce = this.track = this.trackLink = this.trackForm
            = this.page = this.alias = this.userId = function() {};
        this.userTraits = function() { return {}; }
    });

    registerAdaptor('segment', function() {
        var self = this;

        this.ready = function(f) {
            waitFor('analytics.ready', function() {
                analytics.ready(f);
            });
        };

        this.identify = function(a, b, c) {
            analytics.identify(a, b, c);
        };

        this.identifyOnce = function(traits) {
            // first, exclude current global traits from analytics.js client-side persistence
            traits = excludeTraits(self.userTraits(), traits);
            // sent to Segment and integrations without specific setOnce support
            self.identify(traits, {
                integrations: {
                    Mixpanel: false,
                    Amplitude: false
                }
            });
            // sent to integrations with setOnce support
            if (usingMixpanel()) {
                mixpanel.people.set_once(traits);
            }
            if (usingAmplitude()) {
                var identify = new amplitude.Identify();
                for (var key in traits) {
                    if (traits.hasOwnProperty(key)) {
                        identify.setOnce(key, traits[key]);
                    }
                }
                amplitude.getInstance().identify(identify);
            }
        };

        this.track = function(event, traits) {
            analytics.track(event, traits);
        };

        this.trackLink = function(elements, event, traits) {
            analytics.trackLink(elements, event, traits);
        };

        this.trackForm = function(elements, event, traits) {
            analytics.trackForm(elements, event, traits);
        };

        this.page = function(a, b, c) {
            analytics.page(a, b, c);
        };

        this.alias = function(to, from, options) {
            analytics.alias(to, from, options);
        };

        this.userId = function() {
            var user = analytics.user();
            return user ? user.id() : undefined;
        };

        this.userTraits = function() {
            var user = analytics.user();
            var traits = user.traits();
            return traits || {};
        };
    });

    // let's go
    init();
}();
