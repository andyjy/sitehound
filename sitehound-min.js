//
//  SiteHound - Easy & powerful user, session and event tracking
//  ~~ 500 Startups Distro Team // #500STRONG // 500.co ~~
//
//  @author        Andy Young // @andyy // andy@apexa.co.uk
//  @version       0.94 - 22nd April 2016
//  @licence       GNU GPL v3
//
//  Copyright (C) 2016 Andy Young // andy@apexa.co.uk
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
!function(){function SiteHound(e,t){function n(e){if(-1!=T.domainsIgnore.indexOf(e))return!0;if(T.domainsIgnoreIPAddress&&/([0-9]{1,3}\.){3}[0-9]{1,3}/.test(e))return!0;for(var t=0;t<T.domainsIgnoreSubdomains.length;t++)if(0==e.indexOf(T.domainsIgnoreSubdomains[0]+"."))return!0;return!1}function i(){T.sniffed=!0,T.page||(T.page=T.detectPage(location.pathname)),T.thisPageTraits["Page Type"]=T.page,void 0!==T.overrideReferrer&&(T.thisPageTraits.referrer=T.thisPageTraits.Referrer=T.thisPageTraits.$referrer=T.overrideReferrer),r();var e=T.adaptor.userTraits();if(e.createdAt&&(T.globalTraits["Days Since Signup"]=Math.floor((new Date-new Date(e.createdAt))/1e3/60/60/24),T.info("Days since signup: "+T.globalTraits["Days Since Signup"])),T.userTraits["Email Domain"]?T.userTraits["Email Domain"]=T.userTraits["Email Domain"].match(/[^@]*$/)[0]:(e.Email||e.email||T.userTraits.Email)&&(T.userTraits["Email Domain"]=(e.Email||e.email||T.userTraits.Email).match(/[^@]*$/)[0]),window.FS&&window.FS.getCurrentSessionURL)T.globalTraits["Fullstory URL"]=FS.getCurrentSessionURL();else if(!T.sniffed){var t=window._fs_ready;window._fs_ready=function(){T.adaptor.identify({"Fullstory URL":FS.getCurrentSessionURL()}),"function"==typeof t&&t()}}if(T.userId){T.info("Received userId: "+T.userId);var e={};for(var n in T.userTraits){var i=-1!==["name","email"].indexOf(n.toLowerCase())?n.toLowerCase():"User "+titleCase(n);e[i]=T.userTraits[n]}var o,s=p(T.globalTraits,e);T.adaptor.userId()?(o=T.adaptor.userId(),T.info("Current userId: "+o)):(T.info("Anonymous session until now - alias()"),T.adaptor.alias(T.userId),T.adaptor.identify("x")),T.info("identify("+T.userId+", [traits])"),T.userId!==o&&(s=p(s,m({createdAt:(new Date).toISOString()}))),T.adaptor.identify(T.userId,s),T.userId!==o&&(T.info("userId != currentUserId - Login"),T.track("Login")),l("logged_out","",-100)}else T.adaptor.identify(T.globalTraits),T.detectLogout=void 0===T.detectLogout?void 0!==T.userId:T.detectLogout,T.detectLogout&&(T.info("Detecting potential logout.."),T.adaptor.userId()&&(g("logged_out")||(T.track("Logout"),l("logged_out",!0),T.info("Logout"))));if(T.trackLandingPage&&a("Landing",T.landingPageTraits),T.page){var d=T.page.split("|",2).map(function(e){return e.trim()});d.push(T.pageTraits);a.apply(T,d)}else T.trackAllPages&&a("Unidentified")}function r(){var e=g("firstSeen")||(new Date).toISOString();l("firstSeen",e,366);var t=Math.floor((new Date-new Date(e))/1e3/60/60/24);T.globalTraits["First Seen"]=e,T.globalTraits["Days Since First Seen"]=t,T.info("Visitor first seen: "+e),T.info("Days since first seen: "+t);var n=g("sessionStarted")||(new Date).toISOString(),i=g("sessionUpdated")||(new Date).toISOString(),r=Math.floor((new Date-new Date(n))/1e3/60),a=Math.floor((new Date-new Date(i))/1e3/60);T.globalTraits["Session Started"]=n,T.globalTraits["Minutes Since Session Start"]=r,T.info("Session started: "+n),T.info("Session duration: "+r),T.info("Minutes since last event: "+a);var o=a>T.sessionTimeout;o&&(T.info("Session timed out - tracking as new session"),n=(new Date).toISOString()),l("sessionStarted",n),l("sessionUpdated",(new Date).toISOString());var s=(o?0:parseInt(g("pageViews")||0))+1;T.thisPageTraits["Pageviews This Session"]=s,l("pageViews",s),T.info("Pageviews: "+s);var d,u=document.referrer.match(/https?:\/\/([^\/]+)(\/.*)/),h=null;if(u&&(h=u[1],d=u[2]),h==location.host&&(T.thisPageTraits["Referrer Type"]=T.detectPage(d)),T.isLandingPage=!1,!o){if(s>1)return;T.isLandingPage=!0,T.info("Detected landing page")}var S=parseInt(g("sessionCount")||0)+1;if(T.globalTraits["Session Count"]=S,l("sessionCount",S,366),T.info("Session count: "+S),!o){for(var y={},v=["UTM Source","UTM Medium","UTM Campaign","UTM Term","UTM Content","Landing Page","Landing Page Type","Initial Referrer","Initial Referring Domain"],k=0;k<v.length;k++)y[v[k]]=null;var w=c();Object.keys(w).length>0&&(T.info("utm params:"),T.info(w),y=p(y,w)),h===location.host?-1!==T.trackReferrerLandingPages.indexOf(d)?(T.info("Detected known untracked landing page: "+document.referrer),T.trackLandingPage=!0,T.landingPageTraits={path:d,url:document.referrer,$current_url:document.referrer,"Tracked From URL":location.href,referrer:""},y["Landing Page"]=d):document.referrer===location.href?(T.trackLandingPage=!0,y["Landing Page"]=location.pathname):S>1||T.trackDebugWarn("Landing page with local referrer - tracking code not on all pages?"):(T.trackLandingPage=!0,y["Landing Page"]=location.pathname,y["Initial Referrer"]=document.referrer?document.referrer:null,y["Initial Referring Domain"]=h),y["Landing Page"]&&(y["Landing Page Type"]=T.page),y["UTM Source"]||((f(document.URL,"gclid")||f(document.URL,"gclsrc"))&&(y["UTM Source"]="google",y["UTM Medium"]||(y["UTM Medium"]="cpc")),"t.yesware.com"==y["Referring Domain"]&&(y["UTM Source"]="Yesware",y["UTM Medium"]||(y["UTM Medium"]="email")));var I={},D={};for(var L in y)I[L+" [first touch]"]=y[L],D[L+" [last touch]"]=y[L];T.info("Attribution params:"),T.info(y),1==S&&(T.info("..setting first touch params"),T.globalTraits=p(T.globalTraits,m(I))),T.info("..setting last touch params"),T.globalTraits=p(T.globalTraits,D)}}function a(e,t,n){"object"==typeof n?T.adaptor.page(e,t,T.getTraitsToSend(n)):"object"==typeof t?T.adaptor.page(e,T.getTraitsToSend(t)):t?T.adaptor.page(e,t,T.getTraitsToSend()):T.adaptor.page(e,T.getTraitsToSend())}function o(){u(d(["ready"]))}function s(){u(d()),u(T.queue)}function d(t){if(e.queue&&e.queue.length){if(!t||!t.length){var n=e.queue;return e.queue=[],n}for(var i=[],r=[],a=0;a<e.queue.length;a++)-1!==t.indexOf(e.queue[a][0])?i.push(e.queue[a]):r.push(e.queue[a]);return e.queue=r,i}}function u(e){for(;e&&e.length>0;){var t=e.shift(),n=t.shift();T[n]&&T[n].apply(T,t)}}function c(){for(var e="utm_source utm_medium utm_campaign utm_content utm_term".split(" "),t="",n={},i=0;i<e.length;++i)t=f(document.URL,e[i]),t.length&&(n["UTM "+titleCase(e[i].slice(4))]=t);return n}function f(e,t){t=t.replace(/[\[]/,"\\[").replace(/[\]]/,"\\]");var n="[\\?&]"+t+"=([^&#]*)",i=new RegExp(n),r=i.exec(e);return null===r||r&&"string"!=typeof r[1]&&r[1].length?"":decodeURIComponent(r[1]).replace(/\+/g," ")}function l(e,t,n,i){var r="";if(0!=n){var a=new Date;a.setTime(a.getTime()+24*n*60*60*1e3),r="expires="+a.toUTCString()}void 0===i&&(i=T.cookieDomain),document.cookie="sh_"+e+"="+t+"; "+r+";path=/"+(i?";domain="+i:"")}function g(e){for(var t="sh_"+e+"=",n=document.cookie.split(";"),i=0;i<n.length;i++){for(var r=n[i];" "==r.charAt(0);)r=r.substring(1);if(0==r.indexOf(t))return r.substring(t.length,r.length)}return""}function p(e,t){var n={};for(var i in e)n[i]=e[i];for(var i in t)n[i]=t[i];return n}function h(e){return e.replace(/([\/*.?[\]()\-])/g,"\\$1")}function m(e){var t=T.adaptor.userTraits(),n={};for(var i in e)i in t||(n[i]=e[i]);return n}function S(e){for(var t=y(e),n=0;n<t.length;++n){var i="__tld__",r="."+t[n];if(l(i,1,0,r),g(i))return l(i,"",-100,r),r}return""}function y(e){var t=e.split("."),n=t[t.length-1],i=[];if(4==t.length&&parseInt(n,10)==n)return i;if(1>=t.length)return i;for(var r=t.length-2;r>=0;--r)i.push(t.slice(r).join("."));return i}var v={trackPages:null,page:null,trackAllPages:!1,detectURLChange:!0,detectHashChange:!1,domainsIgnore:["localhost","gtm-msr.appspot.com"],domainsIgnoreIPAddress:!0,domainsIgnoreSubdomains:["staging","test"],trackReferrerLandingPages:[],globalTraits:{},pageTraits:{},thisPageTraits:{},userId:void 0,userTraits:{},detectLogout:void 0,logToConsole:!1,sessionTimeout:30,overrideReferrer:void 0},T=this;if(this.sniffed=!1,this.queue=[],this.adaptor=t,"object"!=typeof t||!t.check())return void(window.console&&console.error&&console.error("[SiteHound] adaptor not valid"));for(var k in v)void 0!==e[k]&&(v[k]=e[k]),this[k]=v[k];this.thisPageTraits["SiteHound library version"]=this.VERSION=VERSION;var w,I;return this.sniff=this.done=function(){try{if(T.info("Sniffing.."),n(location.hostname))return T.info("Ignoring host: "+location.hostname),void(T.adaptor=new SiteHound_Adaptor_Disabled);if(g("dnt"))return T.info("do-not-track cookie present"),void(T.adaptor=new SiteHound_Adaptor_Disabled);o();var e=!T.sniffed;if(i(),"function"==typeof T.adaptor.afterSniff&&T.adaptor.afterSniff(),!e)return;s(),!T.detectURLChange&&!T.detectHashChange||w||(I=location.href,w=setInterval(function(){(T.detectHashChange?location.href!==I:location.href.replace(/#.*$/,"")!==I.replace(/#.*$/,""))&&(T.overrideReferrer=I||document.referrer,I=location.href,T.info("Detected URL change: "+I),T.page=void 0,T.sniff())},1e3))}catch(t){this.trackError(t)}},this.deferUntilSniff=function(e,t){return T.sniffed?!1:(T.queue.push(t.unshift(e)),!0)},this.identifyOnce=function(e){T.deferUntilSniff("identifyOnce",arguments)||T.adaptor.identify(T.ignoreExistingTraits(e))},this.detectPage=function(e){void 0===e&&(e=location.pathname);for(var t in T.trackPages){var n=T.trackPages[t];Array.isArray(n)||(n=[n]);for(var i=0;i<n.length;++i){var r=n[i];if("function"==typeof r.test){if(r.test(e))return T.info("Detected page: "+t),t}else if("."===r[0]){if(e===location.pathname&&document.body.className.match(new RegExp("(?:^|\\s)"+h(r.slice(1))+"(?!\\S)")))return T.info("Detected page: "+t),t}else if(e.replace(/\/$/,"").match(new RegExp("^"+h(r.replace(/\/$/,"")).replace(/\\\*/g,".*")+"$")))return T.info("Detected page: "+t),t}}},this.getTraitsToSend=function(e){var t=p(T.globalTraits,T.thisPageTraits);return"object"==typeof e?p(t,e):t},this.info=function(e){T.logToConsole&&window.console&&console.log&&("object"==typeof e?console.log(e):console.log("[SiteHound] "+e))},this.doNotTrack=function(e){e="undefined"==typeof e?!0:!!e,e?l("dnt","1",1e3):l("dnt","",-100)},this.info("Ready (v"+VERSION+")"),this.cookieDomain=S(location.hostname),this.info("Cookie domain: "+this.cookieDomain),g("dnt")?(T.info("do-not-track cookie present"),void(T.adaptor=new SiteHound_Adaptor_Disabled)):(window.sitehound=this,void(e.isDone&&this.sniff()))}function titleCase(e){return"string"==typeof e?e.replace(/\w\S*/g,function(e){return e.charAt(0).toUpperCase()+e.substr(1).toLowerCase()}):e}function getAdaptor(adaptor){var adaptorClass,result;if("object"==typeof adaptor)result=adaptor;else{adaptorClass=titleCase(adaptor)||"Segment";try{var result=eval("new SiteHound_Adaptor_"+adaptorClass)}catch(error){return void(window.console&&console.error&&(console.error("[SiteHound] adaptor class SiteHound_Adaptor_"+adaptorClass+" could not be loaded"),console.error("[SiteHound] "+error.name+"; "+error.message)))}}return result.check()?result:void(window.console&&console.error&&console.error("[SiteHound] failed to attach to "+(adaptorClass?adaptorClass:"adaptor")))}function SiteHound_Adaptor_Disabled(){this.check=this.ready=this.identify=this.track=this.trackLink=this.trackForm=this.page=this.alias=this.userId=this.userTraits=function(){}}function SiteHound_Adaptor_Segment(){window.analytics=window.analytics||[];var e=this;return this.check=function(){return"undefined"!=typeof analytics.ready},this.check()?(this.calledPage=!1,analytics.on("page",function(){e.calledPage=!0}),this.ready=function(e){analytics.ready(e)},this.identify=function(e,t){analytics.identify(e,t)},this.track=function(e,t){analytics.track(e,t)},this.trackLink=function(e,t,n){analytics.trackLink(e,t,n)},this.trackForm=function(e,t,n){analytics.trackForm(e,t,n)},this.page=function(t,n,i){e.calledPage=!0,analytics.page(t,n,i)},this.alias=function(e){analytics.alias(e)},this.userId=function(){var e=analytics.user();return e?e.id():void 0},this.userTraits=function(){var e=analytics.user(),t=e.traits();return t},void(this.afterSniff=function(){e.calledPage||analytics.page()})):void(window.console&&console.error&&console.error("[SiteHound] window.analytics is not initialized - ensure analytics.js snippet is included first"))}var VERSION="0.94";!function(){var e=window.sitehound||{},t=getAdaptor(e.adaptor);t&&t.ready(function(){var e=window.sitehound||{};new SiteHound(e,t)})}(),SiteHound.prototype.identify=function(e,t){this.deferUntilSniff("identify",arguments)||this.adaptor.identify(e,t)},SiteHound.prototype.track=function(e,t){this.deferUntilSniff("track",arguments)||("object"==typeof t?this.adaptor.track(e,this.getTraitsToSend(t)):this.adaptor.track(e,this.getTraitsToSend()))},SiteHound.prototype.trackOnce=function(e,t){if(!this.deferUntilSniff("trackOnce",arguments)){var n=this.adaptor.userTraits();if(void 0===n["First "+e]){var i={};i["First "+e]=(new Date).toISOString(),this.adaptor.identify(i),this.track(e,t)}}},SiteHound.prototype.trackAndCount=function(e,t){if(!this.deferUntilSniff("trackAndCount",arguments)){var n=this.adaptor.userTraits(),i=1;n&&(i=n[e+" Count"]?parseInt(n[e+" Count"])+1:1);var r={};r["First "+e]=(new Date).toISOString(),this.identifyOnce(r);var a={};a[e+" Count"]=i,a["Last "+e]=(new Date).toISOString(),this.adaptor.identify(a),this.track(e,t)}},SiteHound.prototype.trackLink=function(e,t){this.deferUntilSniff("trackLink",arguments)||this.adaptor.trackLink(e,t,this.getTraitsToSend())},SiteHound.prototype.trackForm=function(e,t){this.deferUntilSniff("trackForm",arguments)||this.adaptor.trackForm(e,t,this.getTraitsToSend())},SiteHound.prototype.ready=function(e){"function"==typeof e?(this.info("ready()"),e()):window.console&&console.error&&console.error("[SiteHound] ready() called with something that isn't a function")},SiteHound.prototype.load=function(e){this.info("load() called when already loaded"),e&&(this.info("updating adaptor to: "+e),this.adaptor=getAdaptor(e))},SiteHound.prototype.trackDebugInfo=function(e){this.trackDebug(e,"info")},SiteHound.prototype.trackDebugWarn=function(e){this.trackDebug(e,"warn")},SiteHound.prototype.trackDebug=function(e,t){t||(t="info"),this.adaptor.track("Tracking Debug",{message:e,level:t,"SiteHound library version":this.VERSION}),this.info("["+t+"] "+e)},SiteHound.prototype.trackError=function(e){this.adaptor.track("Tracking Error",{name:e.name,message:e.message,"SiteHound library version":this.VERSION}),window.console&&console.error&&console.error("[SiteHound] "+e.name+"; "+e.message)}}();