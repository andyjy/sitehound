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
//  @version       0.9.68 - 9th June 2016
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
    var VERSION = "0.9.68",
        CONSOLE_PREFIX = '[SiteHound] ';

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

                // log debugging messages to the console?
                logToConsole: false,
                // suppress all non-error output to the console?
                silent: false,
                // session timeout before tracking the start of a new session (in minutes)
                sessionTimeout: 30,
                // provide an overridden referrer to replce in when tracking on this page
                overrideReferrer: undefined,

                // queued-up methods to execute
                queue: [],

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

            if (getCookie('dnt')) {
                self.info('Do-not-track cookie present - disabling.');
                self.adaptor = 'disabled';
            }

            // debug mode?
            if (getCookie('logToConsole')) {
                self.logToConsole = true;
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
                    self.adaptor = 'disabled';
                }
                if (getCookie('dnt')) {
                    self.info('Do-not-track cookie present - disabling.');
                    self.adaptor = 'disabled';
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
            self.adaptor.identify(ignoreExistingTraits(params));
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
            if (!self.logToConsole) {
                return;
            }
            log(message, object);
        }

        this.doNotTrack = function(dnt) {
            dnt = (typeof dnt === 'undefined') ? true : !!dnt;
            if (dnt) {
                setCookie('dnt', '1', 1000);
            } else {
                // clear cookie - track again
                setCookie('dnt', '', -100);
            }
            self.debug('doNotTrack', dnt ? 'true' : 'false')
        }

        this.debugMode = function(logToConsole) {
            self.logToConsole = logToConsole = (typeof logToConsole === 'undefined') ? true : !!logToConsole;
            if (logToConsole) {
                setCookie('logToConsole', '1', 1000);
            } else {
                // clear cookie - track again
                setCookie('logToConsole', '', -100);
            }
            self.debug('debugMode', logToConsole ? 'true' : 'false')
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

        function doSniff() {
            // set this now so our tracking calls execute immediately without deferUntilSniff()
            self.sniffed = true;

            if (!self.page) {
                self.page = self.detectPage();
            }
            self.thisPageTraits['Page Type'] = self.page;

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
                trackPage('Landing', self.landingPageTraits);
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
            for (var i = 0; i < optimizelyEvents.length; i++) {
                self.track(optimizelyEvents[i][0], optimizelyEvents[i][1]);
            }
        }

        function examineSession() {
            // visitor first seen
            var firstSeen = getCookie('firstSeen') || new Date().toISOString();
            setCookie('firstSeen', firstSeen, 366);
            var daysSinceFirst = Math.floor((new Date() - new Date(firstSeen))/1000/60/60/24);
            self.globalTraits['First Seen'] = firstSeen;
            self.globalTraits['Days Since First Seen'] = daysSinceFirst;
            self.debug('Visitor first seen: ' + firstSeen);
            self.debug('Days since first seen: ' + daysSinceFirst);

            // session start + last updated time
            var sessionStarted = getCookie('sessionStarted') || new Date().toISOString(),
                sessionUpdated = getCookie('sessionUpdated') || new Date().toISOString();
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
            setCookie('sessionStarted', sessionStarted);
            setCookie('sessionUpdated', new Date().toISOString());

            // tracked pageviews this session
            var pageViews = (sessionTimedOut ? 0 : parseInt(getCookie('pageViews') || 0)) + 1;
            self.thisPageTraits['Pageviews This Session'] = pageViews;
            setCookie('pageViews', pageViews);
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

            if (!sessionTimedOut) {
                // is this a landing page hit? (i.e. first pageview in session)
                if (pageViews > 1) {
                    // not a landing page - nothing further to do here
                    return;
                }
                self.debug('Detected landing page');
            }

            // session count for this visitor
            var sessionCount = parseInt(getCookie('sessionCount') || 0) + 1;
            self.globalTraits['Session Count'] = sessionCount;
            setCookie('sessionCount', sessionCount, 366);
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
                attributionParams[paramNames[i]] = null;
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

            self.debug('Attribution params:');
            self.debug(attributionParams);
            if (sessionCount == 1) {
                // only track first touch params on first session
                self.debug('..setting first touch params');
                self.globalTraits = mergeObjects(self.globalTraits, ignoreExistingTraits(attributionParamsFirst));
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

            var oEsKey = 'Optimizely Experiments',
                oVsKey = 'Optimizely Variations';
            var oEs = userTraits[oEsKey],
                oVs = userTraits[oVsKey];
            self.globalTraits[oEsKey] = oEs ? (typeof oEs.sort === 'function' ? oEs : [oEs]) : [];
            self.globalTraits[oVsKey] = oVs ? (typeof oVs.sort === 'function' ? oVs : [oVs]) : [];

            for (var i = 0; i < activeExperiments.length; i++) {
                var experimentId = activeExperiments[i];
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
            self.globalTraits[oEsKey].sort();
            self.globalTraits[oVsKey].sort();
            return result;
        }

        // handle user identification, including login/logout
        function doIdentify() {
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
                    // session up to here has been anonymous
                    self.debug('Anonymous session until now - alias()');
                    self.adaptor.alias(self.userId);
                    // hack: ensure identify() takes hold even if alias() was silently ignored because already in use
                    self.adaptor.identify('x');
                } else {
                    currentUserId = self.adaptor.userId();
                    self.debug('Current userId: ' + currentUserId);
                }
                self.debug('adaptor.identify(' + self.userId + ', [traits])');
                self.adaptor.identify(self.userId, traits);
                if (self.userId !== currentUserId) {
                    self.debug('userId != currentUserId - Login');
                    self.track('Login');
                }
                setCookie('logged_out', '', -100);
            } else {
                // no information about whether the user is currently logged in
                self.adaptor.identify(self.globalTraits);
                // by default, automatically detect logout if the userId property has been set
                //  - even if it's been set to null
                self.detectLogout = (self.detectLogout === undefined) ? (self.userId !== undefined) : self.detectLogout;
                if (self.detectLogout && !getCookie('logged_out')) {
                    self.debug('doIdentify(): detecting potential logout..');
                    if (self.adaptor.userId()) {
                        // we were logged in earlier in the session
                        self.track('Logout');
                        setCookie('logged_out', true);
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

        function ignoreExistingTraits(params) {
            var traits = self.adaptor.userTraits(),
                newParams = {};
            if (typeof traits === 'undefined') {
                // current traits undefined - all params are new
                return params;
            }
            for (var key in params) {
                if (!(key in traits)) {
                    newParams[key] = params[key];
                }
            }
            return newParams;
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

    SiteHound.prototype.alias = function(new_alias) {
        if (this.deferUntilSniff('alias', arguments)) {return;}
        this.debug('alias', [new_alias]);
        this.adaptor.alias(new_alias);
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
                if (traits.key) {
                    // found key
                    key = sanitize(traits[key]);
                    // pair with event name
                    function sanitize(s) {
                        return s.replace(';', '_').replace(':', '_');
                    }
                    var thisEventKey = sanitize(event) + ':' + sanitize(key);
                    var priorEvents = getCookie('uniqueEvents').split(';');
                    if (priorEvents.indexOf(thisEventKey) !== -1) {
                        // already tracked for this user - skip
                        this.debug('already tracked unique event, skipping: ' + thisEventKey);
                        return;
                    } // else - first time we're trying to track this unique event - proceed
                    setCookie('uniqueEvents', priorEvents.push(thisEventKey).join(';'));
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
        this.adaptor.track('Tracking Error', {
            name: typeof e === 'object' ? e.name : '',
            message: typeof e === 'object' ? e.message : e,
            'SiteHound library version': this.VERSION
        });
        error(e.name + '; ' + e.message);
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
        adaptor.prototype.klass = klass;
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

    //
    // Adaptors
    //

    registerAdaptor('disabled', function() {
        this.ready = function(f) {
            f();
        }
        // tracking disabled
        this.identify = this.track = this.trackLink = this.trackForm
            = this.page = this.alias = this.userId = function() {}
        this.userTraits = function() { return {}; }
    });

    registerAdaptor('segment', function() {
        var self = this;

        this.ready = function(f) {
            waitFor('analytics.ready', function() {
                if ((window.sitehound && window.sitehound.logToConsole) || getCookie('logToConsole')) {
                    log('window.analytics detected');
                }
                analytics.ready(f);
            });
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
            return traits || {};
        }
    });

    // let's go
    init();
}();
