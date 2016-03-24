//
// Website event and user tracking for Segment.com's analytics.js
// 
// @author        Andy Young | @andyy | andy@apexa.co.uk
// @version       1.0 - 23rd March 2016
// @licence       GNU GPL v3
//
// ~~ 500 Startups Distro Team | #500STRONG | 500.co ~~
//
//
//  Copyright (C) 2016  Andy Young
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
    var VERSION = "0.3";

    !function() {
        var analytics = window.analytics = window.analytics || [];
        if (typeof analytics.ready === 'undefined') {
            if (window.console && console.error) {
                console.error('SiteHound: window.analytics is not initialized - ensure analytics.js snippet is included first');
            }
            return;
        }

        // initialize when analytics.js is ready
        analytics.ready(function() {
            // grab our custom config and calls, if any
            var initialConfig = window.sitehound || {};
            // initialize SiteHound library, passing in our custom config
            var sitehound = new SiteHound(initialConfig);
            // finally, replace the global sitehound var with our instance for future reference
            window.sitehound = sitehound;
        });
    }();

    function SiteHound(initialConfig) {
        var self = this;

        var config = {
            // names and paths of key pages we want to track
            // paths can be simple string matches, arrays, or regular expressions
            trackPages: null,
            // track all other pageviews? (as "unidentified")
            trackAllPages: false,
            // whitelist domains on which to run tracking
            domains: location.host,
            domainsIgnore: ['localhost'],
            domainsIgnoreIPAddress: true,
            domainsIgnoreSubdomains: ['staging', 'test'],
            // any un-tagged pages we want to track as the actual landing page if discovered in the referrer?
            trackReferrerLandingPages: [],
            page: null,
            pageTraits: {},
            // traits to set globally for this user/session
            globalTraits: {},
            // traits that we only want to pass on calls to analytics.[track|page] on this pageview
            thisPageTraits: {},
            //
            userId: undefined,
            userTraits: {},
            detectLogout: undefined,
            //
            logToConsole: false,
            //
            sessionTimeout: 30 // minutes
        };

        for (var key in config) {
            if (initialConfig[key] !== undefined) {
                config[key] = initialConfig[key];
            }
            this[key] = config[key];
        }

        this.thisPageTraits['SiteHound library version'] = this.VERSION = VERSION;

        //
        // privileged methods
        //

        this.done = function() {
            try {
                self.info('Running..');

                // check we want to track this host
                if (ignoreHost(location.host)) {
                    self.info('Ignoring host: ' + location.host);
                    return;
                }

                if (!self.page) {
                    self.page = detectPage(location.pathname);
                }

                self.trackSession();

                var user = analytics.user();
                var userTraits = user.traits();

                if (userTraits.createdAt) {
                    self.globalTraits['Days since signup'] = Math.floor((new Date()-new Date(userTraits.createdAt))/1000/60/60/24);
                    self.info('Days since signup: ' + self.globalTraits['Days since signup']);
                }

                if (self.userTraits['email domain']) {
                    self.userTraits['email domain'] = self.userTraits['email domain'].match(/[^@]*$/)[0];
                } else if (userTraits.email || self.userTraits['email']) {
                    self.userTraits['email domain'] = (userTraits.email || self.userTraits['email']).match(/[^@]*$/)[0];
                }

                // Fullstory.com session URL
                if (window.FS && window.FS.getCurrentSessionURL) {
                    // ideally do it instantly so we don't trigger a separate identify() call
                    self.globalTraits['Fullstory URL'] = FS.getCurrentSessionURL();
                } else {
                    window['_fs_ready'] = function() {
                        analytics.identify({'Fullstory URL': FS.getCurrentSessionURL()});
                    };
                }

                if (self.userId) {
                    self.info('Received userId: ' + self.userId);
                    var userTraits = {};
                    for (var key in self.userTraits) {
                        userTraits['User ' + key] = self.userTraits[key];
                    }
                    var traits = mergeObjects(self.globalTraits, userTraits);
                    var currentUserId;
                    if (!analytics.user() || !analytics.user().id()) {
                        // session up to here has been anonymous
                        self.info('Anonymous session until now - alias()');
                        analytics.alias(self.userId);
                        // hack: ensure identify() takes hold even if alias() was silently ignored because already in use
                        analytics.identify('x');
                    } else {
                        currentUserId = analytics.user().id();
                        self.info('Current userId: ' + currentUserId);
                    }
                    self.info('identify(' + self.userId + ', [traits])');
                    analytics.identify(self.userId, traits);
                    if (self.userId !== currentUserId) {
                        self.track('Login');
                        // TOCHECK
                        // set time of email verification as the user creation time
                        self.identifyOnce({createdAt: new Date().toISOString()});
                        self.info('userId != currentUserId - Login');
                    }
                    setCookie('logged_out', '');
                } else {
                    analytics.identify(self.globalTraits);
                    if (self.detectLogout === undefined) {
                        // by default, automatically detect logout if the userId property has been set
                        //  - even if it's been set to null
                        self.detectLogout = self.userId !== undefined;
                    }
                    if (self.detectLogout) {
                        self.info('Detecting potential logout..');
                        if (analytics.user() && analytics.user().id()) {
                            // track only once until next login
                            if (!getCookie('logged_out')) {
                                self.track('Logged out');
                                setCookie('logged_out', true);
                                self.info('Logged out');
                            }
                            // analytics.reset();
                        }
                    }
                }

                if (self.trackLandingPage) {
                    self.trackPage('Landing', self.landingPageTraits);
                }

                if (self.page) {
                    // if the page contains a vertical bar, separate out the page vs. category
                    var pageParts = self.page.split('|', 2).map(
                        function(a) {
                            return a.trim();
                        }
                    );
                    var args = pageParts.push(self.pageTraits);
                    // track page view
                    self.trackPage.apply(self, pageParts);
                } else if (self.trackAllPages) {
                    self.trackPage('Unidentified');
                }

                // finally - track all custom events etc
                replayQueue();

            } catch(error) {
                this.trackError(error);
            }
        }

        this.trackSession = function() {
            // visitor first seen
            var firstSeen = getCookie('firstSeen') || new Date().toISOString();
            setCookie('firstSeen', firstSeen, 366);
            var daysSinceFirst = Math.floor((new Date() - new Date(firstSeen))/1000/60/60/24);
            self.globalTraits['First seen'] = firstSeen;
            self.globalTraits['Days since first seen'] = daysSinceFirst;
            self.info('Visitor first seen: ' + firstSeen);
            self.info('Days since first seen: ' + daysSinceFirst);

            // session start + last updated time
            var sessionStarted = getCookie('sessionStarted') || new Date().toISOString(),
                sessionUpdated = getCookie('sessionUpdated') || new Date().toISOString();
            var sessionDuration = Math.floor((new Date() - new Date(sessionStarted))/1000/60);
            self.globalTraits['Session started'] = sessionStarted;
            self.globalTraits['Minutes since session start'] = sessionDuration;
            self.info('Session started: ' + sessionStarted);
            self.info('Session duration: ' + sessionDuration);
            var sessionTimedOut = sessionDuration > self.sessionTimeout;
            if (sessionTimedOut) {
                self.info('Session timed out - tracking as new session');
                sessionStarted = new Date().toISOString();
            }
            setCookie('sessionStarted', sessionStarted);
            setCookie('sessionUpdated', new Date().toISOString());

            // tracked pageviews this session
            var pageViews = (sessionTimedOut ? 0 : parseInt(getCookie('pageViews') || 0)) + 1;
            self.thisPageTraits['Pageviews this session'] = pageViews;
            setCookie('pageViews', pageViews);
            self.info('Pageviews: ' + pageViews);

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
            self.globalTraits['Session count'] = sessionCount;
            setCookie('sessionCount', sessionCount, 366);
            self.info('Session count: ' + sessionCount);

            if (sessionTimedOut) {
                // we don't update attribution tracking when tracking a new session due to inactivity
                return;
            }

            // track attribution params for this session
            var attributionParams = {};
            for (var param in [
                'utm_source',
                'utm_medium',
                'utm_campaign',
                'utm_term',
                'utm_content',
                'Landing page',
                'Landing page type',
                'Referrer',
                'Referrer domain',
                'Referrer type'
            ]) {
                attributionParams[param] = undefined;
            }

            // utm params
            var utmParams = getUTMParams();
            if (Object.keys(utmParams).length > 0) {
                self.info('utm params:');
                self.info(utmParams);
                attributionParams = mergeObjects(attributionParams, utmParams);
            }

            // landing page and referrer
            var referrerParts = document.referrer.match(/https?:\/\/([^/]+)(\/.*)/),
                referrerHost,
                referrerPath;
            if (referrerParts) {
                referrerHost = referrerParts[1];
                referrerPath = referrerParts[2];
            }
            // is the referrer from a host we should have (a) tracking on, and (b) set a cookie for, AND can read the cookie on this host?
            //  => referrer is one of domains AND current host is either the same domain as the referrer, or current host is a subdomain of the referrer
            if ((referrerHost === location.host) || ((self.domains.indexOf(referrerHost) !== -1) && ((location.host + '/').indexOf(referrerHost + '/') !== -1))) {
                // first cookie, but referrer from one of our domains - did the original landing page not have tracking?
                // Do we want to track the referrer as the original landing page?
                if (self.trackReferrerLandingPages.indexOf(referrerPath) !== -1) {
                    // track landing page view for our previously untracked referrer
                    self.info('Detected known untracked landing page: ' + document.referrer);
                    self.trackLandingPage = true;
                    self.landingPageTraits = {
                        path: referrerPath,
                        url: document.referrer,
                        '$current_url': document.referrer,
                        'Tracked from URL': location.href,
                        referrer: ''
                    };
                    attributionParams['Landing page'] = referrerPath;
                } else if (document.referrer === location.href) {
                    // referrer is the current page - treat as landing page
                    self.trackLandingPage = true;
                    attributionParams['Landing page'] = location.pathname;
                } else {
                    self.trackDebugWarn('Landing page with local referrer - tracking code not on all pages?');
                }
            } else {
                if ((referrerHost != location.host) && self.domains.indexOf(referrerHost) !== -1) {
                    self.trackDebugInfo('Landing page with referrer from one of our other domains');
                } else {
                    self.trackLandingPage = true;
                    attributionParams['Landing page'] = location.pathname;
                    attributionParams['Referrer'] = document.referrer;
                    attributionParams['Referrer domain'] = referrerHost;
                }
            }

            // add some additional metadata
            if (attributionParams['Landing page']) {
                attributionParams['Landing page type'] = self.page;
            }
            if (attributionParams['Referrer domain'] == location.host) {
                attributionParams['Referrer type'] = detectPage(referrerPath);
            }

            // automatic attribution detection
            if (!attributionParams['utm_source']) {
                // adwords / doubleclick
                if (getQueryParam(document.URL, 'gclid') || getQueryParam(document.URL, 'gclsrc')) {
                    attributionParams['utm_source'] = 'google';
                    if (!attributionParams['utm_medium']) {
                        attributionParams['utm_medium'] = 'cpc';
                    }
                }
                // Yesware
                if (attributionParams['Referrer domain'] == 't.yesware.com') {
                    attributionParams['utm_source'] = 'Yesware';
                    if (!attributionParams['utm_medium']) {
                        attributionParams['utm_medium'] = 'email';
                    }
                }
            }

            var attributionParamsFirst = {},
                attributionParamsLast = {};
            for (var key in attributionParams) {
                attributionParamsFirst[key + ' [first touch]'] = attributionParams[key];
                attributionParamsLast[key + ' [last touch]'] = attributionParams[key];
            }

            // TODO: combine/minimise identify calls
            // TODO: Don’t call identify if traits are already set with desired values

            if (sessionCount == 1) {
                // only track first touch params on first session
                self.identifyOnce(attributionParamsFirst);
                self.info('First touch attribution:');
                self.info(attributionParamsFirst);
            }
            analytics.identify(attributionParamsLast);
            self.info('Last touch attribution:');
            self.info(attributionParamsLast);
        }

        this.trackPage = function(one, two, three) {
            if (typeof three === 'object') {
                analytics.page(one, two, self.getTraitsToSend(three));          
            } else if (typeof two === 'object') {
                analytics.page(one, self.getTraitsToSend(two));
            } else if (two) {
                analytics.page(one, two, self.getTraitsToSend());
            } else {
                analytics.page(one, self.getTraitsToSend());
            }
        }

        this.getTraitsToSend = function(traits) {
            if (typeof traits === 'object') {
                return mergeObjects(self.thisPageTraits, traits);
            } else {
                return self.thisPageTraits;
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

        //
        // private methods
        //

        function ignoreHost(host) {
            if (self.domains.indexOf(host) != -1) {
                // domain is one of ours to track
                return false;
            }
            if (self.domainsIgnore.indexOf(host) != -1) {
                // domain is one of ours to ignore
                return true;
            }
            if (self.domainsIgnoreIPAddress && /([0-9]{1,3}\.){3}[0-9]{1,3}/.test(host)) {
                // host is IP address, and we want to ignore these
                return true;
            }
            if (self.domainsIgnoreSubdomains.length > 0) {
                for (var i = 0; i < self.domains.length; i++) {
                    var root_domain = self.domains[i].replace(/^www\./, '');
                    var host_subdomain = host.replace(new RegExp(root_domain.replace('.', '\.') + '$'), '');
                    if (self.domainsIgnoreSubdomains.indexOf(host_subdomain) != -1) {
                        // domain matches a subdomain pattern we wish to ignore
                        return true;
                    }
                }
            }
            // else - ignore, but warn about unexpected domain
            self.trackDebugWarn('location.host not contained within configured domains');
            return true;
        }

        function detectPage(path) {
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
                            document.body.className.match(new RegExp('(?:^|\\s)' + RegExp.escape(pat.slice(1)) + '(?!\\S)'))) {
                            self.info('Detected page: ' + page);
                            return page;
                        }
                    // string match - we ignore presence of trailing slash on path
                    } else if (pat.replace(/\/$/, '') === path.replace(/\/$/, '')) {
                        self.info('Detected page: ' + page);
                        return page;
                    }
                }
            }
        }

        function replayQueue() {
            while (initialConfig.queue && initialConfig.queue.length > 0) {
                var args = initialConfig.queue.shift();
                var method = args.shift();
                if (self[method]) {
                    self[method].apply(self, args);
                }
            }
        }

        function getUTMParams() {
            var utm_params = 'utm_source utm_medium utm_campaign utm_content utm_term'.split(' '),
                kw = '',
                params = {};

            for (var index = 0; index < utm_params.length; ++index) {
                kw = getQueryParam(document.URL, utm_params[index]);
                if (kw.length) {
                    params[utm_params[index]] = kw;
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

        function setCookie(name, value, expiry_days) {
            var expires = '';
            if (expiry_days > 0) {
                var d = new Date();
                d.setTime(d.getTime() + (expiry_days*24*60*60*1000));
                expires = 'expires='+d.toUTCString();
            }
            document.cookie = 'sitehound_' + name + '=' + value + '; ' + expires + ';path=/';
        }

        function getCookie(cname) {
            var name = 'sitehound_' + cname + '=';
            var cs = document.cookie.split(';');
            for(var i=0; i < cs.length; i++) {
                var c = cs[i];
                while (c.charAt(0)==' ') c = c.substring(1);
                if (c.indexOf(name) == 0) return c.substring(name.length,c.length);
            }
            return '';
        }

        function mergeObjects(obj1, obj2) {
            var obj3 = {};
            for (var attrname in obj1) { obj3[attrname] = obj1[attrname]; }
            for (var attrname in obj2) { obj3[attrname] = obj2[attrname]; }
            return obj3;
        }

        //
        // ready? 
        //
        this.info('Ready');

        if (initialConfig.isDone) {
            this.done();
        }        
    }

    //
    // public methods
    //

    // like analytics.identify({..}), but only set traits if they're not already set
    SiteHound.prototype.identifyOnce = function(params) {
        var user = analytics.user();
        var traits = user.traits(),
            new_params = {};

        for (var key in params) {
            if (!(key in traits)) {
                new_params[key] = params[key];
            }
        }

        analytics.identify(new_params);
    }

    SiteHound.prototype.track = function(event, traits) {
        if (typeof traits == 'object') {
            analytics.track(event, this.getTraitsToSend(traits));
        } else {
            analytics.track(event, this.getTraitsToSend());
        }
    }

    // similar to identifyOnce, but also track event
    SiteHound.prototype.trackOnce = function(event, params) {
        var user = analytics.user();
        var traits = user.traits();

        if (traits['First ' + event] === undefined) {
            var userParams = {};
            userParams['First ' + event] = new Date().toISOString();

            analytics.identify(userParams);
            this.track(event, params);
        }
    }

    SiteHound.prototype.trackAndCount = function(event, params) {
        var user = analytics.user();
        var traits = user.traits();

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
        analytics.identify(identifyTraits);
        this.track(event, params);
    }

    SiteHound.prototype.trackLink = function(selector, name) {
        analytics.trackLink(selector, name, this.getTraitsToSend());
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
        analytics.track('Tracking Debug', {
            message: message,
            level: level,
            'SiteHound library version': this.VERSION
        });
        this.info('[' + level + '] ' + message);
    }

    SiteHound.prototype.trackError = function(error) {
        analytics.track('Tracking Error', {
            name: error.name,
            message: error.message,
            'SiteHound library version': this.VERSION
        });
        if (window.console && console.error) {
            console.error('[SiteHound] ' + error.name + '; ' + error.message);
        }
    }
}();
