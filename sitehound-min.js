//
//  SiteHound - Easy & powerful website analytics tracking
//
//  Docs: http://www.sitehound.co
//  Source: https://github.com/andyyoung/sitehound
//
//  @author        Andy Young // @andyy // andy@apexa.co.uk
//  @version       0.9.72 - 6th Sep 2016
//  @licence       GNU GPL v3  http://www.gnu.org/licenses/
//
//  Copyright (C) 2016 Andy Young // andy@apexa.co.uk
//  ~~ 500 Startups Distro Team // #500STRONG // 500.co ~~
//
!function(){function e(){var a=window.sitehound=window.sitehound||[],b=o(a.adaptor);b&&(a.silent||p("Waiting for the "+b.klass+" adaptor to load.."),b.ready(function(){var a=window.sitehound||[];new f(a,b)}))}function f(d,e){function x(){f.info("Loaded (version "+a+", adaptor: "+f.adaptor.klass+")"),f.cookieDomain=V(location.hostname),f.debug("Cookie domain: "+f.cookieDomain),Q(),f.clientContext.dnt&&(f.info("Do-not-track cookie present - disabling."),f.disable()),window.sitehound=f,window.mixpanel&&window.mixpanel.persistence&&document.cookie.indexOf(window.mixpanel.persistence.name+"=")>-1&&q("Warning: Mixpanel cookie detected - update Mixpanel config to use localStorage."),I(),(d.sniffOnLoad||d.isDone)&&f.sniff()}function y(a){if(f.domainsIgnore.indexOf(a)!=-1)return!0;if(f.domainsIgnoreIPAddress&&/([0-9]{1,3}\.){3}[0-9]{1,3}/.test(a))return!0;for(var b=0;b<f.domainsIgnoreSubdomains.length;b++)if(0==a.indexOf(f.domainsIgnoreSubdomains[b]+"."))return!0;return!1}function z(){if(!f.clientContext.ip||!f.clientContext.ipLookupTime||(new Date).getTime()-f.clientContext.ipLookupTime>18e5){f.debug("looking up ip");var a=Math.random().toString(36).substring(2,12);f["setIP_"+a]=function(a){f.debug("received IP: ",a),a&&a.ip&&(P("ip",a.ip),P("ipLookupTime",(new Date).getTime()))};var b=document.createElement("script");b.type="text/javascript",b.async=!0,b.src="https://api.ipify.org?format=jsonp&callback=sitehound.setIP_"+a;var c=document.getElementsByTagName("script")[0];c.parentNode.insertBefore(b,c)}return f.clientContext.ip}function A(){if(f.clientContext.ip&&f.ignoreIPs&&f.ignoreIPs.length)return console.log(C(f.ignoreIPs)),C(f.ignoreIPs).test(f.clientContext.ip)}function B(){f.addTraitsForIPs&&f.addTraitsForIPs.map&&f.addTraitsForIPs.map(function(a){a&&a.ip&&a.traits?C(a.ip).test(f.clientContext.ip)&&(f.debug("Matched IP rule: "+a.ip,a.traits),f.globalTraits=k(f.globalTraits,a.traits)):console.debug("Invalid addTraitsForIP rule",a)})}function C(a){return a&&a.map?new RegExp("^("+a.map(function(a){return C(a).toString().replace(/[\/\^\$]/g,"")}).join("|")+")$"):new RegExp("^"+a.replace(/\./g,"\\.").replace(/\.$/,".*").replace("*",".+")+"$")}function D(){f.sniffed=!0,f.page||(f.page=f.detectPage()),f.thisPageTraits["Page Type"]=f.page,"undefined"===f.userId&&(f.userId=void 0),E();var a=f.adaptor.userTraits();if(a.createdAt&&(f.globalTraits["Days Since Signup"]=Math.floor((new Date-new Date(a.createdAt))/1e3/60/60/24),f.debug("Days since signup: "+f.globalTraits["Days Since Signup"])),f.userTraits["Email Domain"]?f.userTraits["Email Domain"]=f.userTraits["Email Domain"].match(/[^@]*$/)[0]:(a.Email||a.email||f.userTraits.Email)&&(f.userTraits["Email Domain"]=(a.Email||a.email||f.userTraits.Email).match(/[^@]*$/)[0]),window.FS&&window.FS.getCurrentSessionURL)f.globalTraits["Fullstory URL"]=FS.getCurrentSessionURL()||"";else if(!f.sniffed){var b=window._fs_ready;window._fs_ready=function(){f.adaptor.identify({"Fullstory URL":FS.getCurrentSessionURL()||""}),"function"==typeof b&&b()}}var c=F(a);if(void 0!==f.overrideReferrer&&(f.thisPageTraits.referrer=f.thisPageTraits.Referrer=f.thisPageTraits.$referrer=f.overrideReferrer),G(),f.trackSessionStart&&(f.track("Session Started"),f.trackSessionStart=!1),f.trackLandingPage&&(f.track("Viewed Landing Page",f.landingPageTraits),f.trackLandingPage=!1),f.page){var d=f.page.split("|",2).map(function(a){return a.trim()});d.push(f.pageTraits);H.apply(f,d)}else f.trackAllPages&&H("Unidentified");for(var g=0;g<c.length;g++)f.track(c[g][0],c[g][1])}function E(){var a=f.clientContext.firstSeen||(new Date).toISOString();P("firstSeen",a);var b=Math.floor((new Date-new Date(a))/1e3/60/60/24);f.globalTraits["First Seen"]=a,f.globalTraits["Days Since First Seen"]=b,f.debug("Visitor first seen: "+a),f.debug("Days since first seen: "+b);var c=f.clientSessionContext.sessionStarted||(new Date).toISOString(),d=f.clientSessionContext.sessionUpdated||(new Date).toISOString(),e=Math.floor((new Date-new Date(d))/1e3/60);f.debug("Session started: "+c),f.debug("Minutes since last event: "+e);var g=e>f.sessionTimeout;g&&(f.debug("Session timed out - tracking as new session"),c=(new Date).toISOString());var h=Math.floor((new Date-new Date(c))/1e3/60);f.debug("Session duration: "+h),f.globalTraits["Session Started"]=c,f.globalTraits["Minutes Since Session Start"]=h,P("sessionStarted",c,!0),P("sessionUpdated",(new Date).toISOString(),!0);var i=(g?0:parseInt(f.clientSessionContext.pageViews||0))+1;f.thisPageTraits["Pageviews This Session"]=i,P("pageViews",i,!0),f.debug("Pageviews: "+i);var m,j=document.referrer.match(/https?:\/\/([^\/]+)(\/.*)/),l=null;if(j&&(l=j[1],m=j[2]),l==location.host&&(f.thisPageTraits["Referrer Type"]=f.detectPage(m)),f.thisPageTraits.host=location.host,!g){if(i>1)return;f.debug("Detected landing page")}var n=parseInt(f.clientContext.sessionCount||0)+1;if(f.globalTraits["Session Count"]=n,P("sessionCount",n),f.debug("Session count: "+n),f.trackSessionStart=g||f.userId,!g){for(var o={},p=["UTM Source","UTM Medium","UTM Campaign","UTM Term","UTM Content","Landing Page","Landing Page Type","Initial Referrer","Initial Referring Domain"],q=0;q<p.length;q++)o[p[q]]="";var r=S();Object.keys(r).length>0&&(f.debug("utm params:"),f.debug(r),o=k(o,r)),l===location.host?f.trackReferrerLandingPages.indexOf(m)!==-1?(f.debug("Detected known untracked landing page: "+document.referrer),f.trackLandingPage=!0,f.landingPageTraits={path:m,url:document.referrer,$current_url:document.referrer,"Tracked From URL":location.href,referrer:""},o["Landing Page"]=m):document.referrer===location.href?(f.trackLandingPage=!0,o["Landing Page"]=location.pathname):n>1||f.trackDebugWarn("Landing page with local referrer - tracking code not on all pages?"):(f.trackLandingPage=!0,o["Landing Page"]=location.pathname,o["Initial Referrer"]=document.referrer?document.referrer:"",o["Initial Referring Domain"]=l),o["Landing Page"]&&(o["Landing Page Type"]=f.page),o["UTM Source"]||((T(document.URL,"gclid")||T(document.URL,"gclsrc"))&&(o["UTM Source"]="google",o["UTM Medium"]||(o["UTM Medium"]="cpc")),"t.yesware.com"==o["Referring Domain"]&&(o["UTM Source"]="Yesware",o["UTM Medium"]||(o["UTM Medium"]="email")));var s={},t={};for(var u in o)s[u+" [first touch]"]=o[u],t[u+" [last touch]"]=o[u];f.debug("Attribution params:"),f.debug(o),1==n&&1==f.thisPageTraits["Pageviews This Session"]&&(f.debug("..setting first touch params"),f.globalTraits=k(f.globalTraits,s)),f.debug("..setting last touch params"),f.globalTraits=k(f.globalTraits,t)}}function F(a){var b=[],c=window.optimizely;if(!c||!c.data)return b;var d=c.data,e=d.state,g=d.sections,h=e.activeExperiments;if(e.redirectExperiment){var i=e.redirectExperiment.experimentId,j=e.activeExperiments.indexOf(i);j===-1&&(h.push(i),f.overrideReferrer=e.redirectExperiment.referrer)}if(!h.length)return b;var k="Optimizely Experiments",l="Optimizely Variations",m=a[k],n=a[l];f.globalTraits[k]=m?"function"==typeof m.sort?m:[m]:[],f.globalTraits[l]=n?"function"==typeof n.sort?n:[n]:[];for(var o=0;o<h.length;o++){var p=h[o],q=e.variationIdsMap[p][0].toString(),r={"Experiment ID":p,"Experiment Name":d.experiments[p].name,"Experiment First View":!m||!m.indexOf||m.indexOf(p)===-1,"Variation ID":q,"Variation Name":e.variationNamesMap[p]};f.globalTraits[k].indexOf(p)===-1&&f.globalTraits[k].push(p);var s=g[p];if(s){r["Section Name"]=s.name,r["Variation ID"]=s.variation_ids.join();for(var t=0;t<s.variation_ids.length;t++)f.globalTraits[l].indexOf(s.variation_ids[t])===-1&&f.globalTraits[l].push(s.variation_ids[t])}else f.globalTraits[l].indexOf(q)===-1&&f.globalTraits[l].push(q);b.push(["Optimizely Experiment Viewed",r])}return f.globalTraits[k].sort(),f.globalTraits[l].sort(),b}function G(){var a=window.mixpanel,b=window.amplitude;if(f.userId){f.debug("doIdentify(): received userId: "+f.userId);var d={},e=["name","firstName","lastName","email","createdAt"];for(var l in f.userTraits){for(var m=l.toLowerCase(),n="",o=0;o<e.length;o++)if(m===e[o].toLowerCase()){n=e[o];break}n||(n="User "+j(l)),d[n]=f.userTraits[l]}var q,p=k(f.globalTraits,d);if(f.adaptor.userId()){if(q=f.adaptor.userId(),f.debug("Current userId: "+q),f.userId!==q){var s;i()&&b.getInstance&&(s=b.getInstance())&&(f.debug("Amplitude: logout"),s.setUserId(null),s.regenerateDeviceId&&s.regenerateDeviceId())}}else if(f.debug("Anonymous session until now"),g()&&(f.debug("analytics.alias("+f.userId+")"),f.adaptor.alias(f.userId,void 0,{integrations:{Mixpanel:!1}})),h()){var r=a.get_distinct_id?a.get_distinct_id():null;r!=f.userId?(f.debug("Mixpanel: $create_alias"),M(),a.register({__alias:f.userId}),a.track("$create_alias",{alias:f.userId,distinct_id:r},function(){f.debug("Mixpanel: $create_alias callback"),N()}),setTimeout(function(){f.debug("Mixpanel: ALIAS_WAIT_TIMEOUT reached"),N()},c)):f.debug("mixpanel.distinct_id == sitehound.userId; no Mixpanel alias call")}f.debug("adaptor.identify("+f.userId+", [traits])"),f.adaptor.identify(f.userId,p),h()&&(f.debug("Mixpanel: set distinct_id"),a.register({distinct_id:f.userId})),(f.userId!==q||f.clientSessionContext.loggedOut)&&(f.debug("userId != currentUserId - Login"),f.track("Login"),P("loggedOut",""))}else f.adaptor.identify(f.globalTraits),f.adaptor.userId()&&(h()&&(f.debug("Mixpanel: register({distinct_id: "+f.adaptor.userId()+"})"),a.register({distinct_id:f.adaptor.userId()})),1==f.thisPageTraits["Pageviews This Session"]&&(f.debug("not logged in, but user ID from prior session - setting logged_out cookie"),P("logged_out",!0,!0))),f.detectLogout=void 0===f.detectLogout?void 0!==f.userId:f.detectLogout,f.detectLogout&&!f.clientSessionContext.loggedOut&&(f.debug("doIdentify(): detecting potential logout.."),f.adaptor.userId()&&(f.track("Logout"),P("loggedOut",!0,!0),f.debug("Logout")))}function H(a,b,c){f.debug("Viewed Page: ",[a,b,c]),"object"==typeof c?f.adaptor.page(a,b,f.getTraitsToSend(c)):"object"==typeof b?f.adaptor.page(a,f.getTraitsToSend(b)):b?f.adaptor.page(a,b,f.getTraitsToSend()):f.adaptor.page(a,f.getTraitsToSend())}function I(){L(K(["ready","identify"]))}function J(){L(K())}function K(a){if(f.queue&&f.queue.length){if(!a||!a.length){var b=f.queue;return f.queue=[],b}for(var c=[],d=[],e=0;e<f.queue.length;e++)a.indexOf(f.queue[e][0])!==-1?c.push(f.queue[e]):d.push(f.queue[e]);return f.queue=d,c}}function L(a){for(;a&&a.length>0;){var b=a.shift(),c=b.shift();f[c]&&f[c].apply(f,b)}}function M(){return v?void f.debug("Called pauseAdaptor() but already paused"):(f.debug("pauseAdaptor()"),v={},void["track","identify","page"].map(function(a){v[a]=f.adaptor[a],f.adaptor[a]=function(){f.debug("adding to deferred queue: "+a);var b=Array.prototype.slice.call(arguments);b.unshift(a),w.push(b)}}))}function N(){if(v)for(f.debug("resumeAdaptor()"),["track","identify","page"].map(function(a){f.adaptor[a]=v[a]}),v=null;w&&w.length>0;){var a=w.shift(),b=a.shift();f.adaptor[b]?(f.debug("replaying deferred: "+b),f.adaptor[b].apply(f.adaptor,a)):f.debug("Unrecognised adaptor method: "+b)}}function O(a){f.debug("Detected URL change: "+location.href),f.overrideReferrer=a||document.referrer,f.page=void 0;for(var b=f.detectPage(),c=0;c<r.length;c++)r[c](b);f.sniff()}function P(a,b,c){b===!1&&(b=""),c?f.clientSessionContext[a]=b:f.clientContext[a]=b;var d=c?f.clientSessionContext:f.clientContext;d=u(d),R(c?"context_session":"context",d,c?0:366)}function Q(){function a(a,b,c){c=c||a;var d=b?f.clientSessionContext:f.clientContext;void 0===d[a]&&P(a,s(c),b),R(c,"",-100)}try{f.clientContext=t(s("context"))}catch(a){f.debug("error parsing context cookie")}try{f.clientSessionContext=t(s("context_session"))}catch(a){f.debug("error parsing context_session cookie")}"object"!=typeof f.clientContext&&(f.clientContext={}),"object"!=typeof f.clientSessionContext&&(f.clientSessionContext={}),["firstSeen","sessionCount"].map(function(b){a(b)}),["sessionStarted","sessionUpdated","pageViews"].map(function(b){a(b,!0)}),a("loggedOut",!0,"logged_out")}function R(a,b,c,d){var e="";if(0!=c){var g=new Date;g.setTime(g.getTime()+24*c*60*60*1e3),e="expires="+g.toUTCString()}void 0===d&&(d=f.cookieDomain),document.cookie="sh_"+a+"="+b+"; "+e+";path=/"+(d?";domain="+d:"")}function S(){for(var a="utm_source utm_medium utm_campaign utm_content utm_term".split(" "),b="",c={},d=0;d<a.length;++d)b=T(document.URL,a[d]),b.length&&(c["UTM "+j(a[d].slice(4))]=b);return c}function T(a,b){b=b.replace(/[\[]/,"\\[").replace(/[\]]/,"\\]");var c="[\\?&]"+b+"=([^&#]*)",d=new RegExp(c),e=d.exec(a);return null===e||e&&"string"!=typeof e[1]&&e[1].length?"":decodeURIComponent(e[1]).replace(/\+/g," ")}function U(a){f.adaptor=a,b="[SiteHound"+(a&&a.klass?":"+a.klass:"")+"] "}function V(a){for(var b=W(a),c=0;c<b.length;++c){var d="__tld__",e="."+b[c];if(R(d,1,0,e),s(d))return R(d,"",-100,e),e}return""}function W(a){var b=a.split("."),c=b[b.length-1],d=[];if(4==b.length&&parseInt(c,10)==c)return d;if(1>=b.length)return d;for(var e=b.length-2;0<=e;--e)d.push(b.slice(e).join("."));return d}var l,n,v,f=this,r=[],w=[];return U(d.adaptor&&(d.adaptor.klass||d.adaptor)!==e.klass?o(d.adaptor):e),"object"!=typeof this.adaptor?void q("adaptor not valid"):(!function(){var b={trackPages:null,page:null,trackAllPages:!1,detectURLChange:!0,detectHashChange:!1,domainsIgnore:["localhost","gtm-msr.appspot.com"],domainsIgnoreIPAddress:!0,domainsIgnoreSubdomains:["staging","test"],ignoreIPs:[],addTraitsForIPs:[],trackReferrerLandingPages:[],globalTraits:{},pageTraits:{},thisPageTraits:{},userId:void 0,userTraits:{},detectLogout:void 0,silent:!1,sessionTimeout:30,overrideReferrer:void 0,queue:[],clientContext:{},clientSessionContext:{},SNIPPET_VERSION:void 0};f.sniffed=!1;for(var c in b)void 0!==d[c]&&(b[c]=d[c]),f[c]=b[c];for(;d.length&&d.pop;)f.queue.unshift(d.pop());f.thisPageTraits["SiteHound library version"]=f.VERSION=a}(),this.sniff=this.done=function(){try{f.info("sniff()"),y(location.hostname)&&(f.info("Ignoring host: "+location.hostname),f.disable()),f.clientContext.dnt&&(f.info("Do-not-track cookie present - disabling."),f.disble()),(f.ignoreIPs||f.addTraitsForIPs)&&(z(),A()&&(f.info("Ignoring IP: "+f.clientContext.ip+"; matched pattern: "+(f.ignoreIPs.join?f.ignoreIPs.join(","):f.ignoreIPs)),f.disable()),B());var a=!f.sniffed;if(D(),!a)return;J(),!f.detectURLChange&&!f.detectHashChange||l||(n=location.href,l=setInterval(function(){(f.detectHashChange?location.href!==n:location.href.replace(/#.*$/,"")!==n.replace(/#.*$/,""))&&(O(n),n=location.href)},1e3))}catch(a){this.trackError(a)}},this.deferUntilSniff=function(a,b){return!f.sniffed&&(b=Array.prototype.slice.call(b),b.unshift(a),f.queue.push(b),f.debug("(Deferring "+a+"() until sniff)"),!0)},this.identify=function(a,b){f.debug("identify",[a,b]),"object"==typeof b?(f.userId=a,f.globalTraits=k(f.globalTraits,b)):"object"==typeof a?f.globalTraits=k(f.globalTraits,a):f.userId=a,f.sniffed&&G()},this.identifyOnce=function(a){f.deferUntilSniff("identifyOnce",arguments)||(f.debug("identifyOnce",a),f.adaptor.identifyOnce(a))},this.detectPage=function(a){void 0===a&&(a=location.pathname);for(var b in f.trackPages){var c=f.trackPages[b];Array.isArray(c)||(c=[c]);for(var d=0;d<c.length;++d){var e=c[d];if("function"==typeof e.test){if(e.test(a))return f.debug("Detected page: "+b),b}else if("."===e[0]){if(a===location.pathname&&document.body.className.match(new RegExp("(?:^|\\s)"+m(e.slice(1))+"(?!\\S)")))return f.debug("Detected page: "+b),b}else if(a.replace(/\/$/,"").match(new RegExp("^"+m(e.replace(/\/$/,"")).replace(/\\\*/g,".*")+"$")))return f.debug("Detected page: "+b),b}}},this.getTraitsToSend=function(a){var b=k(f.globalTraits,f.thisPageTraits);return"object"==typeof a?k(b,a):b},this.info=function(a,b){f.silent||p(a,b)},this.debug=function(a,b){f.clientContext.logToConsole&&p(a,b)},this.doNotTrack=function(a){a="undefined"==typeof a||!!a,P("dnt",a),f.debug("doNotTrack:"+a)},this.debugMode=function(a){a="undefined"==typeof a||!!a,P("logToConsole",a),f.debug("debugMode: "+a)},this.onURLChange=this.onUrlChange=function(a){"function"==typeof a?(this.debug("onURLChange()"),r.push(a)):q("onURLChange() called with something that isn't a function")},this.load=function(a){f.debug("load() called when already loaded"),a&&(U(o(a)),f.info("Updated adaptor to: "+f.adaptor.klass))},this.disable=function(){U(o("disabled")),f.info("Disabled tracking")},void x())}function g(){var a=window.sitehound.adaptor;return a&&("segment"===a||"segment"==a.klass)}function h(){return window.mixpanel&&(!g()||analytics.Integrations.Mixpanel)}function i(){return window.amplitude&&g()&&analytics.Integrations.Amplitude}function j(a){return"string"==typeof a?a.replace(/\w\S*/g,function(a){return a.charAt(0).toUpperCase()+a.substr(1).toLowerCase()}):a}function k(a,b){var c={};for(var d in a)c[d]=a[d];for(var d in b)c[d]=b[d];return c}function l(a,b){if("undefined"==typeof a)return b;var c={};for(var d in b)d in a||(c[d]=b[d]);return c}function m(a){return a.replace(/([\/*.?[\]()\-\|])/g,"\\$1")}function n(a,b){d[a]=b,b.prototype.klass=a}function o(a){var b,c;if("object"==typeof a&&null!==a)c=a;else{b=(a||"segment").toLowerCase()||"segment";try{var c=new d[b]}catch(a){return q("adaptor "+b+" could not be loaded"),void q(a.name+"; "+a.message)}}return c}function p(a,c){if(window.console&&console.log)try{"object"==typeof a?JSON&&JSON.stringify&&(a=b+JSON.stringify(a)):a=b+a,c&&JSON&&JSON.stringify&&(a=a+"("+JSON.stringify(c).slice(1).slice(0,-1)+")",c=null),console.log(a),c&&console.log(c)}catch(a){q(a.name+"; "+a.message)}}function q(a){window.console&&(console.error?console.error(b+a):console.log&&console.log(b+"[ERROR] "+a))}function r(a,b,c){for(var d=c||window,e=a.split("."),f=0;f<e.length;f++){if("undefined"==typeof d[e[f]])return void setTimeout(function(){r(a,b,c)},50);d=d[e[f]]}b()}function s(a,b){void 0===b&&(b="sh_");for(var c=b+a+"=",d=document.cookie.split(";"),e=0;e<d.length;e++){for(var f=d[e];" "==f.charAt(0);)f=f.substring(1);if(0==f.indexOf(c))return f.substring(c.length,f.length)}return""}function t(a){var b={};return a.split("&").map(function(a){a&&(a=a.split("=").map(function(a){return decodeURIComponent(a)}),b[a[0]]=a[1])}),b}function u(a){var b=[];for(var c in a)a.hasOwnProperty(c)&&b.push(encodeURIComponent(c)+"="+encodeURIComponent(a[c]));return b.join("&")}var a="0.9.72",b="[SiteHound] ",c=300,d={};f.prototype.push=function(a){var b=a.shift();this[b]?this[b].apply(this,a):this.debug("Unrecognised method: "+b)},f.prototype.alias=function(a,b,c){this.deferUntilSniff("alias",arguments)||(this.debug("alias",[a,b,c]),this.adaptor.alias(a,b,c))},f.prototype.track=function(a,b){function d(a){return a.replace(";","_").replace(":","_")}if(!this.deferUntilSniff("track",arguments)){if(this.debug("track",[a,b]),"object"==typeof b){for(var c in{eventUniqueKey:1,event_unique_key:1,"Event Unique Key":1,"Event unique key":1,"event unique key":1})if(b[c]){c=d(b[c]);var e=d(a)+":"+d(c),f=(self.clientSessionContext.uniqueEvents||"").split(";");if(f.indexOf(e)!==-1)return void this.debug("already tracked unique event, skipping: "+e);setLocalContext("uniqueEvents",f.push(e).join(";"));break}b=this.getTraitsToSend(b)}else b=this.getTraitsToSend();this.adaptor.track(a,b)}},f.prototype.trackOnce=function(a,b){if(!this.deferUntilSniff("trackOnce",arguments)){this.debug("trackOnce",[a,b]);var c=this.adaptor.userTraits();if(void 0===c["First "+a]){var d={};d["First "+a]=(new Date).toISOString(),this.adaptor.identify(d),this.track(a,b)}}},f.prototype.trackAndCount=function(a,b){if(!this.deferUntilSniff("trackAndCount",arguments)){this.debug("trackAndCount",[a,b]);var c=this.adaptor.userTraits(),d=1;c&&(d=c[a+" Count"]?parseInt(c[a+" Count"])+1:1);var e={};e["First "+a]=(new Date).toISOString(),this.identifyOnce(e);var f={};f[a+" Count"]=d,f["Last "+a]=(new Date).toISOString(),this.adaptor.identify(f),this.track(a,b)}},f.prototype.trackLink=function(a,b,c){if(!this.deferUntilSniff("trackLink",arguments)){var d={};a&&a.selector&&(d.selector=a.selector),a&&a.length&&(d.length=a.length),this.debug("trackLink",[d,b,c]),this.adaptor.trackLink(a,b,this.getTraitsToSend(c))}},f.prototype.trackForm=function(a,b,c){if(!this.deferUntilSniff("trackForm",arguments)){var d={};a&&a.selector&&(d.selector=a.selector),a&&a.length&&(d.length=a.length),this.debug("trackForm",[d,b,c]),this.adaptor.trackForm(a,b,this.getTraitsToSend(c))}},f.prototype.ready=function(a){if("function"==typeof a){var b=this.detectPage();this.debug("ready("+b+")"),a(b)}else q("ready() called with something that isn't a function")},f.prototype.getUserTraits=function(){return result=k(this.adaptor.userTraits(),this.userTraits),this.debug("getUserTraits() returned ",result),result},f.prototype.trackDebugInfo=function(a){this.trackDebug(a,"info")},f.prototype.trackDebugWarn=function(a){this.trackDebug(a,"warn")},f.prototype.trackDebug=function(a,b){b||(b="info"),this.adaptor.track("Tracking Debug",{message:a,level:b,"SiteHound library version":this.VERSION}),this.debug("["+b+"] "+a)},f.prototype.trackError=function(a){var b={};"object"==typeof a?(b.name=a.name||"",b.message=a.message||"",a.stack&&(b.stackTrace=a.stack)):b.message=a,b["SiteHound library version"]=this.VERSION,this.adaptor.track("Tracking Error",b),q(a.name+"; "+a.message+(a.stack?"\n"+a.stack:""))},n("disabled",function(){this.ready=function(a){a()},this.identify=this.identifyOnce=this.track=this.trackLink=this.trackForm=this.page=this.alias=this.userId=function(){},this.userTraits=function(){return{}}}),n("segment",function(){var a=this;this.ready=function(a){r("analytics.ready",function(){analytics.ready(a)})},this.identify=function(a,b,c){analytics.identify(a,b,c)},this.identifyOnce=function(b){if(b=l(a.userTraits(),b),a.identify(b,{integrations:{Mixpanel:!1,Amplitude:!1}}),h()&&mixpanel.people.set_once(b),i()){var c=new amplitude.Identify;for(var d in b)b.hasOwnProperty(d)&&c.setOnce(d,b[d]);amplitude.getInstance().identify(c)}},this.track=function(a,b){analytics.track(a,b)},this.trackLink=function(a,b,c){analytics.trackLink(a,b,c)},this.trackForm=function(a,b,c){analytics.trackForm(a,b,c)},this.page=function(a,b,c){analytics.page(a,b,c)},this.alias=function(a,b,c){analytics.alias(a,b,c)},this.userId=function(){var a=analytics.user();return a?a.id():void 0},this.userTraits=function(){var a=analytics.user(),b=a.traits();return b||{}}}),e()}();