//
//  SiteHound - Easy & powerful website analytics tracking
//
//  Docs: http://www.sitehound.co
//  Source: https://github.com/andyyoung/sitehound
//
//  @author        Andy Young // @andyy // andy@apexa.co.uk
//  @version       0.962 - 5th May 2016
//  @licence       GNU GPL v3  http://www.gnu.org/licenses/
//
//  Copyright (C) 2016 Andy Young // andy@apexa.co.uk
//  ~~ 500 Startups Distro Team // #500STRONG // 500.co ~~
//
!function(){function e(){var e=window.sitehound||{},n=a(e.adaptor);n&&n.ready(function(){var e=window.sitehound||{};new t(e,n)})}function t(e,t){function o(e){if(-1!=L.domainsIgnore.indexOf(e))return!0;if(L.domainsIgnoreIPAddress&&/([0-9]{1,3}\.){3}[0-9]{1,3}/.test(e))return!0;for(var t=0;t<L.domainsIgnoreSubdomains.length;t++)if(0==e.indexOf(L.domainsIgnoreSubdomains[t]+"."))return!0;return!1}function a(){L.sniffed=!0,L.page||(L.page=L.detectPage(location.pathname)),L.thisPageTraits["Page Type"]=L.page,void 0!==L.overrideReferrer&&(L.thisPageTraits.referrer=L.thisPageTraits.Referrer=L.thisPageTraits.$referrer=L.overrideReferrer),c();var e=L.adaptor.userTraits();if(e.createdAt&&(L.globalTraits["Days Since Signup"]=Math.floor((new Date-new Date(e.createdAt))/1e3/60/60/24),L.info("Days since signup: "+L.globalTraits["Days Since Signup"])),L.userTraits["Email Domain"]?L.userTraits["Email Domain"]=L.userTraits["Email Domain"].match(/[^@]*$/)[0]:(e.Email||e.email||L.userTraits.Email)&&(L.userTraits["Email Domain"]=(e.Email||e.email||L.userTraits.Email).match(/[^@]*$/)[0]),window.FS&&window.FS.getCurrentSessionURL)L.globalTraits["Fullstory URL"]=FS.getCurrentSessionURL();else if(!L.sniffed){var t=window._fs_ready;window._fs_ready=function(){L.adaptor.identify({"Fullstory URL":FS.getCurrentSessionURL()}),"function"==typeof t&&t()}}if(L.userId){L.info("Received userId: "+L.userId);var e={},r=["name","email","createdAt"];for(var o in L.userTraits){for(var a=o.toLowerCase(),s="",f=0;f<r.length;f++)if(a===r[f].toLowerCase()){s=r[f];break}s||(s="User "+n(o)),e[s]=L.userTraits[o]}var u,l=i(L.globalTraits,e);L.adaptor.userId()?(u=L.adaptor.userId(),L.info("Current userId: "+u)):(L.info("Anonymous session until now - alias()"),L.adaptor.alias(L.userId),L.adaptor.identify("x")),L.info("identify("+L.userId+", [traits])"),L.userId!==u&&(l=i(l,T({createdAt:(new Date).toISOString()}))),L.adaptor.identify(L.userId,l),L.userId!==u&&(L.info("userId != currentUserId - Login"),L.track("Login")),p("logged_out","",-100)}else L.adaptor.identify(L.globalTraits),L.detectLogout=void 0===L.detectLogout?void 0!==L.userId:L.detectLogout,L.detectLogout&&(L.info("Detecting potential logout.."),L.adaptor.userId()&&(m("logged_out")||(L.track("Logout"),p("logged_out",!0),L.info("Logout"))));if(L.trackLandingPage&&(d("Landing",L.landingPageTraits),L.trackLandingPage=!1),L.page){var g=L.page.split("|",2).map(function(e){return e.trim()});g.push(L.pageTraits);d.apply(L,g)}else L.trackAllPages&&d("Unidentified")}function c(){var e=m("firstSeen")||(new Date).toISOString();p("firstSeen",e,366);var t=Math.floor((new Date-new Date(e))/1e3/60/60/24);L.globalTraits["First Seen"]=e,L.globalTraits["Days Since First Seen"]=t,L.info("Visitor first seen: "+e),L.info("Days since first seen: "+t);var n=m("sessionStarted")||(new Date).toISOString(),r=m("sessionUpdated")||(new Date).toISOString(),o=Math.floor((new Date-new Date(n))/1e3/60),a=Math.floor((new Date-new Date(r))/1e3/60);L.globalTraits["Session Started"]=n,L.globalTraits["Minutes Since Session Start"]=o,L.info("Session started: "+n),L.info("Session duration: "+o),L.info("Minutes since last event: "+a);var s=a>L.sessionTimeout;s&&(L.info("Session timed out - tracking as new session"),n=(new Date).toISOString()),p("sessionStarted",n),p("sessionUpdated",(new Date).toISOString());var c=(s?0:parseInt(m("pageViews")||0))+1;L.thisPageTraits["Pageviews This Session"]=c,p("pageViews",c),L.info("Pageviews: "+c);var d,f=document.referrer.match(/https?:\/\/([^\/]+)(\/.*)/),u=null;if(f&&(u=f[1],d=f[2]),u==location.host&&(L.thisPageTraits["Referrer Type"]=L.detectPage(d)),L.isLandingPage=!1,!s){if(c>1)return;L.isLandingPage=!0,L.info("Detected landing page")}var l=parseInt(m("sessionCount")||0)+1;if(L.globalTraits["Session Count"]=l,p("sessionCount",l,366),L.info("Session count: "+l),!s){for(var g={},h=["UTM Source","UTM Medium","UTM Campaign","UTM Term","UTM Content","Landing Page","Landing Page Type","Initial Referrer","Initial Referring Domain"],S=0;S<h.length;S++)g[h[S]]=null;var k=y();Object.keys(k).length>0&&(L.info("utm params:"),L.info(k),g=i(g,k)),u===location.host?-1!==L.trackReferrerLandingPages.indexOf(d)?(L.info("Detected known untracked landing page: "+document.referrer),L.trackLandingPage=!0,L.landingPageTraits={path:d,url:document.referrer,$current_url:document.referrer,"Tracked From URL":location.href,referrer:""},g["Landing Page"]=d):document.referrer===location.href?(L.trackLandingPage=!0,g["Landing Page"]=location.pathname):l>1||L.trackDebugWarn("Landing page with local referrer - tracking code not on all pages?"):(L.trackLandingPage=!0,g["Landing Page"]=location.pathname,g["Initial Referrer"]=document.referrer?document.referrer:null,g["Initial Referring Domain"]=u),g["Landing Page"]&&(g["Landing Page Type"]=L.page),g["UTM Source"]||((v(document.URL,"gclid")||v(document.URL,"gclsrc"))&&(g["UTM Source"]="google",g["UTM Medium"]||(g["UTM Medium"]="cpc")),"t.yesware.com"==g["Referring Domain"]&&(g["UTM Source"]="Yesware",g["UTM Medium"]||(g["UTM Medium"]="email")));var w={},I={};for(var D in g)w[D+" [first touch]"]=g[D],I[D+" [last touch]"]=g[D];L.info("Attribution params:"),L.info(g),1==l&&(L.info("..setting first touch params"),L.globalTraits=i(L.globalTraits,T(w))),L.info("..setting last touch params"),L.globalTraits=i(L.globalTraits,I)}}function d(e,t,n){L.info("Viewed Page: ",[e,t,n]),"object"==typeof n?L.adaptor.page(e,t,L.getTraitsToSend(n)):"object"==typeof t?L.adaptor.page(e,L.getTraitsToSend(t)):t?L.adaptor.page(e,t,L.getTraitsToSend()):L.adaptor.page(e,L.getTraitsToSend())}function f(){g(l(["ready"]))}function u(){g(l()),g(L.queue)}function l(t){if(e.queue&&e.queue.length){if(!t||!t.length){var n=e.queue;return e.queue=[],n}for(var i=[],r=[],o=0;o<e.queue.length;o++)-1!==t.indexOf(e.queue[o][0])?i.push(e.queue[o]):r.push(e.queue[o]);return e.queue=r,i}}function g(e){for(;e&&e.length>0;){var t=e.shift(),n=t.shift();L[n]&&L[n].apply(L,t)}}function h(){console.log("urlChangeQueue"),console.log(U);for(var e=0;e<U.length;e++)U[e]()}function p(e,t,n,i){var r="";if(0!=n){var o=new Date;o.setTime(o.getTime()+24*n*60*60*1e3),r="expires="+o.toUTCString()}void 0===i&&(i=L.cookieDomain),document.cookie="sh_"+e+"="+t+"; "+r+";path=/"+(i?";domain="+i:"")}function m(e){for(var t="sh_"+e+"=",n=document.cookie.split(";"),i=0;i<n.length;i++){for(var r=n[i];" "==r.charAt(0);)r=r.substring(1);if(0==r.indexOf(t))return r.substring(t.length,r.length)}return""}function y(){for(var e="utm_source utm_medium utm_campaign utm_content utm_term".split(" "),t="",i={},r=0;r<e.length;++r)t=v(document.URL,e[r]),t.length&&(i["UTM "+n(e[r].slice(4))]=t);return i}function v(e,t){t=t.replace(/[\[]/,"\\[").replace(/[\]]/,"\\]");var n="[\\?&]"+t+"=([^&#]*)",i=new RegExp(n),r=i.exec(e);return null===r||r&&"string"!=typeof r[1]&&r[1].length?"":decodeURIComponent(r[1]).replace(/\+/g," ")}function T(e){var t=L.adaptor.userTraits(),n={};for(var i in e)i in t||(n[i]=e[i]);return n}function S(e){for(var t=k(e),n=0;n<t.length;++n){var i="__tld__",r="."+t[n];if(p(i,1,0,r),m(i))return p(i,"",-100,r),r}return""}function k(e){var t=e.split("."),n=t[t.length-1],i=[];if(4==t.length&&parseInt(n,10)==n)return i;if(1>=t.length)return i;for(var r=t.length-2;r>=0;--r)i.push(t.slice(r).join("."));return i}var w={trackPages:null,page:null,trackAllPages:!1,detectURLChange:!0,detectHashChange:!1,domainsIgnore:["localhost","gtm-msr.appspot.com"],domainsIgnoreIPAddress:!0,domainsIgnoreSubdomains:["staging","test"],trackReferrerLandingPages:[],globalTraits:{},pageTraits:{},thisPageTraits:{},userId:void 0,userTraits:{},detectLogout:void 0,logToConsole:!1,sessionTimeout:30,overrideReferrer:void 0,queue:[]},L=this;if(this.sniffed=!1,this.adaptor=t,"object"!=typeof t||!t.check())return void(window.console&&console.error&&console.error("[SiteHound] adaptor not valid"));for(var I in w)void 0!==e[I]&&(w[I]=e[I]),this[I]=w[I];this.thisPageTraits["SiteHound library version"]=this.VERSION=s;var D,b,U=[];return this.sniff=this.done=function(){try{if(L.info("Sniffing.."),o(location.hostname))return L.info("Ignoring host: "+location.hostname),void(L.adaptor="disabled");if(m("dnt"))return L.info("do-not-track cookie present"),void(L.adaptor="disabled");f();var e=!L.sniffed;if(a(),!e)return;u(),!L.detectURLChange&&!L.detectHashChange||D||(b=location.href,D=setInterval(function(){(L.detectHashChange?location.href!==b:location.href.replace(/#.*$/,"")!==b.replace(/#.*$/,""))&&(L.overrideReferrer=b||document.referrer,b=location.href,L.info("Detected URL change: "+b),L.page=void 0,h(),L.sniff())},1e3))}catch(t){this.trackError(t)}},this.deferUntilSniff=function(e,t){return L.sniffed?!1:(t=Array.prototype.slice.call(t),t.unshift(e),L.queue.push(t),L.info("(Deferring "+e+"() until sniff)"),!0)},this.identifyOnce=function(e){L.deferUntilSniff("identifyOnce",arguments)||(L.info("identifyOnce",e),L.adaptor.identify(T(e)))},this.detectPage=function(e){void 0===e&&(e=location.pathname);for(var t in L.trackPages){var n=L.trackPages[t];Array.isArray(n)||(n=[n]);for(var i=0;i<n.length;++i){var o=n[i];if("function"==typeof o.test){if(o.test(e))return L.info("Detected page: "+t),t}else if("."===o[0]){if(e===location.pathname&&document.body.className.match(new RegExp("(?:^|\\s)"+r(o.slice(1))+"(?!\\S)")))return L.info("Detected page: "+t),t}else if(e.replace(/\/$/,"").match(new RegExp("^"+r(o.replace(/\/$/,"")).replace(/\\\*/g,".*")+"$")))return L.info("Detected page: "+t),t}}},this.getTraitsToSend=function(e){var t=i(L.globalTraits,L.thisPageTraits);return"object"==typeof e?i(t,e):t},this.info=function(e,t){if(L.logToConsole&&window.console&&console.log)try{var n="[SiteHound] ";"object"==typeof e?JSON&&JSON.stringify&&(e=n+JSON.stringify(e)):e=n+e,t&&JSON&&JSON.stringify&&(e=e+"("+JSON.stringify(t).slice(1).slice(0,-1)+")",t=null),console.log(e),t&&console.log(t)}catch(i){L.trackError(i)}},this.doNotTrack=function(e){e="undefined"==typeof e?!0:!!e,e?p("dnt","1",1e3):p("dnt","",-100),L.info("doNotTrack",e?"true":"false")},this.onURLChange=this.onUrlChange=function(e){"function"==typeof e?(this.info("onURLChange()"),U.push(e)):window.console&&console.error&&console.error("[SiteHound] onURLChange() called with something that isn't a function")},this.info("Ready (v"+s+")"),this.cookieDomain=S(location.hostname),this.info("Cookie domain: "+this.cookieDomain),m("dnt")?(this.info("do-not-track cookie present"),void(this.adaptor="disabled")):(window.sitehound=this,void(e.isDone&&this.sniff()))}function n(e){return"string"==typeof e?e.replace(/\w\S*/g,function(e){return e.charAt(0).toUpperCase()+e.substr(1).toLowerCase()}):e}function i(e,t){var n={};for(var i in e)n[i]=e[i];for(var i in t)n[i]=t[i];return n}function r(e){return e.replace(/([\/*.?[\]()\-\|])/g,"\\$1")}function o(e,t){c[e]=t}function a(e){var t,n;if("object"==typeof e)n=e;else{t=(e||"segment").toLowerCase()||"segment";try{var n=new c[t]}catch(i){return void(window.console&&console.error&&(console.error("[SiteHound] adaptor "+t+" could not be loaded"),console.error("[SiteHound] "+i.name+"; "+i.message)))}}return n.check()?n:void(window.console&&console.error&&console.error("[SiteHound] failed to attach to "+(t?t:"adaptor")))}var s="0.962",c={};t.prototype.identify=function(e,t){this.deferUntilSniff("identify",arguments)||(this.info("identify",[e,t]),this.adaptor.identify(e,t))},t.prototype.track=function(e,t){this.deferUntilSniff("track",arguments)||(t="object"==typeof t?this.getTraitsToSend(t):this.getTraitsToSend(),this.info("track",[e,t]),this.adaptor.track(e,t))},t.prototype.trackOnce=function(e,t){if(!this.deferUntilSniff("trackOnce",arguments)){this.info("trackOnce",[e,t]);var n=this.adaptor.userTraits();if(void 0===n["First "+e]){var i={};i["First "+e]=(new Date).toISOString(),this.adaptor.identify(i),this.track(e,t)}}},t.prototype.trackAndCount=function(e,t){if(!this.deferUntilSniff("trackAndCount",arguments)){this.info("trackAndCount",[e,t]);var n=this.adaptor.userTraits(),i=1;n&&(i=n[e+" Count"]?parseInt(n[e+" Count"])+1:1);var r={};r["First "+e]=(new Date).toISOString(),this.identifyOnce(r);var o={};o[e+" Count"]=i,o["Last "+e]=(new Date).toISOString(),this.adaptor.identify(o),this.track(e,t)}},t.prototype.trackLink=function(e,t){if(!this.deferUntilSniff("trackLink",arguments)){var n={};e&&e.selector&&(n.selector=e.selector),e&&e.length&&(n.length=e.length),this.info("trackLink",[n,t]),this.adaptor.trackLink(e,t,this.getTraitsToSend())}},t.prototype.trackForm=function(e,t){if(!this.deferUntilSniff("trackForm",arguments)){var n={};e&&e.selector&&(n.selector=e.selector),e&&e.length&&(n.length=e.length),this.info("trackForm",[n,t]),this.adaptor.trackForm(e,t,this.getTraitsToSend())}},t.prototype.ready=function(e){"function"==typeof e?(this.info("ready()"),e()):window.console&&console.error&&console.error("[SiteHound] ready() called with something that isn't a function")},t.prototype.getUserTraits=function(){return result=i(this.adaptor.userTraits(),this.userTraits),this.info("getUserTraits() returned ",result),result},t.prototype.load=function(e){this.info("load() called when already loaded"),e&&(this.info("updating adaptor to: "+e),this.adaptor=a(e))},t.prototype.trackDebugInfo=function(e){this.trackDebug(e,"info")},t.prototype.trackDebugWarn=function(e){this.trackDebug(e,"warn")},t.prototype.trackDebug=function(e,t){t||(t="info"),this.adaptor.track("Tracking Debug",{message:e,level:t,"SiteHound library version":this.VERSION}),this.info("["+t+"] "+e)},t.prototype.trackError=function(e){this.adaptor.track("Tracking Error",{name:e.name,message:e.message,"SiteHound library version":this.VERSION}),window.console&&console.error&&console.error("[SiteHound] "+e.name+"; "+e.message)},o("disabled",function(){this.check=this.ready=this.identify=this.track=this.trackLink=this.trackForm=this.page=this.alias=this.userId=this.userTraits=function(){}}),o("segment",function(){window.analytics=window.analytics||[];return this.check=function(){return"undefined"!=typeof analytics.ready},this.check()?(this.ready=function(e){analytics.ready(e)},this.identify=function(e,t){analytics.identify(e,t)},this.track=function(e,t){analytics.track(e,t)},this.trackLink=function(e,t,n){analytics.trackLink(e,t,n)},this.trackForm=function(e,t,n){analytics.trackForm(e,t,n)},this.page=function(e,t,n){analytics.page(e,t,n)},this.alias=function(e){analytics.alias(e)},this.userId=function(){var e=analytics.user();return e?e.id():void 0},void(this.userTraits=function(){var e=analytics.user(),t=e.traits();return t})):void(window.console&&console.error&&console.error("[SiteHound] window.analytics is not initialized - ensure analytics.js snippet is included first"))}),e()}();